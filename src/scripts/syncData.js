const { fetchNffStats } = require("../services/nffScraper");
const { writeStats } = require("../services/statsStore");

async function syncData() {
  const stats = await fetchNffStats();
  await writeStats(stats);
  console.log(
    `[sync:data] Oppdatert: ${stats.players.length} spillere (${stats.fetchedAt})`
  );
  if (stats.warning) {
    console.warn(`[sync:data] ${stats.warning}`);
  }
}

if (require.main === module) {
  syncData().catch((error) => {
    console.error("[sync:data] Feilet:", error);
    process.exitCode = 1;
  });
}

module.exports = { syncData };
