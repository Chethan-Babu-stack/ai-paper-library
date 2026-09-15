#!/usr/bin/env python3
"""Build papers.json from local AI-paper PDFs and Semantic Scholar metadata."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from difflib import SequenceMatcher
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INBOX = ROOT / "inbox"
DEFAULT_OUTPUT = ROOT / "papers.json"
API_URL = "https://api.semanticscholar.org/graph/v1/paper/search"
FIELDS = "title,abstract,url,externalIds,fieldsOfStudy,publicationDate,year,authors,venue"

CATEGORY_TERMS = {
    "Multimodality": ("multimodal", "vision-language", "vision language", "vlm", "visual question", "image-text"),
    "Text & Language": ("language model", "nlp", "natural language", "text generation", "translation", "token"),
    "Images & Vision": ("computer vision", "image", "visual", "segmentation", "object detection", "nerf"),
    "Audio & Speech": ("audio", "speech", "acoustic", "voice", "speaker", "sound"),
    "Video": ("video", "temporal vision", "motion generation"),
    "Agents & Reasoning": ("agent", "reasoning", "chain-of-thought", "planning", "tool use", "reinforcement learning"),
    "Generative Models": ("diffusion", "generative", "gan", "flow matching", "variational autoencoder"),
    "ML Systems & Efficiency": ("quantization", "inference", "efficient", "compression", "distillation", "serving", "parallelism"),
    "Robotics & Embodied AI": ("robot", "embodied", "manipulation", "navigation", "autonomous driving"),
}

AI_TERMS = {
    term
    for terms in CATEGORY_TERMS.values()
    for term in terms
} | {
    "artificial intelligence", "machine learning", "deep learning", "neural network",
    "transformer", "attention mechanism", "foundation model", "representation learning",
}


@dataclass
class Candidate:
    path: Path
    title: str
    modified: str


def normalize(value: str) -> str:
    value = re.sub(r"[\u2010-\u2015]", " ", value)
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def clean_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip(" ._-")
    value = re.sub(r"^(arxiv|paper|preprint)\s*[:_-]?\s*", "", value, flags=re.I)
    return value


def plausible_title(value: str) -> bool:
    words = value.split()
    return 4 <= len(words) <= 30 and len(value) <= 240 and not value.lower().startswith(("abstract", "doi:", "http"))


def extract_candidate(path: Path) -> Candidate:
    if PdfReader is None:
        raise RuntimeError("pypdf is required. Run: python -m pip install -r requirements.txt")

    reader = PdfReader(str(path))
    metadata_title = clean_title(str(reader.metadata.title or "")) if reader.metadata else ""
    page_text = "\n".join((page.extract_text() or "") for page in reader.pages[:3])
    lines = [clean_title(line) for line in page_text.splitlines() if plausible_title(clean_title(line))]
    filename_title = clean_title(re.sub(r"[_-]+", " ", path.stem))

    if plausible_title(metadata_title) and normalize(metadata_title) not in {"untitled", "microsoft word"}:
        title = metadata_title
    elif lines:
        title = max(lines[:20], key=lambda line: (len(line.split()), len(line)))
    else:
        title = filename_title

    modified = datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
    return Candidate(path=path, title=title, modified=modified)


def api_search(title: str) -> list[dict]:
    query = urllib.parse.urlencode({"query": title, "limit": 5, "fields": FIELDS})
    request = urllib.request.Request(f"{API_URL}?{query}", headers={"User-Agent": "Chethan-AI-Paper-Library/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response).get("data", [])


def best_match(title: str, results: list[dict]) -> tuple[dict | None, float]:
    expected = normalize(title)
    ranked = [
        (SequenceMatcher(None, expected, normalize(item.get("title", ""))).ratio(), item)
        for item in results
    ]
    return (max(ranked, default=(0.0, None), key=lambda pair: pair[0])[1], max((score for score, _ in ranked), default=0.0))


def is_ai_paper(paper: dict) -> bool:
    text = normalize(" ".join([
        paper.get("title") or "",
        paper.get("abstract") or "",
        " ".join(paper.get("fieldsOfStudy") or []),
    ]))
    return any(term in text for term in AI_TERMS)


def classify(paper: dict) -> str:
    text = normalize(f"{paper.get('title') or ''} {paper.get('abstract') or ''}")
    scores = {
        category: sum(3 if term in normalize(paper.get("title") or "") else 1 for term in terms if term in text)
        for category, terms in CATEGORY_TERMS.items()
    }
    category, score = max(scores.items(), key=lambda item: item[1])
    return category if score else "Other AI"


def canonical_url(paper: dict) -> str:
    external = paper.get("externalIds") or {}
    if external.get("ArXiv"):
        return f"https://arxiv.org/abs/{external['ArXiv']}"
    if external.get("DOI"):
        return f"https://doi.org/{external['DOI']}"
    return paper.get("url") or ""


def paper_record(paper: dict, candidate: Candidate) -> dict:
    title = paper.get("title") or candidate.title
    identifier = re.sub(r"[^a-z0-9]+", "-", normalize(title)).strip("-")[:80]
    return {
        "id": identifier,
        "title": title,
        "authors": [author["name"] for author in paper.get("authors") or []],
        "year": paper.get("year"),
        "category": classify(paper),
        "abstract": html.unescape(re.sub(r"<[^>]+>", "", paper.get("abstract") or "")).strip(),
        "url": canonical_url(paper),
        "status": "Done",
        "dateRead": candidate.modified,
    }


def load_existing(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as handle:
        return json.load(handle).get("papers", [])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", nargs="?", type=Path, default=DEFAULT_INBOX, help="Folder containing PDFs")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Catalog JSON path")
    parser.add_argument("--include-all-matches", action="store_true", help="Include matched papers even if AI keywords are absent")
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without writing papers.json")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    pdfs = sorted(args.folder.rglob("*.pdf")) if args.folder.exists() else []
    if not pdfs:
        print(f"No PDFs found in {args.folder}")
        return 0

    existing = load_existing(args.output)
    records: list[dict] = []
    skipped: list[str] = []

    for index, path in enumerate(pdfs, start=1):
        try:
            candidate = extract_candidate(path)
            print(f"[{index}/{len(pdfs)}] Looking up: {candidate.title}")
            match, confidence = best_match(candidate.title, api_search(candidate.title))
            if not match or confidence < 0.68:
                skipped.append(f"{path.name}: no reliable online match ({confidence:.0%})")
            elif not args.include_all_matches and not is_ai_paper(match):
                skipped.append(f"{path.name}: matched, but does not appear to be an AI paper")
            elif not match.get("abstract") or not canonical_url(match):
                skipped.append(f"{path.name}: online record has no abstract or canonical link")
            else:
                records.append(paper_record(match, candidate))
            time.sleep(1.1)
        except (OSError, RuntimeError, urllib.error.URLError, ValueError) as error:
            skipped.append(f"{path.name}: {error}")

    merged = {paper.get("id") or normalize(paper.get("title", "")): paper for paper in existing}
    merged.update({paper["id"]: paper for paper in records})
    papers = sorted(merged.values(), key=lambda paper: (paper.get("category", ""), -(paper.get("year") or 0), paper.get("title", "")))

    if not args.dry_run:
        args.output.write_text(json.dumps({"papers": papers}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"\nAdded or updated: {len(records)}")
    print(f"Total cataloged: {len(papers)}")
    if skipped:
        print("Skipped:")
        for reason in skipped:
            print(f"  - {reason}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
