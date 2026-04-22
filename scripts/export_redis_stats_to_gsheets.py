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

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]
TAB_NAMES = (
    "overview",
    "stored_daily",
    "page_hits_total",
    "page_hits_daily",
    "senders_receivers",
)
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

TEXT_READ_FAILURE_BODY_SIZES = {39, 43, 44}
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
    ]

    page_hits_total_rows: List[List[object]] = [["page", "hits"]]
    for page, hits in page_hits_total:
        page_hits_total_rows.append([page, hits])

    return {
        "overview": overview_rows,
        "stored_daily": stored_daily_rows,
        "page_hits_total": page_hits_total_rows,
        "page_hits_daily": page_hits_daily_rows,
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


def read_tab_rows(service, spreadsheet_id: str, title: str) -> List[List[object]]:
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=f"{title}!A1:Z")
        .execute()
    )
    return result.get("values", [])


def merge_daily_rows_by_date(
    existing_rows: Sequence[Sequence[object]],
    recalculated_rows: Sequence[Sequence[object]],
) -> List[List[object]]:
    if not recalculated_rows:
        return [list(row) for row in existing_rows]

    header = list(recalculated_rows[0])
    merged_by_date: Dict[str, List[object]] = {}

    for row in existing_rows[1:]:
        if not row:
            continue
        day = str(row[0])
        if day:
            merged_by_date[day] = list(row)

    for row in recalculated_rows[1:]:
        if not row:
            continue
        day = str(row[0])
        if day:
            merged_by_date[day] = list(row)

    rows: List[List[object]] = [header]
    for day in sorted(merged_by_date):
        rows.append(merged_by_date[day])
    return rows


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
    sheet_map = ensure_sheets(service, args.spreadsheet_id, full_tab_names.values())

    for base_name, rows in stats.items():
        title = full_tab_names[base_name]
        if base_name == "senders_receivers":
            existing_rows = read_tab_rows(service, args.spreadsheet_id, title)
            rows = merge_daily_rows_by_date(existing_rows, rows)

        write_tab(
            service=service,
            spreadsheet_id=args.spreadsheet_id,
            sheet_id=sheet_map[title],
            title=title,
            rows=rows,
        )
        print(f"Wrote {len(rows) - 1 if rows else 0} data rows to tab {title}")

    print("Export completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
