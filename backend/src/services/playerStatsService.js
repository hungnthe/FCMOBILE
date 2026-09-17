const { readCollection, writeCollection } = require('../jsonStore');

const PLAYERS_FILE = 'players.json';
const SESSIONS_FILE = 'sessions.json';
const STAT_KEYS = ['goalAmounts', 'assistAmounts', 'match', 'bestPlayerAmount', 'sessionAmount'];

const numberOrZero = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

const playerMatches = (player, match) => (
  String(player.player_id) === String(match?.player_id)
  || (player.objectId && String(player.objectId) === String(match?.objectId))
);

function emptyStats() {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));
}

function addStats(left = {}, right = {}) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, numberOrZero(left[key]) + numberOrZero(right[key])]));
}

function subtractStats(left = {}, right = {}) {
  return Object.fromEntries(STAT_KEYS.map((key) => [key, Math.max(0, numberOrZero(left[key]) - numberOrZero(right[key]))]));
}

function calculatePlayerSeasonStats(player, sessions = readCollection(SESSIONS_FILE)) {
  const result = { goalAmounts: 0, assistAmounts: 0, match: 0, bestPlayerAmount: 0, sessionAmount: 0 };
  if (!player) return result;

  sessions.forEach((session) => {
    const seasonPlayer = (session.player_match || []).find((match) => playerMatches(player, match));
    if (!seasonPlayer) return;
    result.sessionAmount += 1;
    result.match += numberOrZero(seasonPlayer.stats?.matches);
    result.goalAmounts += numberOrZero(seasonPlayer.stats?.goals);
    result.assistAmounts += numberOrZero(seasonPlayer.stats?.assists);
    result.bestPlayerAmount += numberOrZero(seasonPlayer.stats?.bestPlayer);
  });

  return result;
}

function careerBaselineFor(player, sessions) {
  if (player.stats_career_baseline && typeof player.stats_career_baseline === 'object') {
    return { ...emptyStats(), ...subtractStats(player.stats_career_baseline) };
  }
  // One-time migration: keep legacy totals that are not represented by a season yet.
  return subtractStats(player.stats || {}, calculatePlayerSeasonStats(player, sessions));
}

function calculatePlayerGlobalStats(playerId, sessions = readCollection(SESSIONS_FILE), players = readCollection(PLAYERS_FILE)) {
  const player = players.find((item) => String(item.player_id) === String(playerId) || String(item.objectId || '') === String(playerId));
  if (!player) return emptyStats();

  return addStats(careerBaselineFor(player, sessions), calculatePlayerSeasonStats(player, sessions));
}

function recalculateAllPlayerStats(players = readCollection(PLAYERS_FILE), sessions = readCollection(SESSIONS_FILE)) {
  const updatedPlayers = players.map((player) => {
    const baseline = careerBaselineFor(player, sessions);
    const seasonStats = calculatePlayerSeasonStats(player, sessions);
    return {
      ...player,
      // Persist the legacy portion so later season/match updates only add new data once.
      stats_career_baseline: baseline,
      stats: {
        ...(player.stats || {}),
        ...addStats(baseline, seasonStats)
      }
    };
  });
  writeCollection(PLAYERS_FILE, updatedPlayers);
  return updatedPlayers;
}

module.exports = {
  PLAYERS_FILE,
  SESSIONS_FILE,
  calculatePlayerSeasonStats,
  calculatePlayerGlobalStats,
  recalculateAllPlayerStats
};
