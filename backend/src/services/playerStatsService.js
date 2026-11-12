const { readCollection, writeCollection } = require('../jsonStore');
const { supportsMatchResult } = require('./matchService');
const { combineDefensiveStats } = require('./defensiveStats');

const PLAYERS_FILE = 'players.json';
const SESSIONS_FILE = 'sessions.json';
const STAT_KEYS = ['goalAmounts', 'assistAmounts', 'match', 'bestPlayerAmount', 'sessionAmount'];
const RESULT_STAT_KEYS = ['wins', 'draws', 'losses'];
const EDITABLE_STATS = new Set([...STAT_KEYS, ...RESULT_STAT_KEYS, 'goalsAgainst', 'cleanSheets']);

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

function resultStatsFrom(value = {}) {
  return Object.fromEntries(RESULT_STAT_KEYS.map((key) => [key, numberOrZero(value[key])]));
}

function hasResultStats(value = {}) {
  return RESULT_STAT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function hasPlayerInResultSession(player, sessions = []) {
  return sessions.some((session) => supportsMatchResult(session) && (session.player_match || []).some((item) => playerMatches(player, item)));
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
    Object.assign(result, combineDefensiveStats(result, seasonPlayer.stats));
    if (supportsMatchResult(session)) {
      if (!hasResultStats(result)) Object.assign(result, resultStatsFrom());
      result.wins += numberOrZero(seasonPlayer.stats?.wins);
      result.draws += numberOrZero(seasonPlayer.stats?.draws);
      result.losses += numberOrZero(seasonPlayer.stats?.losses);
    }
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

function resultCareerBaselineFor(player, sessions, seasonStats) {
  const current = player.stats || {};
  const storedBaseline = player.stats_career_baseline || {};
  const hasResultContext = hasPlayerInResultSession(player, sessions) || hasResultStats(current) || hasResultStats(storedBaseline);
  if (!hasResultContext) return null;
  if (hasResultStats(storedBaseline)) return resultStatsFrom(storedBaseline);
  const seasonResult = resultStatsFrom(seasonStats);
  const currentResult = resultStatsFrom(current);
  return Object.fromEntries(RESULT_STAT_KEYS.map((key) => [key, Math.max(0, currentResult[key] - seasonResult[key])]));
}

function careerStatsFor(player, sessions, edits) {
  const baseline = careerBaselineFor(player, sessions);
  const seasonStats = calculatePlayerSeasonStats(player, sessions);
  const resultBaseline = resultCareerBaselineFor(player, sessions, seasonStats);
  const automatic = {
    ...addStats(baseline, seasonStats),
    ...combineDefensiveStats(seasonStats),
    ...(resultBaseline ? Object.fromEntries(RESULT_STAT_KEYS.map((key) => [key, resultBaseline[key] + numberOrZero(seasonStats[key])])) : {})
  };
  const adjustments = { ...player.stats_career_adjustments };
  const stats = { ...automatic };
  for (const [key, offset] of Object.entries(adjustments)) {
    if (EDITABLE_STATS.has(key)) stats[key] = Math.max(0, (automatic[key] ?? 0) + offset);
  }
  if (edits !== undefined) {
    if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
      throw Object.assign(new Error('Dữ liệu chỉnh sửa thống kê không hợp lệ.'), { statusCode: 400 });
    }
    for (const [key, edit] of Object.entries(edits)) {
      if (!EDITABLE_STATS.has(key) || !Number.isSafeInteger(edit?.value) || edit.value < 0 ||
          !(edit.previous === null || (Number.isSafeInteger(edit.previous) && edit.previous >= 0))) {
        throw Object.assign(new Error('Chỉ số phải là số nguyên từ 0 trở lên.'), { statusCode: 400 });
      }
      if (stats[key] === edit.value) continue;
      if ((stats[key] ?? null) !== edit.previous) {
        throw Object.assign(new Error('Chỉ số vừa được cập nhật. Hãy mở lại chi tiết cầu thủ trước khi sửa.'), { statusCode: 409 });
      }
      adjustments[key] = edit.value - (automatic[key] ?? 0);
      stats[key] = edit.value;
    }
  }
  const storedBaseline = { ...baseline, ...resultBaseline };
  if (!resultBaseline && hasResultStats(adjustments)) Object.assign(storedBaseline, resultStatsFrom());
  return {
    stats_career_baseline: storedBaseline,
    ...(Object.keys(adjustments).length ? { stats_career_adjustments: adjustments } : {}),
    stats
  };
}

function calculatePlayerGlobalStats(playerId, sessions = readCollection(SESSIONS_FILE), players = readCollection(PLAYERS_FILE)) {
  const player = players.find((item) => String(item.player_id) === String(playerId) || String(item.objectId || '') === String(playerId));
  return player ? careerStatsFor(player, sessions).stats : emptyStats();
}

function recalculateAllPlayerStats(players = readCollection(PLAYERS_FILE), sessions = readCollection(SESSIONS_FILE)) {
  const updatedPlayers = players.map((player) => {
    const career = careerStatsFor(player, sessions);
    const { goalsAgainst, cleanSheets, ...previousStats } = player.stats || {};
    return {
      ...player,
      ...career,
      stats: { ...previousStats, ...career.stats }
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
  careerStatsFor,
  recalculateAllPlayerStats
};
