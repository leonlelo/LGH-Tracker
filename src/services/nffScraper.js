const axios = require("axios");
const cheerio = require("cheerio");

const TEAM_SOURCES = [
  {
    label: "LHG G15",
    url: "https://www.fotball.no/fotballdata/lag/hjem/?fiksId=11659&underside=kamper",
  },
  {
    label: "LHG G16",
    url: "https://www.fotball.no/fotballdata/lag/hjem/?fiksId=199003",
  },
];

function parseInteger(value) {
  const cleaned = String(value || "")
    .replace(/[^\d-]/g, "")
    .trim();
  if (!cleaned) {
    return 0;
  }
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePlayer(raw) {
  return {
    player: String(raw.player || "").trim(),
    team: String(raw.team || "LHG").trim(),
    ageGroup: String(raw.ageGroup || "").trim(),
    goals: parseInteger(raw.goals),
    assists: parseInteger(raw.assists),
    yellowCards: parseInteger(raw.yellowCards),
    redCards: parseInteger(raw.redCards),
    matches: parseInteger(raw.matches),
  };
}

function parseStatsTable(html, teamLabel) {
  const $ = cheerio.load(html);
  const rows = [];

  $("table").each((_, table) => {
    const headers = $(table)
      .find("thead th")
      .map((__, th) => $(th).text().trim().toLowerCase())
      .get();
    const isPlayerStatsTable =
      headers.some((h) => h.includes("navn")) &&
      headers.some((h) => h.includes("kamper")) &&
      headers.some((h) => h.includes("mål")) &&
      headers.some((h) => h.includes("gule")) &&
      headers.some((h) => h.includes("røde"));

    if (!isPlayerStatsTable) {
      return;
    }

    $(table)
      .find("tbody tr")
      .each((__, row) => {
        const cells = $(row)
          .find("td")
          .map((___, cell) => $(cell).text().trim())
          .get();

        if (cells.length < 5) {
          return;
        }

        const record = normalizePlayer({
          player: cells[0],
          team: teamLabel,
          ageGroup: teamLabel,
          matches: cells[1],
          goals: cells[2],
          yellowCards: cells[3],
          redCards: cells[4],
          assists: 0,
        });

        if (/[a-zA-ZæøåÆØÅ]/.test(record.player)) {
          rows.push(record);
        }
      });
  });

  return rows;
}

async function fetchNffStats() {
  const warnings = [];
  const players = [];

  for (const source of TEAM_SOURCES) {
    try {
      const response = await axios.get(source.url, {
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LHG-StatsBot/1.0)",
        },
      });
      const parsed = parseStatsTable(response.data, source.label);
      players.push(...parsed);
      if (!parsed.length) {
        warnings.push(`Ingen statistikk-tabell funnet for ${source.label}.`);
      }
    } catch (error) {
      warnings.push(`Feil ved henting for ${source.label}: ${error.message}`);
    }
  }

  return {
    source: TEAM_SOURCES.map((s) => s.url),
    fetchedAt: new Date().toISOString(),
    players,
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}

module.exports = {
  fetchNffStats,
};
