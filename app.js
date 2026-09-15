const CATEGORY_ORDER = [
  "Multimodality",
  "Text & Language",
  "Images & Vision",
  "Audio & Speech",
  "Video",
  "Agents & Reasoning",
  "Generative Models",
  "ML Systems & Efficiency",
  "Robotics & Embodied AI",
  "Other AI",
];

const state = { papers: [], category: "All", query: "" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]);
}

function paperCard(paper) {
  const authors = Array.isArray(paper.authors) ? paper.authors.join(", ") : paper.authors;
  return `
    <article class="paper">
      <div class="paper-year">${escapeHtml(String(paper.year || "—"))}</div>
      <div>
        <h3>${escapeHtml(paper.title)}</h3>
        <p class="authors">${escapeHtml(authors || "Authors unavailable")}</p>
        <p class="abstract">${escapeHtml(paper.abstract || "Abstract unavailable.")}</p>
        <span class="done">✓ ${escapeHtml(paper.status || "Done")}</span>
      </div>
      <div class="paper-actions">
        <button class="toggle-abstract" type="button">More</button>
        <a class="paper-link" href="${escapeHtml(paper.url)}" target="_blank" rel="noreferrer">Paper ↗</a>
      </div>
    </article>`;
}

function render() {
  const query = state.query.toLowerCase();
  const visible = state.papers.filter((paper) => {
    const inCategory = state.category === "All" || paper.category === state.category;
    const text = `${paper.title} ${paper.abstract} ${(paper.authors || []).toString()}`.toLowerCase();
    return inCategory && text.includes(query);
  });

  const grouped = Map.groupBy
    ? Map.groupBy(visible, (paper) => paper.category || "Other AI")
    : visible.reduce((map, paper) => {
        const category = paper.category || "Other AI";
        map.set(category, [...(map.get(category) || []), paper]);
        return map;
      }, new Map());

  const orderedCategories = [...grouped.keys()].sort((a, b) => {
    const left = CATEGORY_ORDER.indexOf(a);
    const right = CATEGORY_ORDER.indexOf(b);
    return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
  });

  document.querySelector("#library").innerHTML = orderedCategories.map((category) => {
    const papers = grouped.get(category).sort((a, b) => (b.year || 0) - (a.year || 0));
    return `<section class="topic">
      <div class="topic-heading"><h2>${escapeHtml(category)}</h2><span>${papers.length} ${papers.length === 1 ? "paper" : "papers"}</span></div>
      ${papers.map(paperCard).join("")}
    </section>`;
  }).join("");

  document.querySelector("#empty-state").hidden = visible.length !== 0;
}

function renderFilters() {
  const categories = [...new Set(state.papers.map((paper) => paper.category || "Other AI"))];
  categories.sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
  document.querySelector("#filters").innerHTML = ["All", ...categories]
    .map((category) => `<button class="filter${category === "All" ? " active" : ""}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`)
    .join("");
}

function renderStats() {
  const years = state.papers.map((paper) => Number(paper.year)).filter(Boolean);
  document.querySelector("#paper-count").textContent = state.papers.length;
  document.querySelector("#category-count").textContent = new Set(state.papers.map((paper) => paper.category)).size;
  document.querySelector("#year-range").textContent = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "—";
}

document.addEventListener("click", (event) => {
  const filter = event.target.closest(".filter");
  if (filter) {
    state.category = filter.dataset.category;
    document.querySelectorAll(".filter").forEach((button) => button.classList.toggle("active", button === filter));
    render();
  }

  const toggle = event.target.closest(".toggle-abstract");
  if (toggle) {
    const abstract = toggle.closest(".paper").querySelector(".abstract");
    abstract.classList.toggle("expanded");
    toggle.textContent = abstract.classList.contains("expanded") ? "Less" : "More";
  }
});

document.querySelector("#search").addEventListener("input", (event) => {
  state.query = event.target.value.trim();
  render();
});

fetch("papers.json")
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load papers.json (${response.status})`);
    return response.json();
  })
  .then((data) => {
    state.papers = data.papers || [];
    renderFilters();
    renderStats();
    render();
  })
  .catch((error) => {
    document.querySelector("#library").innerHTML = `<p>Unable to load the catalog: ${escapeHtml(error.message)}</p>`;
  });
