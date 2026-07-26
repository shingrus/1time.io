#!/usr/bin/env python3
"""
Export 1time Redis stats into a Google Spreadsheet.

Expected Redis key layout from the Go app:
  - stats:stored:text:total                  -> total stored text secrets
  - stats:stored:file:total                  -> total stored files
  - stats:stored:text:day:YYYYMMDD           -> per-day stored text secrets
  - stats:stored:file:day:YYYYMMDD           -> per-day stored files
  - stats:page:hits:total                    -> hash: page -> total hits
  - stats:page:hits:day:YYYYMMDD             -> hash: page -> daily hits
  - stats:views:total:VIEWS                  -> lifetime secrets created with VIEWS views
  - stats:views:day:YYYYMMDD:VIEWS           -> per-day secrets created with VIEWS views
  - stats:views:file:total:VIEWS             -> lifetime files created with VIEWS downloads
  - stats:views:file:day:YYYYMMDD:VIEWS      -> per-day files created with VIEWS downloads

Nginx sender/receiver analytics:
  - Reads /var/log/nginx/1time.access.log and /var/log/nginx/1time.access.log.1
    by default.
  - Use --nginx-log PATH one or more times to override the default log paths.
  - Counts unique IP + User-Agent pairs per UTC date.
  - Successful text sends are POST /api/saveSecret responses without the known
    error response body size.
  - Successful text reads are POST /api/get responses without the known
    "no message", "wrong key", or generic error response body sizes.
  - File sends/reads are counted separately from text sends/reads.
  - The senders_receivers tab is merged by date: recalculated dates replace
    existing rows, while dates outside the current log window are preserved.

Dependencies:
  pip install redis google-api-python-client google-auth

Authentication:
  Create a Google Cloud service account with access to the Sheets API, then
  share the target spreadsheet with the service account email.

Examples:
  export GOOGLE_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
  export GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
  export REDIS_URL=redis://:password@127.0.0.1:6379/0
  python3 scripts/export_redis_stats_to_gsheets.py

  # Or with explicit host/password env vars used by the Go app:
  export REDISHOST=127.0.0.1:6379
  export REDISPASS=
  python3 scripts/export_redis_stats_to_gsheets.py --spreadsheet-id your_spreadsheet_id

  # Override nginx logs:
  python3 scripts/export_redis_stats_to_gsheets.py \
    --nginx-log /var/log/nginx/1time.access.log \
    --nginx-log /var/log/nginx/1time.access.log.1
"""

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import sys
from typing import Dict, Iterable, List, Sequence, Tuple
from urllib.parse import urlsplit

try:
    import redis
except ImportError:  # pragma: no cover - handled in runtime checks
    redis = None

try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
except ImportError:  # pragma: no cover - handled in runtime checks
    service_account = None
    build = None

STORED_TEXT_TOTAL_KEY = "stats:stored:text:total"
STORED_FILE_TOTAL_KEY = "stats:stored:file:total"
STORED_TEXT_DAY_KEY_PREFIX = "stats:stored:text:day:"
STORED_FILE_DAY_KEY_PREFIX = "stats:stored:file:day:"
PAGE_HIT_TOTAL_KEY = "stats:page:hits:total"
PAGE_HIT_DAY_KEY_PREFIX = "stats:page:hits:day:"
VIEWS_TOTAL_KEY_PREFIX = "stats:views:total:"
VIEWS_DAY_KEY_PREFIX = "stats:views:day:"
FILE_VIEWS_TOTAL_KEY_PREFIX = "stats:views:file:total:"
FILE_VIEWS_DAY_KEY_PREFIX = "stats:views:file:day:"

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
TAB_NAMES = (
    "overview",
    "stored_daily",
    "page_hits_total",
    "page_hits_daily",
    "views_total",
    "views_daily",
    "file_views_daily",
    "senders_receivers",
)
LEGACY_TAB_NAMES = ("file_views_total",)
DEFAULT_NGINX_LOG_PATHS = (
    "/var/log/nginx/1time.access.log",
    "/var/log/nginx/1time.access.log.1",
)

