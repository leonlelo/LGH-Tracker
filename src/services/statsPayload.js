function buildAggregates(players) {
  const list = Array.isArray(players) ? players : [];
  const topScorers = [...list].sort((a, b) => b.goals - a.goals);
  const yellowCards = [...list]
    .filter((p) => p.yellowCards > 0)
    .sort((a, b) => b.yellowCards - a.yellowCards);
  const redCards = [...list]
    .filter((p) => p.redCards > 0)
    .sort((a, b) => b.redCards - a.redCards);
  const matches = [...list].sort((a, b) => b.matches - a.matches);

  return {
    topScorers,
    yellowCards,
    redCards,
    matches,
  };
}

function formatStatsApi(stats) {
  const players = stats.players || [];
  return {
    metadata: {
      source: stats.source,
      fetchedAt: stats.fetchedAt,
      warning: stats.warning || null,
    },
    players,
    aggregates: buildAggregates(players),
  };
}

module.exports = {
  buildAggregates,
  formatStatsApi,
};
