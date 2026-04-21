# LHG Fotballstatistikk

- **Frontend:** `public/` (HTML, CSS, JS)
- **Data:** `public/stats.json` (sjekkes inn i repo og oppdateres automatisk)
- **Lokal server:** `npm run dev` (Express for utvikling)

## Lokalt

```bash
npm install
npm run sync:data
npm run dev
```

Nettsiden leser **`/stats.json`** (statisk fil). Ingen Blob eller database er nødvendig.

## Deploy på Vercel

1. Push til GitHub og koble repo til [Vercel](https://vercel.com).
2. **Root / Output:** la Vercel bruke rotmappen; alt statisk ligger i `public/`.
3. Ingen miljøvariabler er påkrevd for å vise data.

## Daglig oppdatering (uten Blob)

[`.github/workflows/update-stats.yml`](.github/workflows/update-stats.yml) kjører **`npm run sync:data`** én gang per døgn (cron) og **committer `public/stats.json`** til repoet hvis noe er endret. Vercel deployer vanligvis automatisk på ny push.

Du kan også kjøre jobben manuelt under **Actions → Oppdater statistikk fra NFF → Run workflow**.

## NFF / scraping

Logikk ligger i `src/services/nffScraper.js`.

## Manuell sync lokalt

```bash
npm run sync:data
```

Deretter commit `public/stats.json` om du vil publisere med en gang.
