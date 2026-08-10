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
  - Reads /var/log/nginx/1time.access.log plus every rotated sibling
    (1time.access.log.1, 1time.access.log.2.gz, ...) by default. Gzipped logs
    are decompressed transparently, so the whole rotation window is available.
  - Use --nginx-log PATH one or more times to override the defaults. Paths may
    contain glob patterns.
  - Counts unique IP + User-Agent pairs per UTC date.
  - Successful text sends are POST /api/saveSecret responses without the known
    error response body size.
  - Successful text reads are POST /api/get responses without the known
    "no message", "wrong key", or generic error response body sizes.
  - File sends/reads are counted separately from text sends/reads.
  - senders/receivers/dau are unions of those identity sets, so a person who
    sends both a text and a file counts once.
  - wau is the same union taken across the trailing 7 days, deduplicated - a
    person active on three of those days counts once. It is left EMPTY when
    any of the 7 days is missing from the parsed window, and an empty value
    preserves whatever the sheet already holds rather than blanking it. That
    matters as the rotation window slides: the oldest dates lose their history
    and would otherwise have a correct WAU overwritten with a partial one.
    wau is not comparable to a 7-day rolling mean of dau, which averages seven
    daily counts without deduplicating across days.
  - whale_dau counts the known high-volume identities, which are *included* in
    dau; subtract it in the sheet for an organic figure.
  - ext_saves/cli_saves are successful saves tagged ?src=ext / ?src=cli (or a
    non-browser User-Agent), counted as events rather than unique identities.
  - Rotation overlap is resolved the way the log-analysis skill does it: for
    each date, only the file holding the most lines for that date is counted.
    Identical lines are never de-duplicated - they are real repeat requests.
  - NOTE: identity here is the raw IP + UA. The log-analysis skill collapses
    IPv6 to /64 and drops whales entirely, so its DAU reads slightly lower.
    The rule is kept as-is so this tab stays consistent with its own history.
  - The senders_receivers tab is merged by date: recalculated dates replace
    existing rows, while dates outside the current log window are preserved.
    The header row is rewritten whenever the column set changes.

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
import glob
import gzip
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
# Every rotated sibling, not just .1 - the rotation window is the history.
DEFAULT_NGINX_LOG_PATHS = (
    "/var/log/nginx/1time.access.log",
    "/var/log/nginx/1time.access.log.*",
)

# Kept in sync with .claude/skills/log-analysis/analyze.py.
WHALE_IP_PREFIXES = ("31.217.", "46.188.", "212.15.178.", "95.168.")  # Zagreb pair
WHALE_IP_EXACT = {"195.23.138.189"}  # Lisbon B2B distributor
CLI_USER_AGENT_RE = re.compile(r"node|undici|curl|python|go-http|okhttp", re.I)

