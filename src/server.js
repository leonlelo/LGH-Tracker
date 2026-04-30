const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const path = require("path");
const { readStats, writeStats } = require("./services/statsStore");
const { fetchNffStats } = require("./services/nffScraper");
const { formatStatsApi } = require("./services/statsPayload");

const PORT = process.env.PORT || 3000;
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function statsResponse() {
  return readStats().then((stats) => formatStatsApi(stats));
}

app.get("/players", async (_, res) => {
  const stats = await readStats();
  res.json(stats.players);
});

app.get("/stats", async (_, res) => {
  const body = await statsResponse();
  res.json(body);
});

app.post("/sync", async (_, res) => {
  const stats = await fetchNffStats();
  await writeStats(stats);
  res.json({ ok: true, fetchedAt: stats.fetchedAt, players: stats.players.length });
});

async function bootstrapData() {
  const current = await readStats();
  if (!current.players.length) {
    const fresh = await fetchNffStats();
    await writeStats(fresh);
  }
}

// Lokal tid på maskinen (samme «kveld»-idé som GitHub-workflow ~21:30 Norge).
cron.schedule("30 21 * * *", async () => {
  const stats = await fetchNffStats();
  await writeStats(stats);
  console.log(`[cron] Daily sync done at ${new Date().toISOString()}`);
});

bootstrapData()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LHG stats server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to bootstrap data", error);
    process.exit(1);
  });
