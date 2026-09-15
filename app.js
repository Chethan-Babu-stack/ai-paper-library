const STORAGE_KEY = "chethan-ai-library-progress-v1";
const REVIEW_INTERVALS = [30, 90, 180, 365];
const VIEW_LABELS = {
  all: "All papers",
  due: "Review queue",
  starred: "Starred papers",
  recent: "Read recently",
};

const state = {
  papers: [],
  progress: loadProgress(),
  view: "all",
  topic: null,
  query: "",
  sort: "read-desc",
  selectedId: null,
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function progressFor(paperId) {
  return state.progress[paperId] || { starred: false, reviewCount: 0, lastReviewed: null, notes: "" };
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date) : "Not recorded";
}

function reviewInfo(paper) {
  const progress = progressFor(paper.id);
  const baseDate = parseDate(progress.lastReviewed) || parseDate(paper.dateRead) || new Date();
  const interval = REVIEW_INTERVALS[Math.min(progress.reviewCount || 0, REVIEW_INTERVALS.length - 1)];
  const dueDate = new Date(baseDate);
  dueDate.setDate(dueDate.getDate() + interval);
  const days = Math.ceil((dueDate - new Date()) / 86400000);
  let label = `Due ${formatDate(dueDate)}`;
  if (days < 0) label = `${Math.abs(days)}d overdue`;
  if (days === 0) label = "Due today";
  if (days === 1) label = "Due tomorrow";
  return { dueDate, days, isDue: days <= 0, label, interval };
}

function isRecent(paper) {
  const readDate = parseDate(paper.dateRead);
  if (!readDate) return false;
  return (new Date() - readDate) / 86400000 <= 90;
}

function filteredPapers() {
  const query = state.query.toLowerCase();
  const visible = state.papers.filter((paper) => {
    const progress = progressFor(paper.id);
    const searchable = `${paper.title} ${(paper.authors || []).join(" ")} ${paper.abstract} ${paper.category}`.toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesTopic = !state.topic || paper.category === state.topic;
    const matchesView = state.view === "all"
      || (state.view === "due" && reviewInfo(paper).isDue)
      || (state.view === "starred" && progress.starred)
      || (state.view === "recent" && isRecent(paper));
    return matchesSearch && matchesTopic && matchesView;
  });

  return visible.sort((left, right) => {
    if (state.sort === "publication-desc") return (right.year || 0) - (left.year || 0) || left.title.localeCompare(right.title);
    if (state.sort === "title-asc") return left.title.localeCompare(right.title);
    if (state.sort === "review-due") return reviewInfo(left).dueDate - reviewInfo(right).dueDate;
    return (parseDate(right.dateRead) || 0) - (parseDate(left.dateRead) || 0) || left.title.localeCompare(right.title);
  });
}

function authorSummary(authors) {
  if (!authors?.length) return "Authors unavailable";
  if (authors.length <= 3) return authors.join(", ");
  return `${authors.slice(0, 3).join(", ")} +${authors.length - 3}`;
}

function detailAuthorSummary(authors) {
  if (!authors?.length) return "Authors unavailable";
  if (authors.length <= 8) return authors.join(", ");
  return `${authors.slice(0, 8).join(", ")} +${authors.length - 8} more`;
}

function renderSidebar() {
  const topics = [...new Set(state.papers.map((paper) => paper.category))].sort();
  const due = state.papers.filter((paper) => reviewInfo(paper).isDue).length;
  const starred = state.papers.filter((paper) => progressFor(paper.id).starred).length;
  const recent = state.papers.filter(isRecent).length;
  document.querySelector("#library-total").textContent = `${state.papers.length} papers`;
  document.querySelector("#library-topics").textContent = `${topics.length} active topics`;
  document.querySelector("#all-count").textContent = state.papers.length;
  document.querySelector("#due-count").textContent = due;
  document.querySelector("#starred-count").textContent = starred;
  document.querySelector("#recent-count").textContent = recent;
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view && !state.topic));

  document.querySelector("#topic-list").innerHTML = topics.map((topic) => {
    const count = state.papers.filter((paper) => paper.category === topic).length;
    return `<button class="topic-item${state.topic === topic ? " active" : ""}" data-topic="${escapeHtml(topic)}" type="button"><span>${escapeHtml(topic)}</span><b>${count}</b></button>`;
  }).join("");
}

