# Historia — Rassegna quotidiana di Storia & Geopolitica

Sito statico che raccoglie automaticamente articoli da una lista di fonti selezionate
(The Economist, Foreign Affairs, World Politics Review, Al Jazeera, ECFR, History Today,
BBC History Extra, Smithsonian Magazine, The Conversation) e si aggiorna da solo ogni
giorno tramite GitHub Actions. Ospitato gratis su GitHub Pages.

## Come funziona

- `scripts/fetch-feeds.js` scarica i feed RSS/Atom, li normalizza e scrive `docs/data.json`.
- `.github/workflows/daily-update.yml` esegue quello script ogni giorno alle 06:00 UTC
  e pubblica automaticamente il file aggiornato.
- `docs/` contiene il sito statico (HTML/CSS/JS) che legge `data.json` e mostra gli articoli.

## Messa online (10 minuti, tutto gratuito)

### 1. Crea un repository su GitHub
Se non hai un account, creane uno gratis su [github.com](https://github.com).
Poi crea un nuovo repository (es. `dispaccio`), pubblico, senza inizializzarlo con README
(carichiamo noi tutti i file).

### 2. Carica questi file
Dalla cartella di questo progetto, nel terminale:

```bash
cd rss-aggregator
git init
git add .
git commit -m "Prima versione del sito"
git branch -M main
git remote add origin https://github.com/TUO-USERNAME/dispaccio.git
git push -u origin main
```

(Sostituisci `TUO-USERNAME` e `dispaccio` con i tuoi valori reali.)

Se non hai `git` o npm/Node installati sul tuo computer, puoi anche caricare i file
manualmente da browser: sulla pagina del repository, "Add file" → "Upload files",
trascina dentro tutta la cartella.

### 3. Attiva GitHub Pages
Nel repository su GitHub: **Settings → Pages**. Sotto "Build and deployment",
scegli **Deploy from a branch**, branch `main`, cartella `/docs`. Salva.
Dopo un minuto il sito sarà visibile a `https://TUO-USERNAME.github.io/dispaccio/`.

### 4. Lancia il primo aggiornamento manuale
Il workflow gira automaticamente ogni giorno, ma per popolare subito il sito con dati veri
(invece del placeholder vuoto): vai su **Actions** in alto nel repository, seleziona
"Aggiornamento quotidiano feed" nella lista a sinistra, clicca **Run workflow → Run workflow**.
Dopo 30-60 secondi ricarica il sito: dovresti vedere gli articoli.

Da qui in poi si aggiorna da solo ogni mattina, senza che tu debba fare nulla.

## Modificare le fonti

Apri `scripts/fetch-feeds.js` e modifica l'array `FEEDS` in cima al file: puoi
aggiungere, togliere o cambiare l'URL di un feed. Ogni fonte ha un `name`, una
`category` (Geopolitica o Storia — o una categoria nuova, se aggiorni anche il
filtro nell'HTML) e un `url`.

Se un feed smette di funzionare (il sito ha cambiato indirizzo, ecc.), lo script
non si blocca: salta semplicemente quella fonte e lo segnala nei log del workflow
(tab Actions → l'ultima esecuzione → log dello step "Fetch feeds").

## Sviluppo locale

```bash
npm install
node scripts/fetch-feeds.js   # genera docs/data.json con dati reali
npx serve docs                # oppure apri semplicemente docs/index.html nel browser
```
