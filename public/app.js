let rawPlayers = [];
let currentView = "ALL";

const VIEW_DISPLAY = {
  ALL: "LHG G15 + G16",
  "LHG G15": "LHG G15",
  "LHG G16": "LHG G16",
};

const VIEW_CONTEXT = {
  ALL: "Tallene er summert på tvers av G15 og G16 (samme spiller telles én gang).",
  "LHG G15":
    "Statistikk er beregnet fra NFF sine kamprapporter (kamptropp + kamphendelser) for hver ferdigspilt kamp.",
  "LHG G16": "Kun statistikk som er registrert på G16-laget hos NFF.",
};

const tableBody = document.querySelector("#statsTable tbody");
const viewSwitcher = document.getElementById("viewSwitcher");
const updatedAt = document.getElementById("updatedAt");
const activeViewValue = document.getElementById("activeViewValue");
const statsPanelContext = document.getElementById("statsPanelContext");

/** Kull etter fødselsår: 010 / 011 / 012 — fullt navn for unntak (unngår feil ved flere med samme fornavn). */
const KULL_010 = new Set([
  "Daniel Meling Habberstad",
  "Hans Olav Skau",
  "Marius Fredriksen Bergersen",
  "Peder Flatla",
]);

const KULL_012 = new Set([
  "Lukas Isaak", // Lucas
]);

function kullForPlayer(fullName) {
  const n = String(fullName || "").trim();
  if (KULL_010.has(n)) {
    return "010";
  }
  if (KULL_012.has(n)) {
    return "012";
  }
  return "011";
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPlayerWithKull(fullName) {
  const k = kullForPlayer(fullName);
  return `${escapeHtml(fullName)} (${escapeHtml(k)})`;
}

function compareGoalsDesc(a, b) {
  if (b.goals !== a.goals) {
    return b.goals - a.goals;
  }
  return String(a.player).localeCompare(String(b.player), "no");
}

function mergePlayers(players) {
  const byName = new Map();
  for (const player of players) {
    const key = player.player.toLowerCase();
    const current = byName.get(key);
    if (!current) {
      byName.set(key, {
        ...player,
        team: "LHG G15 + G16",
      });
      continue;
    }

    current.goals += player.goals;
    current.yellowCards += player.yellowCards;
    current.redCards += player.redCards;
    current.matches += player.matches;
  }
  return [...byName.values()];
}

function playersForView() {
  if (currentView === "ALL") {
    return mergePlayers(rawPlayers);
  }
  return rawPlayers.filter((p) => p.ageGroup === currentView);
}

function setViewButtons() {
  viewSwitcher.querySelectorAll(".view-btn").forEach((btn) => {
    const isActive = btn.dataset.view === currentView;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  const label = VIEW_DISPLAY[currentView] || currentView;
  activeViewValue.textContent = label;
  statsPanelContext.textContent = VIEW_CONTEXT[currentView] || "";
}

function refreshView() {
  renderTable();
}

function renderTable() {
  const rows = playersForView().sort(compareGoalsDesc);

  if (!rows.length) {
    tableBody.innerHTML =
      '<tr><td colspan="6">Ingen statistikk tilgjengelig for valgt lag enda.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .map(
      (p, index) => `
      <tr>
        <td class="rank-cell">${index + 1}</td>
        <td>${formatPlayerWithKull(p.player)}</td>
        <td class="metric-cell">${p.goals}</td>
        <td class="metric-cell">${p.yellowCards}</td>
        <td class="metric-cell">${p.redCards}</td>
        <td class="metric-cell">${p.matches}</td>
      </tr>
    `
    )
    .join("");
}

viewSwitcher.addEventListener("click", (event) => {
  const btn = event.target.closest(".view-btn");
  if (!btn || !viewSwitcher.contains(btn)) {
    return;
  }
  currentView = btn.dataset.view;
  setViewButtons();
  refreshView();
});

function normalizeStatsPayload(raw) {
  if (raw.metadata && Array.isArray(raw.players)) {
    return raw;
  }
  return {
    metadata: {
      source: raw.source ?? null,
      fetchedAt: raw.fetchedAt ?? null,
      warning: raw.warning ?? null,
    },
    players: raw.players || [],
  };
}

async function loadStats() {
  const response = await fetch("/stats.json", { cache: "no-store" });
  const raw = await response.json();
  const data = normalizeStatsPayload(raw);
  rawPlayers = data.players;

  setViewButtons();
  refreshView();

  if (data.metadata?.fetchedAt) {
    updatedAt.textContent = `Sist oppdatert: ${new Date(
      data.metadata.fetchedAt
    ).toLocaleString("no-NO")}`;
  }
}

loadStats().catch((error) => {
  updatedAt.textContent = `Kunne ikke hente data: ${error.message}`;
});
