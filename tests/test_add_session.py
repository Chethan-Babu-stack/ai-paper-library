import importlib.util
import sys
import unittest
from datetime import date
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "add_session.py"
SPEC = importlib.util.spec_from_file_location("add_session", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class AddSessionTests(unittest.TestCase):
    def test_next_monday(self):
        self.assertEqual(MODULE.next_monday(date(2026, 9, 15)), date(2026, 9, 21))
        self.assertEqual(MODULE.next_monday(date(2026, 9, 21)), date(2026, 9, 28))

    def test_parse_link(self):
        self.assertEqual(
            MODULE.parse_link("Notes | https://example.com/notes"),
            {"label": "Notes", "url": "https://example.com/notes"},
        )


if __name__ == "__main__":
    unittest.main()

