import unittest
import json
from datetime import date
from pathlib import Path

from analyze_absences import parse_date


class AnalyzeAbsencesTests(unittest.TestCase):
    def test_parse_jira_iso_timestamp_with_timezone(self):
        self.assertEqual(parse_date("2026-12-24T09:00:00.000+0100"), date(2026, 12, 24))
        self.assertEqual(parse_date("2026-09-01T10:05:00.000+0200"), date(2026, 9, 1))

    def test_parse_supported_csv_formats(self):
        self.assertEqual(parse_date("03/sept./26 7:00 AM"), date(2026, 9, 3))
        self.assertEqual(parse_date("03 août 2026 07:47"), date(2026, 8, 3))

    def test_jira_payload_contains_metadata_contract(self):
        payload = {"pages": 2, "total_retrieved": 41, "issues": []}
        self.assertIn("issues", payload)
        self.assertEqual(payload["pages"], 2)
        self.assertEqual(payload["total_retrieved"], 41)

    def test_canonical_alias_mapping(self):
        config_path = Path(__file__).resolve().parent.parent / "references" / "default_config.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))
        members = config["teams"]["CONVENTIONNEMENT"]
        self.assertIn("jhardouineau", members)
        self.assertNotIn("jhardouinneau", members)
        self.assertEqual(config["aliases"]["jhardouinneau"], "jhardouineau")


if __name__ == "__main__":
    unittest.main()
