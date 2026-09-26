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


class BuildFeedbackRowsTest(unittest.TestCase):
    def test_parses_entries_and_skips_unreadable_ones(self):
        rows = exporter.build_feedback_rows([
            '{"at":"2026-09-14T10:00:00Z","src":"ready","v":"2","text":"Larger files"}',
            "not json",
            '{"at":"2026-09-14T10:01:00Z","src":"direct","v":"","text":"=SUM(A1)"}',
        ])

        self.assertEqual(rows[0], exporter.FEEDBACK_COLUMNS)
        self.assertEqual(
            [row[1:] for row in rows[1:]],
            [
                ["2026-09-14T10:00:00Z", "ready", "2", "Larger files"],
                ["2026-09-14T10:01:00Z", "direct", "", "=SUM(A1)"],
            ],
        )

    def test_same_second_entries_get_distinct_stable_keys(self):
        entries = [
            '{"at":"2026-09-14T10:00:00Z","src":"read","v":"1","text":"a"}',
            '{"at":"2026-09-14T10:00:00Z","src":"read","v":"1","text":"b"}',
        ]
        first = exporter.build_feedback_rows(entries)
        second = exporter.build_feedback_rows(entries)

        self.assertNotEqual(first[1][0], first[2][0])
        self.assertEqual([row[0] for row in first], [row[0] for row in second])

    def test_returns_only_headers_without_entries(self):
        self.assertEqual(exporter.build_feedback_rows([]), [exporter.FEEDBACK_COLUMNS])
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


if __name__ == "__main__":
    unittest.main()
