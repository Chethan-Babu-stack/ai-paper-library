# Chethan's AI Paper Library

A metadata-only collection of AI research papers read by **Chethan Babu**. Papers are grouped by topic, searchable, linked to their canonical arXiv or publisher page, and marked as done.

The source PDFs remain local. Only titles, authors, abstracts, links, categories, and reading status are published.

## Current collection

The workspace did not contain any AI papers when this repository was created. The three PDFs found elsewhere under `D:\self` were property/layout documents and were intentionally excluded.

## Add papers

1. Copy AI paper PDFs into `inbox/`.
2. Create a Python environment and install the PDF reader:

   ```powershell
   py -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   ```

3. Import metadata from Semantic Scholar:

   ```powershell
   .venv\Scripts\python scripts\import_papers.py
   ```

4. Review `papers.json`, then preview the site:

   ```powershell
   py -m http.server 8000
   ```

   Open `http://localhost:8000`.

The importer scans only PDF files, extracts a likely title, finds a reliable online record, requires an abstract and canonical link, checks for AI-related terms, and then categorizes the paper. Uncertain and non-AI matches are reported but not added.

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

