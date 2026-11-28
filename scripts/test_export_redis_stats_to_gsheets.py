import unittest

import export_redis_stats_to_gsheets as exporter


class BuildViewsTotalRowsTest(unittest.TestCase):
    def test_combines_text_and_file_buckets_in_numeric_order(self):
        rows = exporter.build_views_total_rows(
            {"1": 8, "10": 2},
            {"1": 3, "5": 1},
        )

        self.assertEqual(
            rows,
            [
                [
                    "views",
                    "secrets",
                    "secrets_share_percent",
                    "files",
                    "files_share_percent",
                ],
                ["1", 8, 80.0, 3, 75.0],
                ["5", 0, 0.0, 1, 25.0],
                ["10", 2, 20.0, 0, 0.0],
            ],
        )

    def test_returns_only_headers_when_no_counters_exist(self):
        self.assertEqual(
            exporter.build_views_total_rows({}, {}),
            [[
                "views",
                "secrets",
                "secrets_share_percent",
                "files",
                "files_share_percent",
            ]],
        )


class BuildShareDailyRowsTest(unittest.TestCase):
    def test_request_shares_do_not_shift_the_tap_column(self):
        rows = exporter.build_daily_field_rows(
            {"20261122": {"tap": 3, "request": 2}},
            known_fields=exporter.SHARE_FIELDS,
            only_known=True,
        )
        self.assertEqual(rows, [["date", "tap"], ["20261122", 3]])


class FakeBatchUpdate:
    def __init__(self):
        self.calls = []

    def batchUpdate(self, **kwargs):
        self.calls.append(kwargs)
        return self

    def execute(self):
        return {}


class FakeSheetsService:
    def __init__(self):
        self.endpoint = FakeBatchUpdate()

    def spreadsheets(self):
        return self.endpoint


class DeleteSheetsTest(unittest.TestCase):
    def test_deletes_only_requested_existing_tabs(self):
        service = FakeSheetsService()

        deleted = exporter.delete_sheets(
            service,
            "spreadsheet-id",
            {
                "1time_views_total": 10,
                "1time_file_views_total": 11,
            },
            ["1time_file_views_total", "missing_tab"],
        )

        self.assertEqual(deleted, ["1time_file_views_total"])
        self.assertEqual(
            service.endpoint.calls,
            [{
                "spreadsheetId": "spreadsheet-id",
                "body": {
                    "requests": [
                        {"deleteSheet": {"sheetId": 11}},
                    ]
                },
            }],
        )

    def test_skips_api_call_when_legacy_tab_is_absent(self):
        service = FakeSheetsService()

        deleted = exporter.delete_sheets(
            service,
            "spreadsheet-id",
            {"1time_views_total": 10},
            ["1time_file_views_total"],
        )

        self.assertEqual(deleted, [])
        self.assertEqual(service.endpoint.calls, [])


class ChunkedUploadCountingTest(unittest.TestCase):
    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0"

    def line(self, target, status, size, hour="10"):
        return (
            f'10.0.0.1 - - [25/Sep/2026:{hour}:00:00 +0000] "POST {target} HTTP/2.0" '
            f'{status} {size} "-" "{self.UA}" host=1time.io'
        )

    def bucket_for(self, lines):
        bucket = exporter.new_day_bucket()
        for line in lines:
            exporter.accumulate_nginx_entry(bucket, exporter.parse_nginx_access_line(line))
        return bucket

    def test_counts_a_chunked_upload_once_on_its_finishing_line(self):
        chunk = "/api/saveFile?src=cli&u=AAAAAAAAAAAAAAAAAAAAAA&n=2&i="
        bucket = self.bucket_for([
            self.line(chunk + "0", 200, 15),
            self.line(chunk + "1", 499, 0),
            self.line(chunk + "1", 200, 48),
            self.line(chunk + "1", 200, 48),
        ])
        self.assertEqual(len(bucket["file_senders"]), 1)
        self.assertEqual(bucket["cli_saves"], 1)
        self.assertEqual(bucket["hours"][10]["file_saves"], 1)

    def test_an_unfinished_chunked_upload_is_not_a_send(self):
        bucket = self.bucket_for([
            self.line("/api/saveFile?u=BBBBBBBBBBBBBBBBBBBBBB&i=0&n=3", 200, 15),
        ])
        self.assertEqual(len(bucket["file_senders"]), 0)
        self.assertEqual(bucket["hours"], {})

    def test_single_request_uploads_count_as_before(self):
        bucket = self.bucket_for([
            self.line("/api/saveFile", 200, 48),
            self.line("/api/saveFile", 200, 48, hour="11"),
            self.line("/api/saveFile", 200, 30, hour="12"),
        ])
        self.assertEqual(len(bucket["file_senders"]), 1)
        self.assertEqual(bucket["hours"][10]["file_saves"], 1)
        self.assertEqual(bucket["hours"][11]["file_saves"], 1)
        self.assertNotIn(12, bucket["hours"])


