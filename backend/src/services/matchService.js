const {
  readCollection,
  addRecord,
  updateRecord,
  removeRecord,
  writeCollection
} = require('../jsonStore');

const MATCHES_FILE = 'matches.json';
const SESSIONS_FILE = 'sessions.json';
const MATCH_RETENTION_DAYS = Math.max(1, Number(process.env.MATCH_RETENTION_DAYS) || 3);

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const validationError = (message, details) => Object.assign(new Error(message), {
  statusCode: 400,
  details
});

const sessionNotFound = (sessionId) => Object.assign(new Error(`Session ${sessionId} not found.`), {
  statusCode: 404
});

function getSessionById(sessionId, sessions = readCollection(SESSIONS_FILE)) {
  return sessions.find((session) => Number(session.session_id) === Number(sessionId)) || null;
}

function getMatchById(matchId, matches = readCollection(MATCHES_FILE)) {
  return matches.find((match) => Number(match.match_id) === Number(matchId)) || null;
}

function integerId(value, field, { nullable = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (nullable) return null;
    throw validationError(`${field} is required.`);
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw validationError(`${field} must be a positive integer.`);
  return parsed;
}

function listOfIds(value, field) {
  if (!Array.isArray(value)) throw validationError(`${field} must be an array.`);
  const ids = value.map((item) => integerId(item, field));
  if (new Set(ids).size !== ids.length) throw validationError(`${field} cannot contain duplicate player IDs.`);
  return ids;
}

function assertRegistered(id, registeredIds, field) {
  if (!registeredIds.has(id)) throw validationError(`${field} ${id} is not registered in this season.`);
}

function normalizeGoals(value, registeredIds, appearances) {
  if (!Array.isArray(value)) throw validationError('goals must be an array.');
  return value.map((goal, index) => {
    if (!goal || typeof goal !== 'object' || Array.isArray(goal)) {
      throw validationError(`Goal #${index + 1} must be an object.`);
    }
    const scorerId = integerId(goal.scorer_id ?? goal.scorerId, `goals[${index}].scorer_id`);
    const assistId = integerId(goal.assist_id ?? goal.assistId, `goals[${index}].assist_id`, { nullable: true });
    assertRegistered(scorerId, registeredIds, `Goal scorer`);
    if (!appearances.includes(scorerId)) throw validationError(`Goal scorer ${scorerId} must be included in appearances.`);
    if (assistId !== null) {
      assertRegistered(assistId, registeredIds, 'Goal assister');
      if (!appearances.includes(assistId)) throw validationError(`Goal assister ${assistId} must be included in appearances.`);
      if (assistId === scorerId) throw validationError('A player cannot assist their own goal.');
    }
    return { scorer_id: scorerId, assist_id: assistId };
  });
}

function normalizeMatch(input = {}, session, existing = null, { allowFinalized = false } = {}) {
  if (!session) throw sessionNotFound(input.session_id);
  const registeredIds = new Set((session.player_match || []).map((item) => Number(item.player_id)));
  const sessionId = Number(existing?.session_id ?? input.session_id ?? session.session_id);
  if (sessionId !== Number(session.session_id)) throw validationError('A match cannot be moved to another season.');

  const title = String(input.title ?? existing?.title ?? '').trim();
  if (!title) throw validationError('Match title is required.');
  const date = String(input.date ?? existing?.date ?? '').trim();
  if (!date) throw validationError('Match date is required.');

  const appearances = listOfIds(input.appearances ?? existing?.appearances ?? [], 'appearances');
  appearances.forEach((id) => assertRegistered(id, registeredIds, 'Appearance player'));
  const goals = normalizeGoals(input.goals ?? existing?.goals ?? [], registeredIds, appearances);
  const requestedBestPlayer = Object.prototype.hasOwnProperty.call(input, 'best_player_id')
    ? input.best_player_id
    : input.bestPlayerId ?? existing?.best_player_id;
  const bestPlayerId = integerId(
    requestedBestPlayer,
    'best_player_id',
    { nullable: true }
  );
  if (bestPlayerId !== null) {
    assertRegistered(bestPlayerId, registeredIds, 'Best player');
    if (!appearances.includes(bestPlayerId)) throw validationError(`Best player ${bestPlayerId} must be included in appearances.`);
  }

  const status = String(input.status ?? existing?.status ?? 'draft').toLowerCase();
  if (!['draft', 'finalized'].includes(status)) throw validationError('Match status must be draft or finalized.');
  if (status === 'finalized' && !allowFinalized) throw validationError('Use the finalize action to confirm a match.');

  return {
    ...(existing || {}),
    session_id: sessionId,
    title,
    date,
    appearances,
    goals,
    best_player_id: bestPlayerId,
    status
  };
}

function zeroStats() {
  return { matches: 0, goals: 0, assists: 0, bestPlayer: 0 };
}

function aggregateFinalizedMatches(matches = []) {
  const totals = new Map();
  const statsFor = (playerId) => {
    const key = Number(playerId);
    if (!totals.has(key)) totals.set(key, zeroStats());
    return totals.get(key);
  };

  matches.filter((match) => match.status === 'finalized').forEach((match) => {
    (Array.isArray(match.appearances) ? match.appearances : []).forEach((playerId) => { statsFor(playerId).matches += 1; });
    (Array.isArray(match.goals) ? match.goals : []).forEach(({ scorer_id: scorerId, assist_id: assistId }) => {
      statsFor(scorerId).goals += 1;
      if (assistId !== null) statsFor(assistId).assists += 1;
    });
    if (match.best_player_id !== null) statsFor(match.best_player_id).bestPlayer += 1;
  });

  return totals;
}

function baselineForSession(session) {
  if (session.stats_baseline && typeof session.stats_baseline === 'object') return session.stats_baseline;
  return Object.fromEntries((session.player_match || []).map((item) => [String(item.player_id), {
    matches: numberOr(item.stats?.matches),
    goals: numberOr(item.stats?.goals),
    assists: numberOr(item.stats?.assists),
    bestPlayer: numberOr(item.stats?.bestPlayer)
  }]));
}

function baselineFromPlayerMatch(session, playerMatch, matches = readCollection(MATCHES_FILE)) {
  const eventTotals = aggregateFinalizedMatches(matches.filter((match) => Number(match.session_id) === Number(session.session_id)));
  return Object.fromEntries((playerMatch || []).map((item) => {
    const events = eventTotals.get(Number(item.player_id)) || zeroStats();
    const stats = item.stats || {};
    return [String(item.player_id), {
      matches: Math.max(0, numberOr(stats.matches) - events.matches),
      goals: Math.max(0, numberOr(stats.goals) - events.goals),
      assists: Math.max(0, numberOr(stats.assists) - events.assists),
      bestPlayer: Math.max(0, numberOr(stats.bestPlayer) - events.bestPlayer)
    }];
  }));
}

function isExpiredFinalizedMatch(match, now = Date.now(), retentionDays = MATCH_RETENTION_DAYS) {
  const finalizedAt = Date.parse(match?.finalizedAt || '');
  return match?.status === 'finalized'
    && Number.isFinite(finalizedAt)
    && now - finalizedAt >= Number(retentionDays) * 24 * 60 * 60 * 1000;
}

function preserveSeasonStatsAfterMatchRemoval(sessionId, remainingMatches = readCollection(MATCHES_FILE)) {
  const session = getSessionById(sessionId);
  if (!session) return null;
  return updateRecord(SESSIONS_FILE, sessionId, {
    // Keep the current season totals, then treat them as the new baseline after the match is archived.
    stats_baseline: baselineFromPlayerMatch(session, session.player_match, remainingMatches)
  }, 'session_id');
}

function cleanupExpiredMatches(now = Date.now()) {
  const matches = readCollection(MATCHES_FILE);
  const expired = matches.filter((match) => isExpiredFinalizedMatch(match, now));
  if (!expired.length) return { matches: [], sessions: [] };

  const remaining = matches.filter((match) => !expired.includes(match));
  writeCollection(MATCHES_FILE, remaining);
  const sessionIds = [...new Set(expired.map((match) => Number(match.session_id)))];
  const sessions = sessionIds.map((sessionId) => preserveSeasonStatsAfterMatchRemoval(sessionId, remaining)).filter(Boolean);
  return { matches: expired, sessions };
}

function recalculateSeasonPlayerStats(sessionId, sessions = readCollection(SESSIONS_FILE), matches = readCollection(MATCHES_FILE)) {
  const session = getSessionById(sessionId, sessions);
  if (!session) throw sessionNotFound(sessionId);
  const seasonMatches = matches.filter((match) => Number(match.session_id) === Number(sessionId));
  const baseline = baselineForSession(session);
  const eventTotals = aggregateFinalizedMatches(seasonMatches);
  const nextPlayerMatch = (session.player_match || []).map((item) => {
    const base = baseline[String(item.player_id)] || zeroStats();
    const events = eventTotals.get(Number(item.player_id)) || zeroStats();
    return {
      ...item,
      stats: {
        matches: numberOr(base.matches) + events.matches,
        goals: numberOr(base.goals) + events.goals,
        assists: numberOr(base.assists) + events.assists,
        bestPlayer: numberOr(base.bestPlayer) + events.bestPlayer
      }
    };
  });
  const updated = updateRecord(SESSIONS_FILE, sessionId, {
    stats_baseline: baseline,
    player_match: nextPlayerMatch
  }, 'session_id');
  return updated;
}

function getSessionPlayerUsage(sessionId, playerId, matches = readCollection(MATCHES_FILE)) {
  const id = Number(playerId);
  return matches.filter((match) => Number(match.session_id) === Number(sessionId) && (
    (Array.isArray(match.appearances) && match.appearances.includes(id))
    || match.best_player_id === id
    || (Array.isArray(match.goals) && match.goals.some((goal) => goal.scorer_id === id || goal.assist_id === id))
  )).map((match) => ({ match_id: match.match_id, title: match.title, status: match.status }));
}

function removeMatchesForSession(sessionId, matches = readCollection(MATCHES_FILE)) {
  const remaining = matches.filter((match) => Number(match.session_id) !== Number(sessionId));
  writeCollection(MATCHES_FILE, remaining);
  return remaining;
}

module.exports = {
  MATCHES_FILE,
  SESSIONS_FILE,
  MATCH_RETENTION_DAYS,
  getSessionById,
  getMatchById,
  normalizeMatch,
  aggregateFinalizedMatches,
  baselineFromPlayerMatch,
  isExpiredFinalizedMatch,
  preserveSeasonStatsAfterMatchRemoval,
  cleanupExpiredMatches,
  recalculateSeasonPlayerStats,
  getSessionPlayerUsage,
  removeMatchesForSession,
  addMatch: (match) => addRecord(MATCHES_FILE, match, 'match_id'),
  updateMatch: (id, match) => updateRecord(MATCHES_FILE, id, match, 'match_id'),
  removeMatch: (id) => removeRecord(MATCHES_FILE, id, 'match_id')
};
