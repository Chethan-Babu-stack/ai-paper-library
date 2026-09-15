# Chethan's AI Paper Library

A local-first research hub maintained by **Chethan Babu**. It tracks AI papers, personal notes, open datasets, and Monday reading sessions with their supporting links.

The source PDFs remain local. Only titles, authors, abstracts, links, categories, and reading status are published.

## Current collection

The catalog currently contains **40 completed papers** imported recursively from `C:\Users\cheth\Desktop\papers`, plus papers planned for upcoming Monday sessions. Duplicate copies are merged by arXiv identity, directories named `Ignore` are skipped, and non-paper material is excluded through `paper-overrides.json`.

## Add papers

1. Copy AI paper PDFs into `inbox/`.
2. Create a Python environment and install the PDF reader:

   ```powershell
   py -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   ```

3. Import canonical metadata from arXiv:

   ```powershell
   .venv\Scripts\python scripts\import_papers.py
   ```

   To import from the current desktop collection instead:

   ```powershell
   .venv\Scripts\python scripts\import_papers.py "C:\Users\cheth\Desktop\papers"
   ```

4. Review `papers.json`, then preview the site:

   ```powershell
   py -m http.server 8000
   ```

   Open `http://localhost:8000`.

## Use the research workspace

- Use the left pane for starred papers, recent reading, and topic collections.
- Open **Open datasets** to browse curated datasets by area, modality, maintainer, and license.
- Open **Monday sessions** to plan the weekly 16:00 Europe/Berlin reading event.
- Press `/` to focus search, then search across titles, authors, abstracts, and topics.
- Select a paper to read its full abstract, open arXiv, or add private notes.
- Notes and stars stay in browser storage. Use **Export progress** and **Restore progress** to move or back them up.

Use the same local port (`8000`) consistently because browser storage is tied to the site address. Local progress can be exported before moving to a published GitHub Pages URL.

## Plan Monday sessions

The recurring event is every Monday from 16:00–17:00 in `Europe/Berlin`. Download `journal-club.ics` from the Monday session view to add the recurrence to a calendar.

Create or update the next Monday session with a paper by catalog ID or arXiv ID:

```powershell
.venv\Scripts\python scripts\add_session.py --paper 2501.12948
```

Attach any number of useful links using `Label|URL`:

```powershell
.venv\Scripts\python scripts\add_session.py --paper 2501.12948 --link "Discussion notes|https://example.com/notes" --link "Related dataset|https://example.com/dataset"
```

The date defaults to the next Monday. Use `--date YYYY-MM-DD` to update a specific Monday. Session plans are stored in `sessions.json` and should be committed with the weekly paper update.

## Curate datasets

Open dataset records live in `datasets.json`. Each record includes a category, modalities, maintainer, license summary, access caution, description, and official URL. Review the official dataset card and source-data terms before using any dataset; “open” annotations do not always mean every underlying image or webpage has identical rights.

The importer scans only PDF files, recursively skips directories named `Ignore`, extracts embedded arXiv identifiers, fetches canonical metadata and abstracts directly from arXiv, checks for AI-related terms, and then categorizes the paper. Curated exceptions and non-paper exclusions live in `paper-overrides.json`. Additional directory names can be skipped with repeatable `--exclude-dir NAME` options.

## Categories

- Multimodality
- Text & Language
- Images & Vision
- Audio & Speech
- Video
- Agents & Reasoning
- Generative Models
- ML Systems & Efficiency
- Robotics & Embodied AI
- Other AI

Categories can be corrected directly in `papers.json` after import.

## Publish free with GitHub Pages

GitHub Pages is the recommended host: the repository and static site cost **$0/year** when the repository is public. A custom domain is optional and is the only likely yearly expense.

After creating an empty public GitHub repository named `ai-paper-library`:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/ai-paper-library.git
git push -u origin main
```

On GitHub, open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save. The site will be available at `https://YOUR-USERNAME.github.io/ai-paper-library/`.

## Data format

Each entry in `papers.json` follows this shape:

```json
{
  "id": "attention-is-all-you-need",
  "title": "Attention Is All You Need",
  "authors": ["Ashish Vaswani", "Noam Shazeer"],
  "year": 2017,
  "category": "Text & Language",
  "abstract": "...",
  "url": "https://arxiv.org/abs/1706.03762",
  "status": "Done",
  "dateRead": "2026-09-15"
}
```

Upcoming session papers use `"status": "Planned"` and `"dateRead": null` until they are completed.

## Maintenance

```powershell
git add papers.json
git commit -m "Add newly read papers"
git push
```

Pushing to `main` updates the published site automatically after GitHub Pages is enabled.
