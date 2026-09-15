import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class UiTests(unittest.TestCase):
    def test_javascript_static_id_references_exist(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        javascript = (ROOT / "app.js").read_text(encoding="utf-8")
        element_ids = set(re.findall(r'id="([^"]+)"', html))
        referenced_ids = set(re.findall(r'querySelector\("#([A-Za-z0-9_-]+)"\)', javascript))
        self.assertEqual(referenced_ids - element_ids, set())

    def test_catalog_has_forty_complete_papers(self):
        data = json.loads((ROOT / "papers.json").read_text(encoding="utf-8"))
        self.assertEqual(len(data["papers"]), 40)
        self.assertTrue(all(paper.get("title") and paper.get("abstract") and paper.get("url") for paper in data["papers"]))


if __name__ == "__main__":
    unittest.main()