function paperRow(paper) {
  const progress = progressFor(paper.id);
  const review = reviewInfo(paper);
  return `<article class="paper-row${state.selectedId === paper.id ? " selected" : ""}" data-paper-id="${escapeHtml(paper.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(paper.title)}">
    <div class="paper-main">
      <div class="paper-title-line">
        <button class="star-button${progress.starred ? " starred" : ""}" data-action="toggle-star" data-paper-id="${escapeHtml(paper.id)}" type="button" aria-label="${progress.starred ? "Remove star" : "Star paper"}">${progress.starred ? "★" : "☆"}</button>
        <h2>${escapeHtml(paper.title)}</h2>
      </div>
      <p class="paper-authors">${escapeHtml(authorSummary(paper.authors))}</p>
      <p class="paper-excerpt">${escapeHtml(paper.abstract)}</p>
      <div class="row-flags"><span class="status-pill">✓ Read</span>${review.isDue ? `<span class="review-pill">${escapeHtml(review.label)}</span>` : ""}</div>
    </div>
    <span class="paper-topic">${escapeHtml(paper.category)}</span>
    <span class="paper-year">${escapeHtml(paper.year)}</span>
  </article>`;
}

function renderList() {
  const papers = filteredPapers();
  if (!papers.some((paper) => paper.id === state.selectedId)) state.selectedId = papers[0]?.id || null;
  const context = state.topic || VIEW_LABELS[state.view];
  document.querySelector("#view-context").textContent = context;
  document.querySelector("#view-title").textContent = context;
  document.querySelector("#result-summary").textContent = `${papers.length} ${papers.length === 1 ? "paper" : "papers"}${state.query ? ` matching “${state.query}”` : ""}`;
  document.querySelector("#paper-list").innerHTML = papers.map(paperRow).join("");
  document.querySelector("#empty-state").hidden = papers.length !== 0;
  renderDetail();
}

function renderDetail() {
  const paper = state.papers.find((item) => item.id === state.selectedId);
  const panel = document.querySelector("#paper-detail");
  if (!paper) {
    panel.innerHTML = `<div class="detail-placeholder"><span aria-hidden="true">↖</span><p>Select a paper to view its abstract and review notes.</p></div>`;
    return;
  }

  const progress = progressFor(paper.id);
  const review = reviewInfo(paper);
  panel.innerHTML = `<div class="detail-content">
    <div class="detail-topline"><span class="detail-label">Paper details</span><button class="mobile-close" data-action="close-detail" type="button" aria-label="Close details">×</button></div>
    <h2>${escapeHtml(paper.title)}</h2>
    <p class="detail-authors">${escapeHtml(detailAuthorSummary(paper.authors))}</p>
    ${(paper.authors || []).length > 8 ? `<details class="all-authors"><summary>Show all ${paper.authors.length} authors</summary><p>${escapeHtml(paper.authors.join(", "))}</p></details>` : ""}
    <div class="detail-meta"><span>${escapeHtml(paper.category)}</span><span>${escapeHtml(paper.year)}</span><span>Read ${escapeHtml(formatDate(paper.dateRead))}</span><span>arXiv:${escapeHtml(paper.arxivId || "—")}</span></div>
    <div class="paper-actions">
      <a class="open-paper" href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">Open paper ↗</a>
      <button class="detail-star" data-action="toggle-star" data-paper-id="${escapeHtml(paper.id)}" type="button">${progress.starred ? "★ Starred" : "☆ Star"}</button>
    </div>
    <section class="detail-section">
      <h3>Abstract</h3>
      <p class="abstract-text">${escapeHtml(paper.abstract)}</p>
    </section>
    <section class="detail-section">
      <h3>Revision</h3>
      <div class="review-box">
        <strong>${escapeHtml(review.label)}</strong>
        <p>${progress.lastReviewed ? `Last reviewed ${formatDate(progress.lastReviewed)} · ${progress.reviewCount} reviews` : `Read ${formatDate(paper.dateRead)} · first revision after ${review.interval} days`}</p>
        <button class="review-button" data-action="mark-reviewed" data-paper-id="${escapeHtml(paper.id)}" type="button">Mark reviewed today</button>
      </div>
    </section>
    <section class="detail-section">
      <h3>My notes</h3>
      <textarea class="notes-area" data-paper-id="${escapeHtml(paper.id)}" placeholder="Key idea, useful result, limitation, or question…">${escapeHtml(progress.notes || "")}</textarea>
      <div class="notes-help"><span>Saved automatically in this browser</span><span>${(progress.notes || "").length} characters</span></div>
    </section>
  </div>`;
}