NGINX_COMBINED_LOG_RE = re.compile(
    r"^(?P<remote_addr>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "
    r'"(?P<request>(?:[^"\\]|\\.)*)" '
    r"(?P<status>\d{3}) (?P<body_bytes_sent>\S+) "
    r'"(?P<referer>(?:[^"\\]|\\.)*)" '
    r'"(?P<user_agent>(?:[^"\\]|\\.)*)"(?: .*)?$'
)

# /api/get failure response sizes. Two generations are listed because a log
# window can straddle the deploy that added viewsLeft/expiresIn to the response:
#   39/43/44 -> pre-view-counter {status, cryptedMessage}
#   67/71/72 -> current {status, cryptedMessage, viewsLeft, expiresIn}
#              (error=67, wrong key=71, no message=72)
# The shortest possible SUCCESS body is ~104 bytes (a 41-char minimum protocol
# ciphertext), so none of these can collide with a real read.
TEXT_READ_FAILURE_BODY_SIZES = {39, 43, 44, 67, 71, 72}
FILE_READ_FAILURE_BODY_SIZES = {22, 23}
SAVE_FAILURE_BODY_SIZES = {30}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export 1time Redis stats into a Google Spreadsheet."
    )
    parser.add_argument(
        "--redis-url",
        default=os.getenv("REDIS_URL"),
        help="Redis connection URL, e.g. redis://:password@127.0.0.1:6379/0",
    )
    parser.add_argument(
        "--redis-host",
        default=os.getenv("REDISHOST", "127.0.0.1:6379"),
        help="Redis host:port if --redis-url is not used",
    )
    parser.add_argument(
        "--redis-password",
        default=os.getenv("REDISPASS", ""),
        help="Redis password if --redis-url is not used",
    )
    parser.add_argument(
        "--redis-db",
        type=int,
        default=int(os.getenv("REDISDB", "0")),
        help="Redis DB index if --redis-url is not used",
    )
    parser.add_argument(
        "--service-account-json",
        default=os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON"),
        help="Path to Google service account JSON credentials",
    )
    parser.add_argument(
        "--spreadsheet-id",
        default=os.getenv("GOOGLE_SHEETS_SPREADSHEET_ID"),
        help="Target Google Spreadsheet ID",
    )
    parser.add_argument(
        "--sheet-prefix",
        default=os.getenv("GOOGLE_SHEETS_TAB_PREFIX", "1time_"),
        help="Prefix added to tab names inside the spreadsheet",
    )
    parser.add_argument(
        "--nginx-log",
        dest="nginx_logs",
        action="append",
        default=None,
        help=(
            "Path to an nginx access log to include in sender/receiver analytics. "
            "May be repeated. Defaults to /var/log/nginx/1time.access.log and .1."
        ),
    )
    return parser.parse_args()


def warn(message: str) -> None:
    print(f"Warning: {message}", file=sys.stderr)


def get_nginx_log_paths(args: argparse.Namespace) -> List[str]:
    if args.nginx_logs:
        return args.nginx_logs
    return list(DEFAULT_NGINX_LOG_PATHS)


def build_redis_client(args: argparse.Namespace) -> redis.Redis:
    if redis is None:
        raise RuntimeError(
            "Missing dependency 'redis'. Install it with: pip install redis"
        )

    if args.redis_url:
        client = redis.Redis.from_url(args.redis_url, decode_responses=True)
    else:
        host, port = split_host_port(args.redis_host)
        client = redis.Redis(
            host=host,
            port=port,
            password=args.redis_password or None,
            db=args.redis_db,
            decode_responses=True,
        )

    client.ping()
    return client


def split_host_port(hostport: str) -> Tuple[str, int]:
    if ":" not in hostport:
        return hostport, 6379
    host, port = hostport.rsplit(":", 1)
    return host, int(port)


