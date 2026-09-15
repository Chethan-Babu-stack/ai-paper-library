import importlib.util
import sys
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "import_papers.py"
SPEC = importlib.util.spec_from_file_location("import_papers", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ImportPapersTests(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(MODULE.normalize("Vision–Language Models!"), "vision language models")

    def test_classifies_multimodal_paper(self):
        paper = {"title": "A Multimodal Vision-Language Model", "abstract": "Combines image and text."}
        self.assertEqual(MODULE.classify(paper), "Multimodality")

    def test_rejects_property_document(self):
        paper = {"title": "Residential Property Layout", "abstract": "Survey boundaries and plot dimensions."}
        self.assertFalse(MODULE.is_ai_paper(paper))

    def test_prefers_arxiv_url(self):
        paper = {"externalIds": {"ArXiv": "2401.01234", "DOI": "10.1/example"}}
        self.assertEqual(MODULE.canonical_url(paper), "https://arxiv.org/abs/2401.01234")


if __name__ == "__main__":
    unittest.main()