function selectPaper(paperId) {
  state.selectedId = paperId;
  document.querySelectorAll(".paper-row").forEach((row) => row.classList.toggle("selected", row.dataset.paperId === paperId));
  renderDetail();
  document.querySelector("#detail-panel").classList.add("open");
}

function toggleStar(paperId) {
  const progress = { ...progressFor(paperId) };
  progress.starred = !progress.starred;
  state.progress[paperId] = progress;
  saveProgress();
  renderSidebar();
  renderList();
}

function markReviewed(paperId) {
  const progress = { ...progressFor(paperId) };
  progress.reviewCount = (progress.reviewCount || 0) + 1;
  progress.lastReviewed = new Date().toISOString().slice(0, 10);
  state.progress[paperId] = progress;
  saveProgress();
  renderSidebar();
  renderList();
  showToast("Review recorded. Next revision scheduled.");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function exportProgress() {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), progress: state.progress }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `ai-library-progress-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Progress backup downloaded.");
}

async function restoreProgress(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!data.progress || typeof data.progress !== "object") throw new Error("Invalid progress file");
    state.progress = { ...state.progress, ...data.progress };
    saveProgress();
    renderSidebar();
    renderList();
    showToast("Progress restored.");
  } catch (error) {
    showToast(error.message || "Could not restore progress.");
  }
}

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    state.view = viewButton.dataset.view;
    state.topic = null;
    renderSidebar();
    renderList();
    return;
  }

  const topicButton = event.target.closest("[data-topic]");
  if (topicButton) {
    state.topic = topicButton.dataset.topic;
    state.view = "all";
    renderSidebar();
    renderList();
    return;
  }

  const action = event.target.closest("[data-action]");
  if (action) {
    const paperId = action.dataset.paperId;
    if (action.dataset.action === "toggle-star") toggleStar(paperId);
    if (action.dataset.action === "mark-reviewed") markReviewed(paperId);
    if (action.dataset.action === "open-import") document.querySelector("#import-dialog").showModal();
    if (action.dataset.action === "copy-command") {
      await navigator.clipboard.writeText(document.querySelector("#import-command").textContent);
      showToast("Import command copied.");
    }
    if (action.dataset.action === "export-progress") exportProgress();
    if (action.dataset.action === "close-detail") document.querySelector("#detail-panel").classList.remove("open");
    if (action.dataset.action === "clear-filters") {
      state.view = "all"; state.topic = null; state.query = "";
      document.querySelector("#search").value = "";
      renderSidebar(); renderList();
    }
    return;
  }

  const row = event.target.closest(".paper-row");
  if (row) selectPaper(row.dataset.paperId);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    document.querySelector("#search").focus();
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".paper-row")) {
    event.preventDefault();
    selectPaper(event.target.dataset.paperId);
  }
  if (event.key === "Escape") document.querySelector("#detail-panel").classList.remove("open");
});

document.addEventListener("input", (event) => {
  if (event.target.id === "search") {
    state.query = event.target.value.trim();
    renderList();
  }
  if (event.target.matches(".notes-area")) {
    const progress = { ...progressFor(event.target.dataset.paperId), notes: event.target.value };
    state.progress[event.target.dataset.paperId] = progress;
    saveProgress();
    const count = event.target.closest(".detail-section").querySelector(".notes-help span:last-child");
    count.textContent = `${event.target.value.length} characters`;
  }
});

document.querySelector("#sort").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderList();
});

document.querySelector("#progress-file").addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) restoreProgress(file);
  event.target.value = "";
});

fetch("papers.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load papers.json (${response.status})`);
    return response.json();
  })
  .then((data) => {
    state.papers = data.papers || [];
    renderSidebar();
    renderList();
  })
  .catch((error) => {
    document.querySelector("#paper-list").innerHTML = `<p class="empty-state">Unable to load the catalog: ${escapeHtml(error.message)}</p>`;
  });
