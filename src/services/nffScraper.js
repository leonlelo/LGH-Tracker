const axios = require("axios");
const cheerio = require("cheerio");

/** G16: spillerstatistikk-tabell finnes. G15: summer fra kamptropp + kamphendelser per kamp. */
const TEAM_SOURCES = [
  {
    label: "LHG G15",
    url: "https://www.fotball.no/fotballdata/lag/hjem/?fiksId=11659&underside=kamper",
    /** Må matche h3 / tidslinje-navn på kamp-sider (fotball.no). */
    nffTeamDisplayName: "Lunner/Harestua/Grua",
    aggregateFromMatches: true,
  },
  {
    label: "LHG G16",
    url: "https://www.fotball.no/fotballdata/lag/hjem/?fiksId=199003",
    aggregateFromMatches: false,
  },
];

const AXIOS_DEFAULTS = {
  timeout: 20000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; LHG-StatsBot/1.0)",
  },
};

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

function normalizeTeamName(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function teamNamesMatch(a, b) {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) {
    return false;
  }
  return na === nb || na.includes(nb) || nb.includes(na);
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

function extractMatchFiksIdsFromFixtures(html) {
  const $ = cheerio.load(html);
  const ids = new Set();
  $("table.customSorterAtomicMatches tbody tr").each((_, tr) => {
    if ($(tr).hasClass("upcoming-match")) {
      return;
    }
    $(tr)
      .find('a[href*="/fotballdata/kamp/?fiksId="]')
      .each((__, a) => {
        const href = $(a).attr("href");
        const m = href && href.match(/fiksId=(\d+)/);
        if (m) {
          ids.add(m[1]);
        }
      });
  });
  return [...ids];
}

function parseSquadPlayerNames(html, nffTeamDisplayName) {
  const $ = cheerio.load(html);
  const names = new Set();
  $("li.homeTeamWrapper, li.awayTeamWrapper").each((_, li) => {
    const title = $(li).find("h3").first().text().trim();
    if (!teamNamesMatch(title, nffTeamDisplayName)) {
      return;
    }
    $(li)
      .find("a.playerName")
      .each((__, a) => {
        const n = $(a).text().trim();
        if (n && /[a-zA-ZæøåÆØÅ]/.test(n)) {
          names.add(n);
        }
      });
  });
  return [...names];
}

function parseOurTeamTimelineEvents(html, nffTeamDisplayName) {
  const $ = cheerio.load(html);
  const headers = [];
  $(".a_matchTimeline .timelineTeamName").each((_, el) => {
    headers.push($(el).text().trim());
  });
  if (headers.length < 2) {
    return [];
  }

  let idx = headers.findIndex((h) => teamNamesMatch(h, nffTeamDisplayName));
  if (idx === -1) {
    idx = headers.findIndex(
      (h) =>
        normalizeTeamName(h).includes(normalizeTeamName(nffTeamDisplayName)) ||
        normalizeTeamName(nffTeamDisplayName).includes(normalizeTeamName(h))
    );
  }
  if (idx === -1) {
    return [];
  }

  const sideClass = idx === 0 ? "homeTeam" : "awayTeam";
  const events = [];
  $(`.timelineEventLine.${sideClass}`).each((_, line) => {
    const content = $(line).find(".timelineEventContent").first();
    if (!content.length) {
      return;
    }
    const name = content.find("a.eventHeading").text().trim();
    const typeRaw = content.find("div").first().text().trim();
    if (!name || !typeRaw) {
      return;
    }
    events.push({ name, type: typeRaw });
  });
  return events;
}

function classifyEvent(typeRaw) {
  const t = typeRaw.toLowerCase();
  if (t.includes("spillemål") || t.includes("straffemål") || t.includes("selvmål")) {
    return "goal";
  }
  if (t.includes("advarsel")) {
    return "yellow";
  }
  if (t.includes("utvisning")) {
    return "red";
  }
  return null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpGet(url) {
  const response = await axios.get(url, AXIOS_DEFAULTS);
  return response.data;
}

async function aggregateG15FromPlayedMatches(fixturesUrl, nffTeamDisplayName, label) {
  const warnings = [];
  const fixturesHtml = await httpGet(fixturesUrl);
  const matchIds = extractMatchFiksIdsFromFixtures(fixturesHtml);
  if (!matchIds.length) {
    warnings.push(`${label}: Ingen ferdigspilte kamper funnet i tabellen.`);
    return { players: [], warnings, matchCount: 0 };
  }

  const totals = new Map();

  function bump(name, field, delta = 1) {
    if (!name) {
      return;
    }
    const key = name.trim().toLowerCase();
    if (!totals.has(key)) {
      totals.set(key, {
        player: name.trim(),
        goals: 0,
        yellowCards: 0,
        redCards: 0,
        matches: 0,
      });
    }
    const row = totals.get(key);
    row[field] += delta;
  }

  let processed = 0;
  for (const id of matchIds) {
    const matchUrl = `https://www.fotball.no/fotballdata/kamp/?fiksId=${id}`;
    try {
      const html = await httpGet(matchUrl);
      const squad = parseSquadPlayerNames(html, nffTeamDisplayName);
      if (!squad.length) {
        warnings.push(`${label}: Ingen kamptropp for kamp fiksId=${id}.`);
      }
      for (const name of squad) {
        bump(name, "matches", 1);
      }

      const events = parseOurTeamTimelineEvents(html, nffTeamDisplayName);
      for (const ev of events) {
        const kind = classifyEvent(ev.type);
        if (kind === "goal") {
          bump(ev.name, "goals", 1);
        } else if (kind === "yellow") {
          bump(ev.name, "yellowCards", 1);
        } else if (kind === "red") {
          bump(ev.name, "redCards", 1);
        }
      }
      processed += 1;
    } catch (error) {
      warnings.push(`${label}: Kunne ikke lese kamp ${id}: ${error.message}`);
    }
    await delay(120);
  }

  const players = [...totals.values()].map((row) =>
    normalizePlayer({
      player: row.player,
      team: label,
      ageGroup: label,
      goals: row.goals,
      yellowCards: row.yellowCards,
      redCards: row.redCards,
      matches: row.matches,
      assists: 0,
    })
  );

  return { players, warnings, matchCount: processed };
}

async function fetchNffStats() {
  const warnings = [];
  const players = [];
  const sources = [];

  for (const source of TEAM_SOURCES) {
    if (source.aggregateFromMatches && source.nffTeamDisplayName) {
      sources.push(`${source.url} (kamper+hendelser)`);
      try {
        const agg = await aggregateG15FromPlayedMatches(
          source.url,
          source.nffTeamDisplayName,
          source.label
        );
        players.push(...agg.players);
        warnings.push(...agg.warnings);
        if (!agg.players.length && !agg.warnings.length) {
          warnings.push(`${source.label}: Ingen spillerdata etter aggregering.`);
        }
      } catch (error) {
        warnings.push(`Feil ved G15-kampaggregering: ${error.message}`);
      }
      continue;
    }

    sources.push(source.url);
    try {
      const response = await axios.get(source.url, AXIOS_DEFAULTS);
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
    source: sources,
    fetchedAt: new Date().toISOString(),
    players,
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}

module.exports = {
  fetchNffStats,
};