def scan_keys(client: redis.Redis, pattern: str) -> List[str]:
    keys: List[str] = []
    cursor = 0
    while True:
        cursor, chunk = client.scan(cursor=cursor, match=pattern, count=500)
        keys.extend(chunk)
        if cursor == 0:
            break
    return sorted(keys)


def safe_int(value: str | None) -> int:
    if value in (None, ""):
        return 0
    return int(value)


def sort_view_buckets(buckets: Iterable[str]) -> List[str]:
    """Order view-count buckets numerically so 10 follows 5, not 1."""
    return sorted(set(buckets), key=lambda bucket: (safe_int(bucket), bucket))


def build_views_daily_rows(
    views_daily: Dict[str, Dict[str, int]],
    known_buckets: Iterable[str] = (),
) -> List[List[object]]:
    buckets = sort_view_buckets(
        list(known_buckets)
        + [bucket for counts in views_daily.values() for bucket in counts]
    )

    rows: List[List[object]] = [["date", *[f"views_{bucket}" for bucket in buckets]]]
    for day in sorted(views_daily):
        rows.append([day, *[views_daily.get(day, {}).get(bucket, 0) for bucket in buckets]])

    return rows


def build_views_total_rows(
    views_total: Dict[str, int],
    file_views_total: Dict[str, int],
) -> List[List[object]]:
    """Combine text-view and file-download distributions by allowance bucket."""
    views_total_sum = sum(views_total.values())
    file_views_total_sum = sum(file_views_total.values())
    buckets = sort_view_buckets([*views_total, *file_views_total])

    rows: List[List[object]] = [[
        "views",
        "secrets",
        "secrets_share_percent",
        "files",
        "files_share_percent",
    ]]
    for bucket in buckets:
        secret_count = views_total.get(bucket, 0)
        file_count = file_views_total.get(bucket, 0)
        secret_share = (
            round(secret_count * 100 / views_total_sum, 2)
            if views_total_sum
            else 0
        )
        file_share = (
            round(file_count * 100 / file_views_total_sum, 2)
            if file_views_total_sum
            else 0
        )
        rows.append([
            bucket,
            secret_count,
            secret_share,
            file_count,
            file_share,
        ])

    return rows


def build_page_hits_daily_rows(
    page_hits_daily: Dict[str, Dict[str, int]],
    known_pages: Iterable[str] = (),
) -> List[List[object]]:
    days = sorted(page_hits_daily)
    pages = sorted(
        set(known_pages)
        | {page for fields in page_hits_daily.values() for page in fields}
    )

    rows: List[List[object]] = [["date", *pages]]
    for day in days:
        rows.append([day, *[page_hits_daily.get(day, {}).get(page, 0) for page in pages]])

    return rows


def parse_nginx_body_size(value: str) -> int | None:
    if value == "-":
        return None
    try:
        return int(value)
    except ValueError:
        return None


def parse_nginx_access_line(line: str) -> Dict[str, object] | None:
    match = NGINX_COMBINED_LOG_RE.match(line.rstrip("\n"))
    if not match:
        return None

    values = match.groupdict()
    request_parts = values["request"].split()
    if len(request_parts) < 2:
        return None

    try:
        timestamp = dt.datetime.strptime(values["time"], "%d/%b/%Y:%H:%M:%S %z")
    except ValueError:
        return None

    method, target = request_parts[0], request_parts[1]
    path = urlsplit(target).path
    if not path:
        path = target

    return {
        "day": timestamp.astimezone(dt.timezone.utc).date().isoformat(),
        "ip": values["remote_addr"],
        "method": method,
        "path": path,
        "status": int(values["status"]),
        "body_size": parse_nginx_body_size(values["body_bytes_sent"]),
        "user_agent": values["user_agent"],
    }


