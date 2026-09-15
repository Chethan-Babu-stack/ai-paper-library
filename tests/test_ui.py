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

    def test_no_automatic_paper_review_schedule(self):
        source = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in ("index.html", "app.js"))
        for phrase in ("ready for review", "review queue", "review due", "mark reviewed", "review_interval"):
            self.assertNotIn(phrase, source.lower())

    def test_header_has_no_plan_monday_action(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("Plan Monday", html)

    def test_paper_proposal_prepares_email(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        javascript = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn('id="proposal-form"', html)
        self.assertIn('data-action="open-proposal"', html)
        self.assertIn('const PROPOSAL_EMAIL = "chethan1512@gmail.com"', javascript)
        self.assertIn("mailto:${PROPOSAL_EMAIL}", javascript)

    def test_join_group_prepares_email_request(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        javascript = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertIn('data-action="open-join"', html)
        self.assertIn('id="join-form"', html)
        self.assertIn('name="email" type="email"', html)
        self.assertIn("prepareJoinRequestEmail", javascript)
        self.assertIn("Request to join paper reading group", javascript)

    def test_deployed_assets_are_cache_busted(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        javascript = (ROOT / "app.js").read_text(encoding="utf-8")
        self.assertRegex(html, r'href="styles\.css\?v=[^"]+"')
        self.assertRegex(html, r'src="app\.js\?v=[^"]+"')
        self.assertIn("?v=${DATA_VERSION}", javascript)

    def test_public_branding_names_both_maintainers(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("Lalith &amp; Chethan", html)
        self.assertIn("Lalith & Chethan", readme)
        self.assertNotIn("Chethan Babu", html)

    def test_journal_club_identity_mark(self):
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        self.assertIn('<span class="identity-mark" aria-hidden="true">JC</span>', html)

    def test_catalog_has_complete_papers(self):
        data = json.loads((ROOT / "papers.json").read_text(encoding="utf-8"))
        self.assertEqual(len(data["papers"]), 43)
        self.assertTrue(all(paper.get("title") and paper.get("abstract") and paper.get("url") for paper in data["papers"]))

    def test_september_session_has_variable_resolution_papers(self):
        data = json.loads((ROOT / "sessions.json").read_text(encoding="utf-8"))
        session = next(item for item in data["sessions"] if item["date"] == "2026-09-21")
        self.assertEqual(len(session["paperIds"]), 3)
        self.assertIn("flexivit-one-model-for-all-patch-sizes", session["paperIds"])
        self.assertIn("patch-n-pack-navit-a-vision-transformer-for-any-aspect-ratio-and-resolution", session["paperIds"])
        self.assertIn("resformer-scaling-vits-with-multi-resolution-training", session["paperIds"])

    def test_recent_monday_history(self):
        sessions = json.loads((ROOT / "sessions.json").read_text(encoding="utf-8"))["sessions"]
        papers_by_date = {session["date"]: session["paperIds"] for session in sessions}
        self.assertEqual(
            papers_by_date["2026-09-14"],
            ["siglip-2-multilingual-vision-language-encoders-with-improved-semantic-understand"],
        )
        self.assertEqual(
            papers_by_date["2026-09-07"],
            ["qwen2-vl-enhancing-vision-language-model-s-perception-of-the-world-at-any-resolu"],
        )
        self.assertEqual(
            papers_by_date["2026-08-31"],
            ["adarope-not-all-attention-heads-should-rotate-and-scale-equally"],
        )

    def test_dataset_catalog_has_required_fields(self):
        data = json.loads((ROOT / "datasets.json").read_text(encoding="utf-8"))
        self.assertEqual(len(data["datasets"]), 6)
        required = {"id", "name", "category", "modalities", "license", "url", "accessNote"}
        self.assertTrue(all(required <= dataset.keys() for dataset in data["datasets"]))

    def test_sessions_follow_monday_schedule(self):
        data = json.loads((ROOT / "sessions.json").read_text(encoding="utf-8"))
        self.assertEqual(data["schedule"]["weekday"], "Monday")
        self.assertEqual(data["schedule"]["time"], "16:00")
        self.assertEqual(data["schedule"]["timezone"], "Europe/Berlin")


if __name__ == "__main__":
    unittest.main()