SENDER_RECEIVER_COLUMNS = [
    "date",
    "text_senders",
    "text_receivers",
    "file_senders",
    "file_receivers",
    "senders",
    "receivers",
    "dau",
    "wau",
    "whale_dau",
    "ext_saves",
    "cli_saves",
]
IDENTITY_METRICS = ("text_senders", "text_receivers", "file_senders", "file_receivers")

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
    """Expand glob patterns so rotated (and gzipped) logs are picked up too."""
    patterns = args.nginx_logs or list(DEFAULT_NGINX_LOG_PATHS)

    paths: List[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        is_glob = any(char in pattern for char in "*?[")
        # Literal paths are kept even when missing, so the warning still fires.
        matches = sorted(glob.glob(pattern)) if is_glob else [pattern]
        for path in matches:
            if path not in seen:
                seen.add(path)
                paths.append(path)

    return paths


def open_nginx_log(path: str):
    if path.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8", errors="replace")
    return open(path, encoding="utf-8", errors="replace")


def is_whale_ip(ip: str) -> bool:
    return ip in WHALE_IP_EXACT or ip.startswith(WHALE_IP_PREFIXES)


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
        # Kept with the query string: ?src=ext / ?src=cli live here.
        "target": target,
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


def new_day_bucket() -> Dict[str, object]:
    bucket: Dict[str, object] = {metric: set() for metric in IDENTITY_METRICS}
    bucket["whales"] = set()
    bucket["ext_saves"] = 0
    bucket["cli_saves"] = 0
    return bucket


def accumulate_nginx_entry(bucket: Dict[str, object], entry: Dict[str, object]) -> None:
    metric = successful_nginx_metric(entry)
    if metric is None:
        return

    if metric in ("text_senders", "file_senders"):
        target = str(entry["target"])
        user_agent = str(entry["user_agent"])
        if "src=ext" in target:
            bucket["ext_saves"] = int(bucket["ext_saves"]) + 1
        elif "src=cli" in target or CLI_USER_AGENT_RE.search(user_agent):
            bucket["cli_saves"] = int(bucket["cli_saves"]) + 1

    ip = str(entry["ip"])
    identity = (ip, str(entry["user_agent"]))
    bucket[metric].add(identity)  # type: ignore[union-attr]
    if is_whale_ip(ip):
        bucket["whales"].add(identity)  # type: ignore[union-attr]


def trailing_week_actives(
    day: str,
    active_by_day: Dict[str, set[Tuple[str, str]]],
) -> int | None:
    """WAU for the 7 days ending on `day`, or None when the window is short.

    None means "keep whatever the sheet already has": a partial window would
    understate WAU, and writing it would destroy a value computed correctly on
    an earlier run.
    """
    end = dt.date.fromisoformat(day)
    window = [(end - dt.timedelta(days=offset)).isoformat() for offset in range(7)]
    if any(other not in active_by_day for other in window):
        return None
    return len(set().union(*(active_by_day[other] for other in window)))


def collect_nginx_daily_uniques(log_paths: Sequence[str]) -> List[List[object]]:
    # Rotation can put the same date in two files. Accumulate per (file, date)
    # and keep only the file holding the most lines for that date - the same
    # rule the log-analysis skill uses. Never de-duplicate identical lines.
    per_file_day: Dict[Tuple[str, str], Dict[str, object]] = {}
    parsed_lines: Dict[Tuple[str, str], int] = {}
    readable_logs = 0

    for log_path in log_paths:
        try:
            with open_nginx_log(log_path) as log_file:
                readable_logs += 1
                for line in log_file:
                    entry = parse_nginx_access_line(line)
                    if entry is None:
                        continue

                    key = (log_path, str(entry["day"]))
                    parsed_lines[key] = parsed_lines.get(key, 0) + 1
                    bucket = per_file_day.get(key)
                    if bucket is None:
                        bucket = per_file_day[key] = new_day_bucket()
                    accumulate_nginx_entry(bucket, entry)
        except FileNotFoundError:
            warn(f"Nginx access log not found, skipping: {log_path}")
        except PermissionError as exc:
            warn(f"Nginx access log not readable, skipping: {log_path}: {exc}")
        except (OSError, EOFError, gzip.BadGzipFile) as exc:
            warn(f"Nginx access log could not be read, skipping: {log_path}: {exc}")

    if readable_logs == 0:
        warn(
            "No readable nginx access logs; "
            "senders_receivers tab will contain headers only."
        )

    best_file_by_day: Dict[str, Tuple[int, str]] = {}
    for (log_path, day), line_count in parsed_lines.items():
        current = best_file_by_day.get(day)
        if current is None or line_count > current[0]:
            best_file_by_day[day] = (line_count, log_path)

    selected = {
        day: per_file_day[(log_path, day)]
        for day, (_, log_path) in best_file_by_day.items()
    }
    active_by_day: Dict[str, set[Tuple[str, str]]] = {
        day: set().union(*(bucket[metric] for metric in IDENTITY_METRICS))
        for day, bucket in selected.items()
    }

    rows: List[List[object]] = [list(SENDER_RECEIVER_COLUMNS)]
    for day in sorted(selected):
        bucket = selected[day]
        text_senders = bucket["text_senders"]
        text_receivers = bucket["text_receivers"]
        file_senders = bucket["file_senders"]
        file_receivers = bucket["file_receivers"]
        senders = text_senders | file_senders
        receivers = text_receivers | file_receivers

        rows.append([
            day,
            len(text_senders),
            len(text_receivers),
            len(file_senders),
            len(file_receivers),
            len(senders),
            len(receivers),
            len(senders | receivers),
            trailing_week_actives(day, active_by_day),
            len(bucket["whales"]),
            bucket["ext_saves"],
            bucket["cli_saves"],
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

    existing_by_date: Dict[str, Tuple[int, List[object]]] = {}
    # Append after the last row that actually holds a date, not after the last
    # row the API returns - a fill-down formula in a column to the right would
    # otherwise push new rows hundreds of rows down the sheet.
    last_data_row = 1
    for row_number, row in enumerate(existing_rows[1:], start=2):
        if not row:
            continue
        day = str(row[0]).strip()
        if not day:
            continue
        last_data_row = row_number
        if day in existing_by_date:
            warn(
                f"Duplicate date {day} in tab {title}; updating first occurrence only."
            )
            continue
        existing_by_date[day] = (row_number, list(row))

    updates = []
    new_rows: List[List[object]] = []

    for row in current_log_rows:
        day = str(row[0])
        existing_row_number, existing_row = existing_by_date.get(day, (None, []))
        padded_row = pad_row(row, column_count, existing_row)
        if existing_row_number is None:
            new_rows.append(padded_row)
        else:
            updates.append({
                "range": f"{title}!A{existing_row_number}:{column_end}{existing_row_number}",
                "values": [padded_row],
            })

    changed_row_count = len(updates) + len(new_rows)

    # The merge path used to leave row 1 untouched, so a new column landed in
    # the sheet without a label. Rewrite the header whenever it drifted.
    padded_header = pad_row(header, column_count)
    existing_header = pad_row(existing_rows[0] if existing_rows else [], column_count)
    if [str(cell) for cell in existing_header[:column_count]] != [
        str(cell) for cell in padded_header
    ]:
        updates.append({
            "range": f"{title}!A1:{column_end}1",
            "values": [padded_header],
        })

    if new_rows:
        start_row = last_data_row + 1
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


def pad_row(
    row: Sequence[object],
    column_count: int,
    existing: Sequence[object] = (),
) -> List[object]:
    """Pad to width, carrying forward the sheet's own value for None cells.

    None means "not computable this run" (see trailing_week_actives), so the
    cell must keep whatever it already holds instead of being blanked.
    """
    padded: List[object] = []
    for index in range(max(len(row), column_count)):
        cell = row[index] if index < len(row) else ""
        if cell is None:
            cell = existing[index] if index < len(existing) else ""
        padded.append(cell)
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