def successful_nginx_metric(entry: Dict[str, object]) -> str | None:
    if entry["method"] != "POST":
        return None
    if not (200 <= int(entry["status"]) <= 299):
        return None

    path = entry["path"]
    body_size = entry["body_size"]
    if path == "/api/saveSecret":
        return None if body_size in SAVE_FAILURE_BODY_SIZES else "text_senders"
    if path == "/api/saveFile":
        return None if body_size in SAVE_FAILURE_BODY_SIZES else "file_senders"
    if path == "/api/get":
        return None if body_size in TEXT_READ_FAILURE_BODY_SIZES else "text_receivers"
    if path == "/api/getFile":
        return None if body_size in FILE_READ_FAILURE_BODY_SIZES else "file_receivers"

    return None


def collect_nginx_daily_uniques(log_paths: Sequence[str]) -> List[List[object]]:
    columns = [
        "date",
        "text_senders",
        "text_receivers",
        "file_senders",
        "file_receivers",
    ]
    daily: Dict[str, Dict[str, set[Tuple[str, str]]]] = {}
    readable_logs = 0

    for log_path in log_paths:
        try:
            with open(log_path, encoding="utf-8", errors="replace") as log_file:
                readable_logs += 1
                for line in log_file:
                    entry = parse_nginx_access_line(line)
                    if entry is None:
                        continue

                    metric = successful_nginx_metric(entry)
                    if metric is None:
                        continue

                    day = str(entry["day"])
                    identity = (str(entry["ip"]), str(entry["user_agent"]))
                    day_metrics = daily.setdefault(
                        day,
                        {
                            "text_senders": set(),
                            "text_receivers": set(),
                            "file_senders": set(),
                            "file_receivers": set(),
                        },
                    )
                    day_metrics[metric].add(identity)
        except FileNotFoundError:
            warn(f"Nginx access log not found, skipping: {log_path}")
        except PermissionError as exc:
            warn(f"Nginx access log not readable, skipping: {log_path}: {exc}")
        except OSError as exc:
            warn(f"Nginx access log could not be read, skipping: {log_path}: {exc}")

    if readable_logs == 0:
        warn(
            "No readable nginx access logs; "
            "senders_receivers tab will contain headers only."
        )

    rows: List[List[object]] = [columns]
    for day in sorted(daily):
        day_metrics = daily[day]
        rows.append([
            day,
            len(day_metrics["text_senders"]),
            len(day_metrics["text_receivers"]),
            len(day_metrics["file_senders"]),
            len(day_metrics["file_receivers"]),
        ])

    return rows


