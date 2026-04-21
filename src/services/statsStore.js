const fs = require("fs/promises");
const path = require("path");

/** Én kilde til sannhet: statisk fil som Vercel/GitHub Pages serverer uten backend. */
const dataFilePath = path.join(__dirname, "..", "..", "public", "stats.json");

function emptyStats(warning) {
  return {
    source: null,
    fetchedAt: null,
    players: [],
    warning: warning || null,
  };
}

async function readStats() {
  try {
    const file = await fs.readFile(dataFilePath, "utf-8");
    return JSON.parse(file);
  } catch (error) {
    return emptyStats("Ingen statsfil funnet enda. Kjør sync eller vent på GitHub Actions.");
  }
}

async function writeStats(payload) {
  await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
  await fs.writeFile(dataFilePath, JSON.stringify(payload, null, 2), "utf-8");
}

module.exports = {
  readStats,
  writeStats,
  dataFilePath,
};
