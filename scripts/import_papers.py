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
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover
    PdfReader = None


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INBOX = ROOT / "inbox"
DEFAULT_OUTPUT = ROOT / "papers.json"
DEFAULT_OVERRIDES = ROOT / "paper-overrides.json"
ARXIV_URL = "https://arxiv.org/abs/{}"
ARXIV_FALLBACK_URL = "https://export.arxiv.org/abs/{}"

CATEGORY_TERMS = {
    "Multimodality": (
        "multimodal", "vision-language", "vision language", "vision and language", "vlm",
        "visual question", "image-text", "image text", "image and text", "language image",
        "cross-modality", "cross modality", "cross-modal", "cross modal", "visiolinguistic",
        "natural language supervision",
    ),
    "Text & Language": (
        "language model", "nlp", "natural language", "text generation", "translation", "token",
        "rotary position", "rope", "long context",
    ),
    "Images & Vision": (
        "computer vision", "image", "images", "visual", "segmentation", "object detection", "detr",
        "whole slide", "pathology", "vision transformer", "visual recognition", "nerf",
    ),
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
    relative_path: str
    title: str
    modified: str
    arxiv_id: str | None


class ArxivPageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.authors: list[str] = []
        self.date = ""
        self.abstract = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "meta":
            return
        values = dict(attrs)
        name = values.get("name", "")
        prop = values.get("property", "")
        content = html.unescape(values.get("content", "")).strip()
        if name == "citation_title":
            self.title = content
        elif name == "citation_author":
            if "," in content:
                family, given = (part.strip() for part in content.split(",", 1))
                content = f"{given} {family}".strip()
            self.authors.append(content)
        elif name == "citation_date":
            self.date = content
        elif prop == "og:description":
            self.abstract = content


def normalize(value: str) -> str:
    value = re.sub(r"[\u2010-\u2015]", " ", value)
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def contains_term(text: str, term: str) -> bool:
    return f" {normalize(term)} " in f" {text} "


def clean_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip(" ._-")
    value = re.sub(r"^(arxiv|paper|preprint)\s*[:_-]?\s*", "", value, flags=re.I)
    return value


def plausible_title(value: str) -> bool:
    words = value.split()
    return 4 <= len(words) <= 30 and len(value) <= 240 and not value.lower().startswith(("abstract", "doi:", "http"))


def extract_candidate(path: Path, source_root: Path) -> Candidate:
    if PdfReader is None:
        raise RuntimeError("pypdf is required. Run: python -m pip install -r requirements.txt")

    reader = PdfReader(str(path))
    metadata_title = clean_title(str(reader.metadata.title or "")) if reader.metadata else ""
    page_text = "\n".join((page.extract_text() or "") for page in reader.pages[:3])
    lines = [clean_title(line) for line in page_text.splitlines() if plausible_title(clean_title(line))]
    filename_title = clean_title(re.sub(r"[_-]+", " ", path.stem))
    arxiv_matches = re.findall(
        r"(?:arXiv\s*:?\s*|arxiv\.org/(?:abs|pdf)/)(\d{4}\.\d{4,5})(?:v\d+)?",
        page_text,
        flags=re.I,
    )
    filename_match = re.fullmatch(r"(\d{4}\.\d{4,5})(?:v\d+)?", path.stem, flags=re.I)
    arxiv_id = arxiv_matches[0] if arxiv_matches else (filename_match.group(1) if filename_match else None)

    if plausible_title(metadata_title) and normalize(metadata_title) not in {"untitled", "microsoft word"}:
        title = metadata_title
    elif plausible_title(filename_title) and not re.match(r"^week\s+\d+", filename_title, flags=re.I):
        title = filename_title
    elif lines:
        title = lines[0]
    else:
        title = filename_title

    modified = datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()
    relative_path = path.relative_to(source_root).as_posix()
    return Candidate(path=path, relative_path=relative_path, title=title, modified=modified, arxiv_id=arxiv_id)


def arxiv_lookup(arxiv_id: str) -> dict:
    page = ""
    last_error: urllib.error.URLError | None = None
    for url_template in (ARXIV_URL, ARXIV_FALLBACK_URL):
        request = urllib.request.Request(
            url_template.format(arxiv_id),
            headers={"User-Agent": "Chethan-AI-Paper-Library/1.0 (mailto:chethan1512@gmail.com)"},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                page = response.read().decode("utf-8", errors="replace")
            break
        except urllib.error.URLError as error:
            last_error = error
    if not page and last_error:
        raise last_error
    parser = ArxivPageParser()
    parser.feed(page)
    if not parser.title or not parser.abstract:
        raise ValueError("arXiv page is missing title or abstract metadata")
    year_match = re.search(r"\d{4}", parser.date)
    return {
        "title": parser.title,
        "abstract": parser.abstract,
        "url": ARXIV_URL.format(arxiv_id),
        "externalIds": {"ArXiv": arxiv_id},
        "fieldsOfStudy": ["Computer Science"],
        "year": int(year_match.group()) if year_match else None,
        "authors": [{"name": author} for author in parser.authors],
    }


def is_ai_paper(paper: dict) -> bool:
    text = normalize(" ".join([
        paper.get("title") or "",
        paper.get("abstract") or "",
        " ".join(paper.get("fieldsOfStudy") or []),
    ]))
    return any(contains_term(text, term) for term in AI_TERMS)


def classify(paper: dict) -> str:
    title = normalize(paper.get("title") or "")
    text = normalize(f"{paper.get('title') or ''} {paper.get('abstract') or ''}")
    scores = {
        category: sum(
            3 if contains_term(title, term) else 1
            for term in {normalize(value) for value in terms}
            if contains_term(text, term)
        ) for category, terms in CATEGORY_TERMS.items()
    }
    category, score = max(scores.items(), key=lambda item: item[1])
    return category if score else "Other AI"


def paper_arxiv_id(paper: dict) -> str | None:
    external = paper.get("externalIds") or {}
    if external.get("ArXiv"):
        return external["ArXiv"]
    match = re.search(r"arxiv\.org/abs/(\d{4}\.\d{4,5})", paper.get("url", ""), flags=re.I)
    return match.group(1) if match else None


def curated_category(paper: dict, overrides: dict[str, str]) -> str:
    arxiv_id = paper_arxiv_id(paper)
    return overrides.get(arxiv_id, classify(paper))


def canonical_url(paper: dict) -> str:
    external = paper.get("externalIds") or {}
    if external.get("ArXiv"):
        return f"https://arxiv.org/abs/{external['ArXiv']}"
    if external.get("DOI"):
        return f"https://doi.org/{external['DOI']}"
    return paper.get("url") or ""


def paper_record(paper: dict, candidate: Candidate, category_overrides: dict[str, str]) -> dict:
    title = paper.get("title") or candidate.title
    identifier = re.sub(r"[^a-z0-9]+", "-", normalize(title)).strip("-")[:80]
    return {
        "id": identifier,
        "title": title,
        "authors": [author["name"] for author in paper.get("authors") or []],
        "year": paper.get("year"),
        "category": curated_category(paper, category_overrides),
        "abstract": html.unescape(re.sub(r"<[^>]+>", "", paper.get("abstract") or "")).strip(),
        "url": canonical_url(paper),
        "arxivId": paper_arxiv_id(paper),
        "status": "Done",
        "dateRead": candidate.modified,
    }


def load_existing(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as handle:
        return json.load(handle).get("papers", [])


def load_overrides(path: Path) -> dict:
    if not path.exists():
        return {"arxivIds": {}, "categories": {}, "exclude": {}}
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    return {
        "arxivIds": data.get("arxivIds", {}),
        "categories": data.get("categories", {}),
        "exclude": data.get("exclude", {}),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("folder", nargs="?", type=Path, default=DEFAULT_INBOX, help="Folder containing PDFs")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Catalog JSON path")
    parser.add_argument("--overrides", type=Path, default=DEFAULT_OVERRIDES, help="Curated IDs and exclusions JSON")
    parser.add_argument(
        "--exclude-dir",
        action="append",
        default=["Ignore"],
        help="Directory name to skip recursively (repeatable; default: Ignore)",
    )
    parser.add_argument("--include-all-matches", action="store_true", help="Include matched papers even if AI keywords are absent")
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without writing papers.json")
    parser.add_argument("--reclassify-only", action="store_true", help="Reclassify the existing catalog without scanning PDFs")
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    args = parse_args()
    if args.reclassify_only:
        papers = load_existing(args.output)
        overrides = load_overrides(args.overrides)
        for paper in papers:
            paper["arxivId"] = paper_arxiv_id(paper)
            paper["category"] = curated_category(paper, overrides["categories"])
        args.output.write_text(json.dumps({"papers": papers}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"Reclassified: {len(papers)}")
        return 0
    excluded_dirs = {name.casefold() for name in args.exclude_dir}
    pdfs = sorted(
        path
        for path in args.folder.rglob("*.pdf")
        if not any(part.casefold() in excluded_dirs for part in path.relative_to(args.folder).parts[:-1])
    ) if args.folder.exists() else []
    if not pdfs:
        print(f"No PDFs found in {args.folder}")
        return 0

    existing = load_existing(args.output)
    overrides = load_overrides(args.overrides)
    records: list[dict] = []
    skipped: list[str] = []
    cache: dict[str, dict] = {}

    for index, path in enumerate(pdfs, start=1):
        try:
            candidate = extract_candidate(path, args.folder)
            if candidate.relative_path in overrides["exclude"]:
                skipped.append(f"{candidate.relative_path}: {overrides['exclude'][candidate.relative_path]}")
                continue
            arxiv_id = overrides["arxivIds"].get(candidate.relative_path, candidate.arxiv_id)
            if not arxiv_id:
                skipped.append(f"{candidate.relative_path}: no arXiv identifier; needs manual review")
                continue
            print(f"[{index}/{len(pdfs)}] arXiv {arxiv_id}: {candidate.relative_path}")
            if arxiv_id not in cache:
                cache[arxiv_id] = arxiv_lookup(arxiv_id)
                time.sleep(0.35)
            match = cache[arxiv_id]
            if not args.include_all_matches and not is_ai_paper(match):
                skipped.append(f"{candidate.relative_path}: matched, but does not appear to be an AI paper")
            else:
                records.append(paper_record(match, candidate, overrides["categories"]))
        except (OSError, RuntimeError, urllib.error.URLError, ValueError) as error:
            skipped.append(f"{path.relative_to(args.folder).as_posix()}: {error}")

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
