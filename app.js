const STORAGE_KEY = "chethan-ai-library-progress-v1";
const PROPOSAL_EMAIL = "chethan1512@gmail.com";
const VIEW_LABELS = {
  all: "All papers",
  datasets: "Open datasets",
  sessions: "Monday sessions",
  starred: "Starred papers",
  recent: "Read recently",
};
const requestedView = new URLSearchParams(window.location.search).get("view");

const state = {
  papers: [],
  datasets: [],
  sessionsData: { schedule: {}, sessions: [] },
  progress: loadProgress(),
  view: Object.hasOwn(VIEW_LABELS, requestedView) ? requestedView : "all",
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
  return state.progress[paperId] || { starred: false, notes: "" };
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
      || (state.view === "starred" && progress.starred)
      || (state.view === "recent" && isRecent(paper));
    return matchesSearch && matchesTopic && matchesView;
  });

  return visible.sort((left, right) => {
    if (state.sort === "publication-desc") return (right.year || 0) - (left.year || 0) || left.title.localeCompare(right.title);
    if (state.sort === "title-asc") return left.title.localeCompare(right.title);
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
  const starred = state.papers.filter((paper) => progressFor(paper.id).starred).length;
  const recent = state.papers.filter(isRecent).length;
  document.querySelector("#library-total").textContent = `${state.papers.length} papers`;
  document.querySelector("#library-topics").textContent = `${topics.length} active topics`;
  document.querySelector("#all-count").textContent = state.papers.length;
  document.querySelector("#dataset-count").textContent = state.datasets.length;
  document.querySelector("#session-count").textContent = state.sessionsData.sessions.length;
  document.querySelector("#starred-count").textContent = starred;
  document.querySelector("#recent-count").textContent = recent;
  document.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === state.view && !state.topic));
  document.querySelector(".topic-nav").hidden = ["datasets", "sessions"].includes(state.view);

  document.querySelector("#topic-list").innerHTML = topics.map((topic) => {
    const count = state.papers.filter((paper) => paper.category === topic).length;
    return `<button class="topic-item${state.topic === topic ? " active" : ""}" data-topic="${escapeHtml(topic)}" type="button"><span>${escapeHtml(topic)}</span><b>${count}</b></button>`;
  }).join("");
}

function configureListView(title, summary, columns, showSort) {
  document.querySelector("#view-context").textContent = title;
  document.querySelector("#view-title").textContent = title;
  document.querySelector("#result-summary").textContent = summary;
  const labels = document.querySelector(".column-labels");
  labels.hidden = false;
  labels.classList.toggle("dataset-columns", state.view === "datasets");
  labels.classList.toggle("session-columns", state.view === "sessions");
  [...labels.children].forEach((element, index) => { element.textContent = columns[index] || ""; });
  document.querySelector(".sort-control").hidden = !showSort;
  document.querySelector("#search").placeholder = state.view === "datasets"
    ? "Search datasets, modalities, or maintainers"
    : "Search sessions, papers, or links";
}

function matchingDatasets() {
  const query = state.query.toLowerCase();
  return state.datasets.filter((dataset) => {
    const searchable = `${dataset.name} ${dataset.category} ${dataset.maintainedBy} ${dataset.description} ${(dataset.modalities || []).join(" ")}`.toLowerCase();
    return !query || searchable.includes(query);
  }).sort((left, right) => left.name.localeCompare(right.name));
}

function renderDatasets() {
  const datasets = matchingDatasets();
  if (!datasets.some((dataset) => dataset.id === state.selectedId)) state.selectedId = datasets[0]?.id || null;
  configureListView("Open datasets", `${datasets.length} curated research datasets${state.query ? ` matching “${state.query}”` : ""}`, ["Dataset", "Area", "License"], false);
  document.querySelector("#paper-list").innerHTML = datasets.map((dataset) => `<article class="resource-row${state.selectedId === dataset.id ? " selected" : ""}" data-dataset-id="${escapeHtml(dataset.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(dataset.name)}">
    <div>
      <h2>${escapeHtml(dataset.name)}</h2>
      <p class="resource-owner">Maintained by ${escapeHtml(dataset.maintainedBy)}</p>
      <p class="resource-description">${escapeHtml(dataset.description)}</p>
      <div class="resource-tags">${(dataset.modalities || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </div>
    <span class="resource-category">${escapeHtml(dataset.category)}</span>
    <span class="resource-license">${escapeHtml(dataset.license)}</span>
  </article>`).join("");
  document.querySelector("#empty-state").hidden = datasets.length !== 0;
  renderDatasetDetail();
}

