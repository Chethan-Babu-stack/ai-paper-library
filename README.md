# Chethan's AI Paper Library

A metadata-only collection of AI research papers read by **Chethan Babu**. Papers are grouped by topic, searchable, linked to their canonical arXiv or publisher page, and marked as done.

The source PDFs remain local. Only titles, authors, abstracts, links, categories, and reading status are published.

## Current collection

The catalog currently contains **40 unique AI research papers** imported recursively from `C:\Users\cheth\Desktop\papers`. Duplicate copies are merged by arXiv identity, directories named `Ignore` are skipped, and non-paper material is excluded through `paper-overrides.json`.

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

## Maintenance

```powershell
git add papers.json
git commit -m "Add newly read papers"
git push
```

Pushing to `main` updates the published site automatically after GitHub Pages is enabled.