def collect_stats(
    client: redis.Redis,
    nginx_log_paths: Sequence[str],
) -> Dict[str, List[List[object]]]:
    exported_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()

    total_stored_text = safe_int(client.get(STORED_TEXT_TOTAL_KEY))
    total_stored_files = safe_int(client.get(STORED_FILE_TOTAL_KEY))
    page_hits_total_raw = client.hgetall(PAGE_HIT_TOTAL_KEY)
    page_hits_total = sorted(
        ((page, safe_int(value)) for page, value in page_hits_total_raw.items()),
        key=lambda item: item[0],
    )

    stored_text_daily = {
        key.removeprefix(STORED_TEXT_DAY_KEY_PREFIX): safe_int(client.get(key))
        for key in scan_keys(client, f"{STORED_TEXT_DAY_KEY_PREFIX}*")
    }
    stored_file_daily = {
        key.removeprefix(STORED_FILE_DAY_KEY_PREFIX): safe_int(client.get(key))
        for key in scan_keys(client, f"{STORED_FILE_DAY_KEY_PREFIX}*")
    }
    stored_daily_rows: List[List[object]] = [["day", "stored_secrets", "stored_files"]]
    for day in sorted(set(stored_text_daily) | set(stored_file_daily)):
        stored_daily_rows.append([
            day,
            stored_text_daily.get(day, 0),
            stored_file_daily.get(day, 0),
        ])

    page_hits_daily: Dict[str, Dict[str, int]] = {}
    for key in scan_keys(client, f"{PAGE_HIT_DAY_KEY_PREFIX}*"):
        day = key.removeprefix(PAGE_HIT_DAY_KEY_PREFIX)
        fields = client.hgetall(key)
        page_hits_daily[day] = {
            page: safe_int(hits)
            for page, hits in sorted(fields.items(), key=lambda item: item[0])
        }

    # View-counter distribution: how many secrets were created per view bucket.
    views_total = {
        key.removeprefix(VIEWS_TOTAL_KEY_PREFIX): safe_int(client.get(key))
        for key in scan_keys(client, f"{VIEWS_TOTAL_KEY_PREFIX}*")
    }
    views_daily: Dict[str, Dict[str, int]] = {}
    for key in scan_keys(client, f"{VIEWS_DAY_KEY_PREFIX}*"):
        day, _, bucket = key.removeprefix(VIEWS_DAY_KEY_PREFIX).partition(":")
        if not bucket:
            continue
        views_daily.setdefault(day, {})[bucket] = safe_int(client.get(key))

    views_daily_rows = build_views_daily_rows(views_daily, known_buckets=views_total)

    file_views_total = {
        key.removeprefix(FILE_VIEWS_TOTAL_KEY_PREFIX): safe_int(client.get(key))
        for key in scan_keys(client, f"{FILE_VIEWS_TOTAL_KEY_PREFIX}*")
    }
    file_views_daily: Dict[str, Dict[str, int]] = {}
    for key in scan_keys(client, f"{FILE_VIEWS_DAY_KEY_PREFIX}*"):
        day, _, bucket = key.removeprefix(FILE_VIEWS_DAY_KEY_PREFIX).partition(":")
        if not bucket:
            continue
        file_views_daily.setdefault(day, {})[bucket] = safe_int(client.get(key))

    file_views_daily_rows = build_views_daily_rows(
        file_views_daily,
        known_buckets=file_views_total,
    )
    views_total_rows = build_views_total_rows(views_total, file_views_total)
    views_total_sum = sum(views_total.values())
    file_views_total_sum = sum(file_views_total.values())

    page_hits_daily_rows = build_page_hits_daily_rows(
        page_hits_daily,
        known_pages=(page for page, _ in page_hits_total),
    )
    page_hits_daily_day_count = max(len(page_hits_daily_rows) - 1, 0)
    page_hits_daily_page_count = max(len(page_hits_daily_rows[0]) - 1, 0)

    overview_rows: List[List[object]] = [
        ["metric", "value"],
        ["exported_at_utc", exported_at],
        ["total_stored_secrets", total_stored_text],
        ["total_stored_files", total_stored_files],
        ["stored_daily_rows", max(len(stored_daily_rows) - 1, 0)],
        ["page_hits_total_rows", len(page_hits_total)],
        ["page_hits_daily_pages", page_hits_daily_page_count],
        ["page_hits_daily_days", page_hits_daily_day_count],
        ["views_counted_secrets", views_total_sum],
        ["views_multi_view_secrets", views_total_sum - views_total.get("1", 0)],
        ["views_counted_files", file_views_total_sum],
        ["views_multi_download_files", file_views_total_sum - file_views_total.get("1", 0)],
    ]

    page_hits_total_rows: List[List[object]] = [["page", "hits"]]
    for page, hits in page_hits_total:
        page_hits_total_rows.append([page, hits])

    return {
        "overview": overview_rows,
        "stored_daily": stored_daily_rows,
        "page_hits_total": page_hits_total_rows,
        "page_hits_daily": page_hits_daily_rows,
        "views_total": views_total_rows,
        "views_daily": views_daily_rows,
        "file_views_daily": file_views_daily_rows,
        "senders_receivers": collect_nginx_daily_uniques(nginx_log_paths),
    }