function renderDatasetDetail() {
  const dataset = state.datasets.find((item) => item.id === state.selectedId);
  const panel = document.querySelector("#paper-detail");
  if (!dataset) {
    panel.innerHTML = `<div class="detail-placeholder"><p>Select a dataset to review its access and license notes.</p></div>`;
    return;
  }
  panel.innerHTML = `<div class="detail-content">
    <div class="detail-topline"><span class="detail-label">Dataset details</span><button class="mobile-close" data-action="close-detail" type="button" aria-label="Close details">×</button></div>
    <h2>${escapeHtml(dataset.name)}</h2>
    <p class="detail-authors">Maintained by ${escapeHtml(dataset.maintainedBy)}</p>
    <div class="detail-meta"><span>${escapeHtml(dataset.category)}</span>${(dataset.modalities || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    <div class="paper-actions"><a class="open-paper" href="${escapeHtml(dataset.url)}" target="_blank" rel="noreferrer">Open dataset ↗</a></div>
    <section class="detail-section"><h3>What it contains</h3><p class="abstract-text">${escapeHtml(dataset.description)}</p></section>
    <section class="detail-section"><h3>License and access</h3><div class="review-box"><strong>${escapeHtml(dataset.license)}</strong><p>${escapeHtml(dataset.accessNote)}</p></div></section>
  </div>`;
}

function sessionPapers(session) {
  return (session.paperIds || []).map((id) => state.papers.find((paper) => paper.id === id || paper.arxivId === id)).filter(Boolean);
}

function matchingSessions() {
  const query = state.query.toLowerCase();
  return [...state.sessionsData.sessions].filter((session) => {
    const papers = sessionPapers(session);
    const searchable = `${session.title} ${session.notes || ""} ${papers.map((paper) => paper.title).join(" ")} ${(session.links || []).map((link) => link.label).join(" ")}`.toLowerCase();
    return !query || searchable.includes(query);
  }).sort((left, right) => right.date.localeCompare(left.date));
}

function sessionDateParts(value) {
  const date = parseDate(value);
  return {
    day: date ? String(date.getDate()).padStart(2, "0") : "—",
    month: date ? new Intl.DateTimeFormat("en", { month: "short" }).format(date) : "",
  };
}

function renderSessions() {
  const sessions = matchingSessions();
  if (!sessions.some((session) => session.id === state.selectedId)) state.selectedId = sessions[0]?.id || null;
  const schedule = state.sessionsData.schedule;
  configureListView("Monday sessions", `${schedule.weekday || "Monday"} at ${schedule.time || "16:00"} · ${schedule.timezone || "Europe/Berlin"}`, ["Date", "Session", "Resources"], false);
  document.querySelector("#paper-list").innerHTML = sessions.map((session) => {
    const date = sessionDateParts(session.date);
    const papers = sessionPapers(session);
    return `<article class="session-row${state.selectedId === session.id ? " selected" : ""}" data-session-id="${escapeHtml(session.id)}" tabindex="0" role="button" aria-label="View session ${escapeHtml(session.date)}">
      <div class="session-date"><strong>${date.day}</strong><span>${escapeHtml(date.month)}</span></div>
      <div class="session-main"><h2>${escapeHtml(session.title)}</h2><p>${papers.length ? escapeHtml(papers.map((paper) => paper.title).join(" · ")) : "Paper selection pending"}</p></div>
      <span class="session-counts">${papers.length} papers<br>${(session.links || []).length} useful links</span>
    </article>`;
  }).join("");
  document.querySelector("#empty-state").hidden = sessions.length !== 0;
  renderSessionDetail();
}

