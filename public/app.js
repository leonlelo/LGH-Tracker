let rawPlayers = [];
let sortState = { key: "goals", direction: "desc" };
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
const g15NffNotice = document.getElementById("g15NffNotice");

function compare(a, b, key, direction) {
  const factor = direction === "asc" ? 1 : -1;
  const aValue = a[key];
  const bValue = b[key];

  if (typeof aValue === "number" && typeof bValue === "number") {
    return (aValue - bValue) * factor;
  }

  return String(aValue).localeCompare(String(bValue), "no") * factor;
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
  if (g15NffNotice) {
    g15NffNotice.hidden = currentView !== "LHG G15";
  }
}

function refreshView() {
  renderTable();
  const currentPlayers = playersForView();
  renderList("topScorers", currentPlayers, "goals");
  renderList("yellowCards", currentPlayers, "yellowCards");
  renderList("redCards", currentPlayers, "redCards");
}

function renderTable() {
  const rows = playersForView().sort((a, b) =>
    compare(a, b, sortState.key, sortState.direction)
  );

  if (!rows.length) {
    tableBody.innerHTML =
      '<tr><td colspan="7">Ingen statistikk tilgjengelig for valgt lag enda.</td></tr>';
    return;
  }

  tableBody.innerHTML = rows
    .map(
      (p, index) => `
      <tr>
        <td class="rank-cell">${index + 1}</td>
        <td>${p.player}</td>
        <td>${p.team}</td>
        <td class="metric-cell">${p.goals}</td>
        <td class="metric-cell">${p.yellowCards}</td>
        <td class="metric-cell">${p.redCards}</td>
        <td class="metric-cell">${p.matches}</td>
      </tr>
    `
    )
    .join("");
}

function renderList(elementId, players, metricKey) {
  const target = document.getElementById(elementId);
  const top = [...players]
    .filter((p) => p[metricKey] > 0)
    .sort((a, b) => b[metricKey] - a[metricKey])
    .slice(0, 8);

  if (!top.length) {
    target.innerHTML = '<li class="list-empty">Ingen data enda</li>';
    return;
  }

  target.innerHTML = top
    .map(
      (p, index) => `
        <li>
          <span class="list-rank">${index + 1}</span>
          <span class="list-name">${p.player} <span class="muted">(${p.team})</span></span>
          <span class="list-value">${p[metricKey]}</span>
        </li>
      `
    )
    .join("");
}

function setupSorting() {
  document.querySelectorAll("#statsTable th").forEach((header) => {
    header.addEventListener("click", () => {
      const key = header.dataset.key;
      if (!key) {
        return;
      }
      const sameColumn = sortState.key === key;
      sortState = {
        key,
        direction: sameColumn && sortState.direction === "desc" ? "asc" : "desc",
      };
      renderTable();
    });
  });
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

setupSorting();
loadStats().catch((error) => {
  updatedAt.textContent = `Kunne ikke hente data: ${error.message}`;
});