def build_sheets_service(service_account_json: str):
    if service_account is None or build is None:
        raise RuntimeError(
            "Missing Google Sheets dependencies. Install them with: "
            "pip install google-api-python-client google-auth"
        )

    credentials = service_account.Credentials.from_service_account_file(
        service_account_json,
        scopes=SCOPES,
    )
    return build("sheets", "v4", credentials=credentials, cache_discovery=False)


def get_existing_sheets(service, spreadsheet_id: str) -> Dict[str, int]:
    spreadsheet = (
        service.spreadsheets()
        .get(spreadsheetId=spreadsheet_id)
        .execute()
    )
    return {
        sheet["properties"]["title"]: sheet["properties"]["sheetId"]
        for sheet in spreadsheet.get("sheets", [])
    }


def ensure_sheets(service, spreadsheet_id: str, titles: Sequence[str]) -> Dict[str, int]:
    existing = get_existing_sheets(service, spreadsheet_id)
    missing = [title for title in titles if title not in existing]

    if missing:
        requests = [
            {"addSheet": {"properties": {"title": title}}}
            for title in missing
        ]
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": requests},
        ).execute()
        existing = get_existing_sheets(service, spreadsheet_id)

    return existing


def delete_sheets(
    service,
    spreadsheet_id: str,
    sheet_map: Dict[str, int],
    titles: Sequence[str],
) -> List[str]:
    deleted = [title for title in titles if title in sheet_map]
    if not deleted:
        return []

    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={
            "requests": [
                {"deleteSheet": {"sheetId": sheet_map[title]}}
                for title in deleted
            ]
        },
    ).execute()
    return deleted


def write_tab(
    service,
    spreadsheet_id: str,
    sheet_id: int,
    title: str,
    rows: Sequence[Sequence[object]],
) -> None:
    service.spreadsheets().values().clear(
        spreadsheetId=spreadsheet_id,
        range=title,
    ).execute()

    service.spreadsheets().values().update(
        spreadsheetId=spreadsheet_id,
        range=f"{title}!A1",
        valueInputOption="RAW",
        body={"values": list(rows)},
    ).execute()

    format_tab(service, spreadsheet_id, sheet_id, rows)


def format_tab(
    service,
    spreadsheet_id: str,
    sheet_id: int,
    rows: Sequence[Sequence[object]],
) -> None:
    column_count = max((len(row) for row in rows), default=1)
    requests = [
        {
            "updateSheetProperties": {
                "properties": {
                    "sheetId": sheet_id,
                    "gridProperties": {"frozenRowCount": 1},
                },
                "fields": "gridProperties.frozenRowCount",
            }
        },
        {
            "autoResizeDimensions": {
                "dimensions": {
                    "sheetId": sheet_id,
                    "dimension": "COLUMNS",
                    "startIndex": 0,
                    "endIndex": column_count,
                }
            }
        },
    ]
    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": requests},
    ).execute()


