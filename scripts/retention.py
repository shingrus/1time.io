#!/usr/bin/env python3
"""
1time.io — sender retention analyzer.

Reads nginx access logs (plain + .gz, current + rotated), identifies
"unique senders" by SHA256(IP + UserAgent), and prints cohort retention.

A "sender" = anyone who did POST /api/saveSecret or POST /api/saveFile.

Usage:
    python3 retention.py /path/to/nxinx/logs/access.log*

Or:
    python3 retention.py                  # defaults to /var/log/nginx/1time.access.log*

Output:
    - Daily new-sender count
    - Cohort retention table (Day 0, 1, 3, 7, 14, 30)
    - Headline metrics: D1, D7, D30 average retention; total uniques; repeat ratio
"""

from __future__ import annotations

import gzip
import hashlib
import re
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from glob import glob
from pathlib import Path

# ---------- Config ----------
DEFAULT_GLOB = "/var/log/nginx/1time.access.log*"
SAVE_PATHS = ("/api/saveSecret", "/api/saveFile")
LOOKBACK_DAYS = 30
RETENTION_OFFSETS = (0, 1, 3, 7, 14, 30)

# Combined nginx log format: $remote_addr - $remote_user [$time_local] "$request" $status ...
LINE_RE = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+\S+\s+\[(?P<ts>[^\]]+)\]\s+"(?P<req>[^"]*)"\s+(?P<status>\d+)\s+\S+\s+"[^"]*"\s+"(?P<ua>[^"]*)"'
)

TS_FMT = "%d/%b/%Y:%H:%M:%S %z"


def open_log(path: Path):
    if path.suffix == ".gz":
        return gzip.open(path, "rt", errors="replace")
    return open(path, "r", errors="replace")


def user_id(ip: str, ua: str) -> str:
    """Stable per-(ip, user-agent) identifier. 12 hex chars is enough for cohorts."""
    h = hashlib.sha256(f"{ip}|{ua}".encode("utf-8", "replace")).hexdigest()
    return h[:12]


def parse_logs(paths: list[Path]) -> dict[str, set[str]]:
    """Return: {user_id: {YYYY-MM-DD, ...}} — set of dates they SAVED on."""
    sender_days: dict[str, set[str]] = defaultdict(set)
    total_lines = 0
    saves_seen = 0

    for p in paths:
        try:
            with open_log(p) as f:
                for line in f:
                    total_lines += 1
                    m = LINE_RE.match(line)
                    if not m:
                        continue
                    req = m.group("req")
                    if " " not in req:
                        continue
                    method, _, rest = req.partition(" ")
                    path, _, _ = rest.partition(" ")
                    if method != "POST":
                        continue
                    if not any(path.startswith(sp) for sp in SAVE_PATHS):
                        continue
                    if m.group("status") != "200":
                        continue
                    try:
                        ts = datetime.strptime(m.group("ts"), TS_FMT)
                    except ValueError:
                        continue
                    uid = user_id(m.group("ip"), m.group("ua"))
                    sender_days[uid].add(ts.strftime("%Y-%m-%d"))
                    saves_seen += 1
        except Exception as e:  # noqa: BLE001
            print(f"warning: failed to read {p}: {e}", file=sys.stderr)

    print(f"# scanned {total_lines:,} lines across {len(paths)} files", file=sys.stderr)
    print(f"# {saves_seen:,} successful saves found", file=sys.stderr)
    return sender_days


def cohort_table(sender_days: dict[str, set[str]]) -> None:
    # Build cohort: first-save date for each user
    first_seen: dict[str, str] = {uid: min(days) for uid, days in sender_days.items()}

    # Pick last LOOKBACK_DAYS days as cohorts
    all_dates = sorted({d for days in sender_days.values() for d in days})
    if not all_dates:
        print("no save events found")
        return
    last_date = datetime.strptime(all_dates[-1], "%Y-%m-%d")
    cohort_start = last_date - timedelta(days=LOOKBACK_DAYS - 1)

    cohorts: dict[str, list[str]] = defaultdict(list)  # date -> [uids]
    for uid, first in first_seen.items():
        d = datetime.strptime(first, "%Y-%m-%d")
        if d < cohort_start:
            continue
        cohorts[first].append(uid)

    # Print daily new senders
    print("\n# daily new senders")
    print(f"{'date':<12} {'new':>6} {'total':>7}")
    cumulative = 0
    for date in sorted(cohorts.keys()):
        cumulative += len(cohorts[date])
        print(f"{date:<12} {len(cohorts[date]):>6} {cumulative:>7}")

    # Cohort retention table
    print(f"\n# cohort retention table — % of new senders returning N days later")
    header = f"{'cohort':<12} {'size':>5}  " + "  ".join(f"D{n:>2}" for n in RETENTION_OFFSETS)
    print(header)
    print("-" * len(header))

    d1_pcts, d7_pcts, d30_pcts = [], [], []

    for date in sorted(cohorts.keys()):
        uids = cohorts[date]
        size = len(uids)
        if size == 0:
            continue
        cohort_dt = datetime.strptime(date, "%Y-%m-%d")
        row = f"{date:<12} {size:>5}  "
        for offset in RETENTION_OFFSETS:
            target = (cohort_dt + timedelta(days=offset)).strftime("%Y-%m-%d")
            target_dt = cohort_dt + timedelta(days=offset)
            # Skip if target is in the future (no data yet)
            if target_dt.date() > last_date.date():
                row += "  -- "
                continue
            returned = sum(1 for u in uids if target in sender_days[u])
            pct = 100.0 * returned / size
            row += f"{pct:>4.0f}%"
            if offset == 1 and target_dt.date() <= last_date.date():
                d1_pcts.append(pct)
            elif offset == 7 and target_dt.date() <= last_date.date():
                d7_pcts.append(pct)
            elif offset == 30 and target_dt.date() <= last_date.date():
                d30_pcts.append(pct)
            row += " "
        print(row.rstrip())

    # Headline summary
    print("\n# headline metrics")
    if d1_pcts:
        print(f"  Day-1  retention (avg over {len(d1_pcts)} cohorts): {sum(d1_pcts)/len(d1_pcts):.1f}%")
    if d7_pcts:
        print(f"  Day-7  retention (avg over {len(d7_pcts)} cohorts): {sum(d7_pcts)/len(d7_pcts):.1f}%")
    if d30_pcts:
        print(f"  Day-30 retention (avg over {len(d30_pcts)} cohorts): {sum(d30_pcts)/len(d30_pcts):.1f}%")

    total_users = len(sender_days)
    repeat_users = sum(1 for days in sender_days.values() if len(days) > 1)
    print(f"\n  Unique senders ever:           {total_users:,}")
    print(f"  Repeat senders (>=2 days):     {repeat_users:,}  ({100*repeat_users/max(total_users,1):.1f}%)")
    if total_users:
        avg_days = sum(len(d) for d in sender_days.values()) / total_users
        print(f"  Average active days per user:  {avg_days:.2f}")


def main() -> int:
    args = sys.argv[1:]
    if not args:
        paths = [Path(p) for p in sorted(glob(DEFAULT_GLOB))]
    else:
        paths = []
        for a in args:
            paths.extend(Path(p) for p in sorted(glob(a)))
    if not paths:
        print(f"usage: {sys.argv[0]} <log-pattern...>", file=sys.stderr)
        return 1
    print(f"# reading {len(paths)} files: {[p.name for p in paths]}", file=sys.stderr)
    sender_days = parse_logs(paths)
    cohort_table(sender_days)
    return 0


if __name__ == "__main__":
    sys.exit(main())
