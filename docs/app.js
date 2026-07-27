(function () {
  const dispatchEl = document.getElementById("dispatch");
  const lastUpdatedEl = document.getElementById("last-updated");
  const sourceSelect = document.getElementById("source-select");
  const categoryFiltersEl = document.getElementById("category-filters");

  let allArticles = [];
  let currentCategory = "all";
  let currentSource = "all";

  const dayFormatter = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFormatter = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });

  function dayKey(dateStr) {
    if (!dateStr) return "senza-data";
    const d = new Date(dateStr);
    return d.toISOString().slice(0, 10);
  }

  function formatDayLabel(key) {
    if (key === "senza-data") return "Data non disponibile";
    const d = new Date(key + "T00:00:00Z");
    const label = dayFormatter.format(d);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function render() {
    const filtered = allArticles.filter((a) => {
      if (currentCategory !== "all" && a.category !== currentCategory) return false;
      if (currentSource !== "all" && a.source !== currentSource) return false;
      return true;
    });

    if (filtered.length === 0) {
      dispatchEl.innerHTML = `<div class="empty-state">Nessun articolo trovato per questo filtro. Prova a cambiare categoria o fonte.</div>`;
      return;
    }

    const groups = new Map();
    for (const article of filtered) {
      const key = dayKey(article.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(article);
    }

    const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
      if (a === "senza-data") return 1;
      if (b === "senza-data") return -1;
      return b.localeCompare(a);
    });

    let html = "";
    for (const key of sortedKeys) {
      html += `<section class="day-group">`;
      html += `<p class="day-label">${formatDayLabel(key)}</p>`;
      for (const article of groups.get(key)) {
        const time = article.date ? timeFormatter.format(new Date(article.date)) : "";
        html += `
          <article class="entry">
            <div class="entry-meta">
              <span class="stamp category-${escapeHtml(article.category)}">${escapeHtml(article.category)}</span>
              <span class="entry-source">${escapeHtml(article.source)}</span>
              ${time ? `<span class="entry-time">${time}</span>` : ""}
            </div>
            <h2 class="entry-title"><a href="${escapeHtml(article.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title)}</a></h2>
            ${article.description ? `<p class="entry-desc">${escapeHtml(article.description)}</p>` : ""}
          </article>
        `;
      }
      html += `</section>`;
    }
    dispatchEl.innerHTML = html;
  }

  function populateSources() {
    const sources = Array.from(new Set(allArticles.map((a) => a.source))).sort();
    for (const source of sources) {
      const opt = document.createElement("option");
      opt.value = source;
      opt.textContent = source;
      sourceSelect.appendChild(opt);
    }
  }

  categoryFiltersEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    currentCategory = btn.dataset.category;
    categoryFiltersEl.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    render();
  });

  sourceSelect.addEventListener("change", () => {
    currentSource = sourceSelect.value;
    render();
  });

  fetch("data.json?_=" + Date.now())
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((data) => {
      allArticles = data.articles || [];
      const generated = data.generatedAt ? new Date(data.generatedAt) : null;
      lastUpdatedEl.textContent = generated
        ? "Ultimo aggiornamento: " + generated.toLocaleString("it-IT", { dateStyle: "long", timeStyle: "short" })
        : "";

      if (!data.generatedAt) {
        dispatchEl.innerHTML = `<div class="loading-state">Il sito è online, ma il primo aggiornamento non è ancora stato eseguito.<br>Vai su "Actions" nel repository GitHub e lancia manualmente "Aggiornamento quotidiano feed".</div>`;
        return;
      }

      populateSources();
      render();
    })
    .catch((err) => {
      dispatchEl.innerHTML = `<div class="error-state">Non riesco a caricare i dati (${escapeHtml(err.message)}). Se hai appena creato il sito, assicurati che il workflow GitHub Actions sia già stato eseguito almeno una volta.</div>`;
      lastUpdatedEl.textContent = "";
    });
})();