def write_senders_receivers_tab(
    service,
    spreadsheet_id: str,
    sheet_id: int,
    title: str,
    rows: Sequence[Sequence[object]],
) -> int:
    """Write only dates present in the current nginx log export."""
    if not rows:
        return 0

    header = list(rows[0])
    current_log_rows = [
        list(row)
        for row in rows[1:]
        if row and str(row[0])
    ]
    if not current_log_rows:
        warn(
            f"No current nginx log dates found; leaving tab {title} unchanged."
        )
        return 0

    existing_rows = read_tab_rows(service, spreadsheet_id, title)
    column_count = max(len(header), *(len(row) for row in current_log_rows))
    column_end = column_letter(column_count)

    if not existing_rows:
        values = [
            pad_row(header, column_count),
            *[pad_row(row, column_count) for row in current_log_rows],
        ]
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "valueInputOption": "RAW",
                "data": [{
                    "range": f"{title}!A1:{column_end}{len(values)}",
                    "values": values,
                }],
            },
        ).execute()
        format_tab(service, spreadsheet_id, sheet_id, values)
        return len(current_log_rows)

    existing_row_numbers_by_date: Dict[str, int] = {}
    for row_number, row in enumerate(existing_rows[1:], start=2):
        if not row:
            continue
        day = str(row[0])
        if not day:
            continue
        if day in existing_row_numbers_by_date:
            warn(
                f"Duplicate date {day} in tab {title}; updating first occurrence only."
            )
            continue
        existing_row_numbers_by_date[day] = row_number

    updates = []
    new_rows: List[List[object]] = []

    for row in current_log_rows:
        day = str(row[0])
        padded_row = pad_row(row, column_count)
        existing_row_number = existing_row_numbers_by_date.get(day)
        if existing_row_number is None:
            new_rows.append(padded_row)
        else:
            updates.append({
                "range": f"{title}!A{existing_row_number}:{column_end}{existing_row_number}",
                "values": [padded_row],
            })

    changed_row_count = len(updates) + len(new_rows)
    if new_rows:
        start_row = len(existing_rows) + 1
        end_row = start_row + len(new_rows) - 1
        updates.append({
            "range": f"{title}!A{start_row}:{column_end}{end_row}",
            "values": new_rows,
        })

    if updates:
        service.spreadsheets().values().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                "valueInputOption": "RAW",
                "data": updates,
            },
        ).execute()

    if updates or new_rows:
        format_tab(service, spreadsheet_id, sheet_id, [header, *current_log_rows])

    return changed_row_count


def pad_row(row: Sequence[object], column_count: int) -> List[object]:
    padded = list(row)
    if len(padded) < column_count:
        padded.extend([""] * (column_count - len(padded)))
    return padded


def column_letter(column_number: int) -> str:
    if column_number < 1:
        raise ValueError("column_number must be at least 1")

    letters = ""
    while column_number:
        column_number, remainder = divmod(column_number - 1, 26)
        letters = chr(ord("A") + remainder) + letters
    return letters


def read_tab_rows(service, spreadsheet_id: str, title: str) -> List[List[object]]:
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=f"{title}!A1:Z")
        .execute()
    )
    return result.get("values", [])


def main() -> int:
    args = parse_args()

    if not args.service_account_json:
        raise SystemExit(
            "Missing Google credentials. Set --service-account-json or GOOGLE_SERVICE_ACCOUNT_JSON."
        )
    if not args.spreadsheet_id:
        raise SystemExit(
            "Missing spreadsheet id. Set --spreadsheet-id or GOOGLE_SHEETS_SPREADSHEET_ID."
        )

    redis_client = build_redis_client(args)
    stats = collect_stats(redis_client, get_nginx_log_paths(args))

    service = build_sheets_service(args.service_account_json)
    full_tab_names = {
        base_name: f"{args.sheet_prefix}{base_name}" for base_name in TAB_NAMES
    }
    legacy_tab_names = [
        f"{args.sheet_prefix}{base_name}" for base_name in LEGACY_TAB_NAMES
    ]
    sheet_map = ensure_sheets(service, args.spreadsheet_id, full_tab_names.values())

    for base_name, rows in stats.items():
        title = full_tab_names[base_name]
        if base_name == "senders_receivers":
            changed_rows = write_senders_receivers_tab(
                service=service,
                spreadsheet_id=args.spreadsheet_id,
                sheet_id=sheet_map[title],
                title=title,
                rows=rows,
            )
            print(f"Updated/appended {changed_rows} current-log rows in tab {title}")
        else:
            write_tab(
                service=service,
                spreadsheet_id=args.spreadsheet_id,
                sheet_id=sheet_map[title],
                title=title,
                rows=rows,
            )
            print(f"Wrote {len(rows) - 1 if rows else 0} data rows to tab {title}")

    deleted_tabs = delete_sheets(
        service,
        args.spreadsheet_id,
        sheet_map,
        legacy_tab_names,
    )
    for title in deleted_tabs:
        print(f"Deleted obsolete tab {title}")

    print("Export completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