class RequestMetricsTest(unittest.TestCase):
    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0"

    def line(self, target, status, size, ip, hour="10"):
        return (
            f'{ip} - - [25/Sep/2026:{hour}:00:00 +0000] "POST {target} HTTP/2.0" '
            f'{status} {size} "-" "{self.UA}" host=1time.io'
        )

    def bucket_for(self, lines):
        bucket = exporter.new_day_bucket()
        for line in lines:
            exporter.accumulate_nginx_entry(bucket, exporter.parse_nginx_access_line(line))
        return bucket

    def test_body_size_fingerprints(self):
        ok_create = len('{"status":"ok","newId":"' + "x" * 23 + '"}')
        self.assertEqual(ok_create, exporter.REQUEST_CREATED_BODY_SIZE)
        self.assertEqual(len('{"status":"exists","newId":"0"}'), 31)
        self.assertEqual(len('{"status":"error","newId":"0"}'), 30)
        for expires in (1, 604800):
            size = len('{"status":"ok","expiresIn":%d}' % expires)
            self.assertGreaterEqual(size, exporter.ANSWER_OK_MIN_BODY_SIZE)
        for failure in ("error", "no message", "wrong key", "retry"):
            size = len('{"status":"%s"}' % failure)
            self.assertLess(size, exporter.ANSWER_OK_MIN_BODY_SIZE)

    def test_new_metrics_count_only_successful_bodies(self):
        bucket = self.bucket_for([
            self.line("/api/request", 200, 49, "10.0.0.1"),
            self.line("/api/request", 200, 31, "10.0.0.2"),
            self.line("/api/request", 200, 30, "10.0.0.3"),
            self.line("/api/answer", 200, 31, "10.0.0.4"),
            self.line("/api/answer", 200, 23, "10.0.0.5"),
            self.line("/api/answer", 200, 18, "10.0.0.6"),
            self.line("/api/get?r=1", 200, 150, "10.0.0.7"),
            self.line("/api/get?r=1", 200, 72, "10.0.0.8"),
        ])
        self.assertEqual({ip for ip, _ in bucket["requesters"]}, {"10.0.0.1"})
        self.assertEqual({ip for ip, _ in bucket["answerers"]}, {"10.0.0.4"})
        self.assertEqual({ip for ip, _ in bucket["request_openers"]}, {"10.0.0.7"})
        hour = bucket["hours"][10]
        self.assertEqual((hour["requests"], hour["answers"], hour["request_opens"]), (1, 1, 1))

    def test_request_reads_are_not_text_receivers(self):
        bucket = self.bucket_for([
            self.line("/api/get?r=1", 200, 150, "10.0.0.1"),
            self.line("/api/get", 200, 150, "10.0.0.2"),
        ])
        self.assertEqual({ip for ip, _ in bucket["text_receivers"]}, {"10.0.0.2"})
        self.assertEqual({ip for ip, _ in bucket["request_openers"]}, {"10.0.0.1"})

    def test_actives_include_the_new_metrics_daily_and_hourly(self):
        bucket = self.bucket_for([
            self.line("/api/saveSecret", 200, 48, "10.0.0.1"),
            self.line("/api/request", 200, 49, "10.0.0.2"),
            self.line("/api/answer", 200, 31, "10.0.0.3", hour="11"),
            self.line("/api/get?r=1", 200, 150, "10.0.0.4", hour="11"),
        ])
        selected = {"2026-09-25": bucket}

        rows = exporter.build_sender_receiver_rows(selected)
        row = dict(zip(rows[0], rows[1]))
        self.assertEqual(row["dau"], 4)
        self.assertEqual(row["senders"], 1)
        self.assertEqual(row["receivers"], 0)
        self.assertEqual(rows[0][-3:], ["requesters", "answerers", "request_openers"])
        self.assertEqual(rows[1][-3:], [1, 1, 1])

        now = exporter.dt.datetime(2026, 9, 26, tzinfo=exporter.dt.timezone.utc)
        hourly = exporter.build_hourly_rows(selected, now=now)
        by_hour = {r[3]: dict(zip(hourly[0], r)) for r in hourly[1:]}
        self.assertEqual(by_hour[10]["actives"], 2)
        self.assertEqual(by_hour[11]["actives"], 2)
        self.assertEqual(by_hour[11]["dau_cum"], 4)
        self.assertEqual(by_hour[11]["requests_cum"], 1)
        self.assertEqual(by_hour[11]["answers_cum"], 1)
        self.assertEqual(by_hour[11]["request_opens_cum"], 1)


if __name__ == "__main__":
    unittest.main()