function renderSessionDetail() {
  const session = state.sessionsData.sessions.find((item) => item.id === state.selectedId);
  const panel = document.querySelector("#paper-detail");
  if (!session) {
    panel.innerHTML = `<div class="detail-placeholder"><p>Select a Monday session to view its papers and links.</p></div>`;
    return;
  }
  const papers = sessionPapers(session);
  const schedule = state.sessionsData.schedule;
  panel.innerHTML = `<div class="detail-content">
    <div class="detail-topline"><span class="detail-label">Journal club session</span><button class="mobile-close" data-action="close-detail" type="button" aria-label="Close details">×</button></div>
    <h2>${escapeHtml(session.title)}</h2>
    <p class="detail-authors">${escapeHtml(formatDate(session.date))} at ${escapeHtml(schedule.time || "16:00")} · ${escapeHtml(schedule.timezone || "Europe/Berlin")}</p>
    <div class="paper-actions"><button class="open-paper" data-action="open-import" type="button">Add papers or links</button></div>
    <a class="calendar-button" href="journal-club.ics" download>Add recurring event to calendar</a>
    <section class="detail-section"><h3>Papers</h3>${papers.length ? `<ul class="session-list">${papers.map((paper) => `<li><a href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">${escapeHtml(paper.title)} ↗</a></li>`).join("")}</ul>` : `<p class="session-empty">No paper assigned yet. Use the Monday planning command to add one by arXiv ID.</p>`}</section>
    <section class="detail-section"><h3>Useful links</h3>${(session.links || []).length ? `<ul class="session-list">${session.links.map((link) => `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)} ↗</a></li>`).join("")}</ul>` : `<p class="session-empty">No links added yet. Add slides, notes, code, datasets, or discussion material.</p>`}</section>
    ${session.notes ? `<section class="detail-section"><h3>Session note</h3><p class="abstract-text">${escapeHtml(session.notes)}</p></section>` : ""}
  </div>`;
}

function paperRow(paper) {
  const progress = progressFor(paper.id);
  const isPlanned = paper.status === "Planned";
  return `<article class="paper-row${state.selectedId === paper.id ? " selected" : ""}" data-paper-id="${escapeHtml(paper.id)}" tabindex="0" role="button" aria-label="View ${escapeHtml(paper.title)}">
    <div class="paper-main">
      <div class="paper-title-line">
        <button class="star-button${progress.starred ? " starred" : ""}" data-action="toggle-star" data-paper-id="${escapeHtml(paper.id)}" type="button" aria-label="${progress.starred ? "Remove star" : "Star paper"}">${progress.starred ? "★" : "☆"}</button>
        <h2>${escapeHtml(paper.title)}</h2>
      </div>
      <p class="paper-authors">${escapeHtml(authorSummary(paper.authors))}</p>
      <p class="paper-excerpt">${escapeHtml(paper.abstract)}</p>
      <div class="row-flags"><span class="status-pill${isPlanned ? " planned" : ""}">${isPlanned ? "Planned" : "✓ Read"}</span></div>
    </div>
    <span class="paper-topic">${escapeHtml(paper.category)}</span>
    <span class="paper-year">${escapeHtml(paper.year)}</span>
  </article>`;
}

function renderList() {
  if (state.view === "datasets") {
    renderDatasets();
    return;
  }
  if (state.view === "sessions") {
    renderSessions();
    return;
  }
  const papers = filteredPapers();
  if (!papers.some((paper) => paper.id === state.selectedId)) state.selectedId = papers[0]?.id || null;
  const context = state.topic || VIEW_LABELS[state.view];
  document.querySelector("#view-context").textContent = context;
  document.querySelector("#view-title").textContent = context;
  document.querySelector("#result-summary").textContent = `${papers.length} ${papers.length === 1 ? "paper" : "papers"}${state.query ? ` matching “${state.query}”` : ""}`;
  document.querySelector(".sort-control").hidden = false;
  const labels = document.querySelector(".column-labels");
  labels.hidden = false;
  labels.classList.remove("dataset-columns", "session-columns");
  document.querySelector("#search").placeholder = "Search title, author, or abstract";
  ["Paper", "Topic", "Year"].forEach((label, index) => { labels.children[index].textContent = label; });
  document.querySelector("#paper-list").innerHTML = papers.map(paperRow).join("");
  document.querySelector("#empty-state").hidden = papers.length !== 0;
  renderDetail();
}

