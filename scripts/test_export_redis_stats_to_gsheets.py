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


if __name__ == "__main__":
    unittest.main()
