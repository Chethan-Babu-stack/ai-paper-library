#!/usr/bin/env python3
"""Create or update a Monday journal-club session."""

from __future__ import annotations

import argparse
import json
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SESSIONS = ROOT / "sessions.json"
DEFAULT_PAPERS = ROOT / "papers.json"


def next_monday(today: date) -> date:
    days_ahead = (7 - today.weekday()) % 7
    return today + timedelta(days=days_ahead or 7)


def parse_link(value: str) -> dict[str, str]:
    if "|" not in value:
        raise argparse.ArgumentTypeError('Links must use "Label|https://example.com" format')
    label, url = (part.strip() for part in value.split("|", 1))
    parsed = urlparse(url)
    if not label or parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise argparse.ArgumentTypeError("Link label and valid HTTP(S) URL are required")
    return {"label": label, "url": url}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_paper_ids(values: list[str], papers_path: Path) -> list[str]:
    papers = load_json(papers_path).get("papers", [])
    resolved = []
    for value in values:
        match = next((paper for paper in papers if value in {paper.get("id"), paper.get("arxivId")}), None)
        if not match:
            raise ValueError(f"Paper not found by catalog ID or arXiv ID: {value}")
        resolved.append(match["id"])
    return resolved


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--date", type=date.fromisoformat, default=next_monday(date.today()), help="Session date (YYYY-MM-DD; defaults to next Monday)")
    parser.add_argument("--title", default="Weekly AI Paper Reading")
    parser.add_argument("--paper", action="append", default=[], help="Paper catalog ID or arXiv ID; repeatable")
    parser.add_argument("--link", action="append", type=parse_link, default=[], help='Useful link as "Label|URL"; repeatable')
    parser.add_argument("--notes", default="")
    parser.add_argument("--sessions", type=Path, default=DEFAULT_SESSIONS)
    parser.add_argument("--papers", type=Path, default=DEFAULT_PAPERS)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.date.weekday() != 0:
        raise ValueError(f"{args.date.isoformat()} is not a Monday")

    data = load_json(args.sessions)
    sessions = data.setdefault("sessions", [])
    paper_ids = resolve_paper_ids(args.paper, args.papers)
    session = next((item for item in sessions if item["date"] == args.date.isoformat()), None)
    if session is None:
        session = {
            "id": args.date.isoformat(),
            "date": args.date.isoformat(),
            "title": args.title,
            "paperIds": [],
            "links": [],
            "notes": args.notes,
        }
        sessions.append(session)

    session["title"] = args.title
    session["notes"] = args.notes or session.get("notes", "")
    session["paperIds"] = list(dict.fromkeys([*session.get("paperIds", []), *paper_ids]))
    existing_urls = {link["url"] for link in session.get("links", [])}
    links = list(session.get("links", []))
    for link in args.link:
        if link["url"] not in existing_urls:
            links.append(link)
            existing_urls.add(link["url"])
    session["links"] = links
    sessions.sort(key=lambda item: item["date"], reverse=True)
    args.sessions.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Updated {args.date.isoformat()}: {len(session['paperIds'])} papers, {len(session['links'])} links")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