function renderDetail() {
  const paper = state.papers.find((item) => item.id === state.selectedId);
  const panel = document.querySelector("#paper-detail");
  if (!paper) {
    panel.innerHTML = `<div class="detail-placeholder"><span aria-hidden="true">↖</span><p>Select a paper to view its abstract and notes.</p></div>`;
    return;
  }

  const progress = progressFor(paper.id);
  const readingStatus = paper.status === "Planned" ? "Planned" : `Read ${formatDate(paper.dateRead)}`;
  panel.innerHTML = `<div class="detail-content">
    <div class="detail-topline"><span class="detail-label">Paper details</span><button class="mobile-close" data-action="close-detail" type="button" aria-label="Close details">×</button></div>
    <h2>${escapeHtml(paper.title)}</h2>
    <p class="detail-authors">${escapeHtml(detailAuthorSummary(paper.authors))}</p>
    ${(paper.authors || []).length > 8 ? `<details class="all-authors"><summary>Show all ${paper.authors.length} authors</summary><p>${escapeHtml(paper.authors.join(", "))}</p></details>` : ""}
    <div class="detail-meta"><span>${escapeHtml(paper.category)}</span><span>${escapeHtml(paper.year)}</span><span>${escapeHtml(readingStatus)}</span><span>arXiv:${escapeHtml(paper.arxivId || "—")}</span></div>
    <div class="paper-actions">
      <a class="open-paper" href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">Open paper ↗</a>
      <button class="detail-star" data-action="toggle-star" data-paper-id="${escapeHtml(paper.id)}" type="button">${progress.starred ? "★ Starred" : "☆ Star"}</button>
    </div>
    <section class="detail-section">
      <h3>Abstract</h3>
      <p class="abstract-text">${escapeHtml(paper.abstract)}</p>
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

function selectDataset(datasetId) {
  state.selectedId = datasetId;
  document.querySelectorAll(".resource-row").forEach((row) => row.classList.toggle("selected", row.dataset.datasetId === datasetId));
  renderDatasetDetail();
  document.querySelector("#detail-panel").classList.add("open");
}

function selectSession(sessionId) {
  state.selectedId = sessionId;
  document.querySelectorAll(".session-row").forEach((row) => row.classList.toggle("selected", row.dataset.sessionId === sessionId));
  renderSessionDetail();
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

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function prepareProposalEmail(form) {
  const formData = new FormData(form);
  const title = String(formData.get("title") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  const body = [
    "Hi Chethan,",
    "",
    "I would like to propose this paper for the journal club:",
    "",
    `Title: ${title}`,
    `Link: ${url}`,
    ...(reason ? ["", "Why it may be useful:", reason] : []),
  ].join("\n");
  const mailto = `mailto:${PROPOSAL_EMAIL}?subject=${encodeURIComponent(`Paper proposal: ${title}`)}&body=${encodeURIComponent(body)}`;
  document.querySelector("#proposal-dialog").close();
  form.reset();
  showToast("Opening your email app…");
  window.location.href = mailto;
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
    if (state.view !== viewButton.dataset.view) state.selectedId = null;
    state.view = viewButton.dataset.view;
    state.topic = null;
    const viewUrl = state.view === "all" ? window.location.pathname : `${window.location.pathname}?view=${state.view}`;
    window.history.replaceState(null, "", viewUrl);
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
    if (action.dataset.action === "open-import") document.querySelector("#import-dialog").showModal();
    if (action.dataset.action === "open-proposal") document.querySelector("#proposal-dialog").showModal();
    if (action.dataset.action === "close-proposal") document.querySelector("#proposal-dialog").close();
    if (action.dataset.action === "copy-command") {
      await navigator.clipboard.writeText(document.querySelector(`#${action.dataset.copyTarget}`).textContent);
      showToast("Command copied.");
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
  const datasetRow = event.target.closest(".resource-row");
  if (datasetRow) selectDataset(datasetRow.dataset.datasetId);
  const sessionRow = event.target.closest(".session-row");
  if (sessionRow) selectSession(sessionRow.dataset.sessionId);
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
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".resource-row")) {
    event.preventDefault();
    selectDataset(event.target.dataset.datasetId);
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".session-row")) {
    event.preventDefault();
    selectSession(event.target.dataset.sessionId);
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

document.querySelector("#proposal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  prepareProposalEmail(event.currentTarget);
});

Promise.all(["papers.json", "datasets.json", "sessions.json"].map((url) => fetch(url).then((response) => {
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  return response.json();
})))
  .then(([paperData, datasetData, sessionData]) => {
    state.papers = paperData.papers || [];
    state.datasets = datasetData.datasets || [];
    state.sessionsData = sessionData;
    renderSidebar();
    renderList();
  })
  .catch((error) => {
    document.querySelector("#paper-list").innerHTML = `<p class="empty-state">Unable to load the catalog: ${escapeHtml(error.message)}</p>`;
  });
