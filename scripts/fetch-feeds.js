// fetch-feeds.js
// Scarica i feed RSS/Atom configurati, li normalizza in un formato comune
// e scrive docs/data.json che il sito statico legge per mostrare gli articoli.
//
// Progettato per girare dentro GitHub Actions una volta al giorno.
// Se un feed fallisce (sito down, URL cambiato, ecc.) lo script NON si blocca:
// salta quel feed, lo segnala nel log e continua con gli altri.

const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");

const FEEDS = [
  // --- Geopolitica ---
  {
    name: "The Economist",
    category: "Geopolitica",
    url: "https://www.economist.com/international/rss.xml",
  },
  {
    name: "Foreign Affairs",
    category: "Geopolitica",
    url: "https://www.foreignaffairs.com/rss.xml",
  },
  {
    name: "World Politics Review",
    category: "Geopolitica",
    url: "https://www.worldpoliticsreview.com/feed",
  },
  {
    name: "Al Jazeera (World)",
    category: "Geopolitica",
    url: "https://www.aljazeera.com/xml/rss/all.xml",
  },
  {
    name: "European Council on Foreign Relations",
    category: "Geopolitica",
    url: "https://ecfr.eu/feed/",
  },
  // --- Storia ---
  {
    name: "History Today",
    category: "Storia",
    url: "https://www.historytoday.com/feed/rss.xml",
  },
  {
    name: "BBC History Extra",
    category: "Storia",
    url: "https://www.historyextra.com/feed/",
  },
  {
    name: "Smithsonian Magazine (Storia)",
    category: "Storia",
    url: "https://www.smithsonianmag.com/rss/history/",
  },
  {
    name: "The Conversation (Storia)",
    category: "Storia",
    url: "https://theconversation.com/uk/history/articles.atom",
  },
];

const MAX_ITEMS_PER_FEED = 15;
const MAX_AGE_DAYS = 30; // scarta articoli più vecchi di così, per non far crescere il file all'infinito
const FETCH_TIMEOUT_MS = 15000;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
});

function stripHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(str, max = 280) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; DailyBriefBot/1.0; +https://github.com/) daily-history-geopolitics-digest",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Normalizza un singolo elemento RSS <item> o Atom <entry> in un oggetto comune
function normalizeItem(raw, source) {
  // RSS 2.0
  let title = raw.title;
  let link = raw.link;
  let pubDate = raw.pubDate || raw.published || raw.updated;
  let description = raw.description || raw.summary || raw.content;

  // Atom: <title> può essere oggetto {#text}, <link> può essere attributo href
  if (title && typeof title === "object") title = title["#text"] ?? "";
  if (link && typeof link === "object") {
    link = link["@_href"] ?? (Array.isArray(link) ? link[0]?.["@_href"] : "") ?? "";
  }
  if (description && typeof description === "object") {
    description = description["#text"] ?? "";
  }

  title = stripHtml(title);
  description = truncate(stripHtml(description), 280);

  let date = null;
  if (pubDate) {
    const d = new Date(pubDate);
    if (!isNaN(d.getTime())) date = d.toISOString();
  }

  if (!title || !link) return null;

  return {
    title,
    link: String(link).trim(),
    description,
    date,
    source: source.name,
    category: source.category,
  };
}

function extractItems(xmlText) {
  const data = parser.parse(xmlText);

  // RSS 2.0: rss.channel.item
  const rssItems = data?.rss?.channel?.item;
  if (rssItems) return Array.isArray(rssItems) ? rssItems : [rssItems];

  // RDF (es. alcuni feed vecchi): rdf:RDF.item
  const rdfItems = data?.["rdf:RDF"]?.item;
  if (rdfItems) return Array.isArray(rdfItems) ? rdfItems : [rdfItems];

  // Atom: feed.entry
  const atomItems = data?.feed?.entry;
  if (atomItems) return Array.isArray(atomItems) ? atomItems : [atomItems];

  return [];
}

async function fetchFeed(source) {
  try {
    const xml = await fetchWithTimeout(source.url, FETCH_TIMEOUT_MS);
    const rawItems = extractItems(xml).slice(0, MAX_ITEMS_PER_FEED);
    const items = rawItems
      .map((raw) => normalizeItem(raw, source))
      .filter(Boolean);
    console.log(`✔ ${source.name}: ${items.length} articoli`);
    return { ok: true, items };
  } catch (err) {
    console.warn(`✘ ${source.name} (${source.url}): ${err.message}`);
    return { ok: false, items: [], error: err.message };
  }
}

async function main() {
  console.log(`Aggiornamento feed — ${new Date().toISOString()}`);

  const results = await Promise.all(FEEDS.map(fetchFeed));

  const allItems = results.flatMap((r) => r.items);

  // Scarta articoli troppo vecchi (se hanno una data valida) ed elimina duplicati per link
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const seenLinks = new Set();
  const cleaned = [];
  for (const item of allItems) {
    if (item.date && new Date(item.date).getTime() < cutoff) continue;
    if (seenLinks.has(item.link)) continue;
    seenLinks.add(item.link);
    cleaned.push(item);
  }

  // Ordina dal più recente; articoli senza data vanno in fondo
  cleaned.sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date) - new Date(a.date);
  });

  const feedStatus = FEEDS.map((source, i) => ({
    name: source.name,
    category: source.category,
    ok: results[i].ok,
    error: results[i].error || null,
    count: results[i].items.length,
  }));

  const output = {
    generatedAt: new Date().toISOString(),
    articles: cleaned,
    feedStatus,
  };

  const outPath = path.join(__dirname, "..", "docs", "data.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nScritti ${cleaned.length} articoli totali in ${outPath}`);

  const failed = feedStatus.filter((f) => !f.ok);
  if (failed.length) {
    console.log(`Attenzione: ${failed.length} feed non hanno risposto correttamente:`);
    failed.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
  }
}

main().catch((err) => {
  console.error("Errore fatale:", err);
  process.exit(1);
});
