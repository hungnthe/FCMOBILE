const {
  readCollection,
  addRecord,
  updateRecord,
  removeRecord,
  writeCollection
} = require('../jsonStore');
const { seasonDefenderIds, defensiveAppearances, recordedGoalsAgainst, combineDefensiveStats } = require('./defensiveStats');

const MATCHES_FILE = 'matches.json';
const SESSIONS_FILE = 'sessions.json';
const MATCH_RETENTION_DAYS = Math.max(1, Number(process.env.MATCH_RETENTION_DAYS) || 3);
const DEFENSIVE_STATS_VERSION = 2;
const RESULT_VALUES = new Set(['WIN', 'DRAW', 'LOSS']);

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

function supportsMatchResult(session) {
  return session?.result_tracking_enabled === true || Number(session?.match_stats_version) >= 2;
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

function normalizeScore(value, goalsCount, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw validationError('score.against is required for a finalized match.');
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw validationError('score must be an object with a non-negative against value.');
  }
  const against = recordedGoalsAgainst(value.against);
  if (against === null) throw validationError('score.against must be a non-negative integer.');
  if (Object.prototype.hasOwnProperty.call(value, 'for') && value.for !== null && value.for !== '') {
    const requestedFor = Number(value.for);
    if (!Number.isInteger(requestedFor) || requestedFor < 0) throw validationError('score.for must be a non-negative integer.');
    if (requestedFor !== goalsCount) throw validationError(`score.for must equal the number of goals (${goalsCount}).`);
  }
  return { for: goalsCount, against };
}

function deriveMatchResult(score) {
  if (!score) return null;
  if (score.for > score.against) return 'WIN';
  if (score.for < score.against) return 'LOSS';
  return 'DRAW';
}

function normalizeMatch(input = {}, session, existing = null, { allowFinalized = false, defenderIds } = {}) {
  if (!session) throw sessionNotFound(input.session_id);
  const registeredIds = new Set((session.player_match || []).map((item) => Number(item.player_id)));
  const sessionId = Number(existing?.session_id ?? input.session_id ?? session.session_id);
  if (sessionId !== Number(session.session_id)) throw validationError('A match cannot be moved to another season.');

  const title = String(input.title ?? existing?.title ?? '').trim();
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

  const resultTrackingEnabled = supportsMatchResult(session);
  const scoreSource = Object.prototype.hasOwnProperty.call(input, 'score') ? input.score : existing?.score;
  const score = resultTrackingEnabled
    ? normalizeScore(scoreSource, goals.length, { required: status === 'finalized' })
    : null;
  const result = resultTrackingEnabled ? deriveMatchResult(score) : null;

  return {
    ...(existing || {}),
    session_id: sessionId,
    title,
    date,
    appearances,
    goals,
    best_player_id: bestPlayerId,
    status,
    ...(resultTrackingEnabled && score ? { score, result } : {}),
    ...(status === 'finalized' && score ? {
      defensive_appearances: defensiveAppearances({ appearances }, defenderIds ?? seasonDefenderIds(session), existing)
    } : {})
  };
}

function zeroStats() {
  return { matches: 0, goals: 0, assists: 0, bestPlayer: 0 };
}

function resultStats() {
  return { wins: 0, draws: 0, losses: 0 };
}

function zeroSeasonMatchStats() {
  return {
    matches: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
    wins: 0,
    draws: 0,
    losses: 0
  };
}

function normalizeSeasonMatchStats(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(Object.keys(zeroSeasonMatchStats()).map((key) => [key, Math.max(0, numberOr(source[key]))]));
}

function addSeasonMatchStats(left = {}, right = {}) {
  const normalizedLeft = normalizeSeasonMatchStats(left);
  const normalizedRight = normalizeSeasonMatchStats(right);
  return Object.fromEntries(Object.keys(normalizedLeft).map((key) => [key, normalizedLeft[key] + normalizedRight[key]]));
}

function aggregateSeasonMatchStats(matches = [], session = null) {
  const totals = zeroSeasonMatchStats();
  matches
    .filter((match) => match?.status === 'finalized')
    .forEach((match) => {
      const score = match.score || {};
      const goalsFor = Number.isInteger(Number(score.for)) ? Number(score.for) : (Array.isArray(match.goals) ? match.goals.length : 0);
      const goalsAgainst = recordedGoalsAgainst(score.against);
      totals.matches += 1;
      totals.goalsFor += Math.max(0, goalsFor);
      totals.goalsAgainst += goalsAgainst ?? 0;
      if (goalsAgainst === 0) totals.cleanSheets += 1;
      const canTrackResult = supportsMatchResult(session) || (RESULT_VALUES.has(match.result) && match.score);
      if (canTrackResult && RESULT_VALUES.has(match.result)) {
        totals[match.result === 'WIN' ? 'wins' : match.result === 'DRAW' ? 'draws' : 'losses'] += 1;
      }
    });
  return totals;
}

function seasonMatchStatsBaseline(session) {
  if (session?.season_match_stats_baseline && typeof session.season_match_stats_baseline === 'object') {
    return normalizeSeasonMatchStats(session.season_match_stats_baseline);
  }
  return zeroSeasonMatchStats();
}

function aggregateFinalizedMatches(matches = [], sessions = []) {
  const totals = new Map();
  const statsFor = (playerId) => {
    const key = Number(playerId);
    if (!totals.has(key)) totals.set(key, zeroStats());
    return totals.get(key);
  };

  matches.filter((match) => match.status === 'finalized').forEach((match) => {
    const session = sessions.find((item) => Number(item.session_id) === Number(match.session_id));
    const canTrackResult = session ? supportsMatchResult(session) : RESULT_VALUES.has(match.result) && match.score;
    const against = recordedGoalsAgainst(match.score?.against);
    const defenders = new Set(match.defensive_appearances || []);
    (Array.isArray(match.appearances) ? match.appearances : []).forEach((playerId) => {
      const stats = statsFor(playerId);
      stats.matches += 1;
      if (against !== null && defenders.has(playerId)) {
        stats.goalsAgainst = (stats.goalsAgainst || 0) + against;
        stats.cleanSheets = (stats.cleanSheets || 0) + Number(against === 0);
      }
    });
    (Array.isArray(match.goals) ? match.goals : []).forEach(({ scorer_id: scorerId, assist_id: assistId }) => {
      statsFor(scorerId).goals += 1;
      if (assistId !== null) statsFor(assistId).assists += 1;
    });
    if (match.best_player_id !== null) statsFor(match.best_player_id).bestPlayer += 1;
    if (canTrackResult && RESULT_VALUES.has(match.result) && match.score) {
      (Array.isArray(match.appearances) ? match.appearances : []).forEach((playerId) => {
        const stats = statsFor(playerId);
        if (!Object.prototype.hasOwnProperty.call(stats, 'wins')) Object.assign(stats, resultStats());
        stats[match.result === 'WIN' ? 'wins' : match.result === 'DRAW' ? 'draws' : 'losses'] += 1;
      });
    }
  });

  return totals;
}

function baselineForSession(session) {
  if (session.stats_baseline && typeof session.stats_baseline === 'object') return session.stats_baseline;
  return Object.fromEntries((session.player_match || []).map((item) => [String(item.player_id), {
    matches: numberOr(item.stats?.matches),
    goals: numberOr(item.stats?.goals),
    assists: numberOr(item.stats?.assists),
    bestPlayer: numberOr(item.stats?.bestPlayer),
    ...combineDefensiveStats(item.stats),
    ...(supportsMatchResult(session) ? {
      wins: numberOr(item.stats?.wins),
      draws: numberOr(item.stats?.draws),
      losses: numberOr(item.stats?.losses)
    } : {})
  }]));
}

function baselineFromPlayerMatch(session, playerMatch, matches = readCollection(MATCHES_FILE)) {
  const eventTotals = aggregateFinalizedMatches(matches.filter((match) => Number(match.session_id) === Number(session.session_id)), [session]);
  return Object.fromEntries((playerMatch || []).map((item) => {
    const events = eventTotals.get(Number(item.player_id)) || zeroStats();
    const stats = item.stats || {};
    return [String(item.player_id), {
      matches: Math.max(0, numberOr(stats.matches) - events.matches),
      goals: Math.max(0, numberOr(stats.goals) - events.goals),
      assists: Math.max(0, numberOr(stats.assists) - events.assists),
      bestPlayer: Math.max(0, numberOr(stats.bestPlayer) - events.bestPlayer),
      ...combineDefensiveStats(stats, events, -1),
      ...(supportsMatchResult(session) ? {
        wins: Math.max(0, numberOr(stats.wins) - numberOr(events.wins)),
        draws: Math.max(0, numberOr(stats.draws) - numberOr(events.draws)),
        losses: Math.max(0, numberOr(stats.losses) - numberOr(events.losses))
      } : {})
    }];
  }));
}

function isExpiredFinalizedMatch(match, now = Date.now(), retentionDays = MATCH_RETENTION_DAYS) {
  const finalizedAt = Date.parse(match?.finalizedAt || '');
  return match?.status === 'finalized'
    && Number.isFinite(finalizedAt)
    && now - finalizedAt >= Number(retentionDays) * 24 * 60 * 60 * 1000;
}

// Snapshot historical team totals once. Future finalized matches use their own lineups.
function initializeDefensiveStats() {
  const sessions = readCollection(SESSIONS_FILE);
  const pending = sessions.filter((session) => !(session.defensive_stats_version >= DEFENSIVE_STATS_VERSION));
  if (!pending.length) return;
  const matches = readCollection(MATCHES_FILE);
  let matchesChanged = false;
  for (const session of pending) {
    const retained = matches.filter((match) => Number(match.session_id) === Number(session.session_id));
    session.defensive_stats_version = DEFENSIVE_STATS_VERSION;
    const hasScores = retained.some((match) => match.status === 'finalized' && recordedGoalsAgainst(match.score?.against) !== null);
    if (!hasScores && !session.season_match_stats && !session.season_match_stats_baseline) continue;
    const defenders = seasonDefenderIds(session);
    for (const match of retained) {
      if (match.status === 'finalized' && recordedGoalsAgainst(match.score?.against) !== null && !match.defensive_appearances) {
        match.defensive_appearances = defensiveAppearances(match, defenders);
        matchesChanged = true;
      }
    }
    const events = aggregateFinalizedMatches(retained, [session]);
    const baseline = session.stats_baseline || baselineFromPlayerMatch(session, session.player_match, retained);
    const retainedTeam = aggregateSeasonMatchStats(retained, session);
    const team = session.season_match_stats ?? addSeasonMatchStats(session.season_match_stats_baseline, retainedTeam);
    if (!session.season_match_stats_baseline) {
      session.season_match_stats_baseline = Object.fromEntries(Object.keys(retainedTeam).map((key) =>
        [key, Math.max(0, numberOr(team[key]) - retainedTeam[key])]
      ));
    }
    session.season_match_stats = team;
    for (const entry of session.player_match || []) {
      const id = Number(entry.player_id);
      const base = baseline[id] || {};
      const playerEvents = events.get(id);
      if (defenders.has(id) && (entry.stats?.matches > 0 || base.matches > 0 || playerEvents?.matches > 0)) {
        // Retained events are added again on every recalculation and can still be edited.
        Object.assign(base, combineDefensiveStats(team, playerEvents, -1));
        baseline[id] = base;
      }
      entry.stats = { ...entry.stats, ...combineDefensiveStats(base, playerEvents) };
    }
    session.stats_baseline = baseline;
  }
  if (matchesChanged) writeCollection(MATCHES_FILE, matches);
  writeCollection(SESSIONS_FILE, sessions);
}

function preserveSeasonStatsAfterMatchRemoval(sessionId, remainingMatches = readCollection(MATCHES_FILE), options = {}) {
  const session = getSessionById(sessionId);
  if (!session) return null;
  const update = {
    // Keep the current season totals, then treat them as the new baseline after the match is archived.
    stats_baseline: baselineFromPlayerMatch(session, session.player_match, remainingMatches)
  };
  if (session.season_match_stats && typeof session.season_match_stats === 'object') {
    const currentBaseline = seasonMatchStatsBaseline(session);
    if (Array.isArray(options.archivedMatches)) {
      const archived = aggregateSeasonMatchStats(options.archivedMatches, session);
      const nextBaseline = addSeasonMatchStats(currentBaseline, archived);
      const remaining = aggregateSeasonMatchStats(
        remainingMatches.filter((match) => Number(match.session_id) === Number(sessionId)),
        session
      );
      update.season_match_stats_baseline = nextBaseline;
      update.season_match_stats = addSeasonMatchStats(nextBaseline, remaining);
    } else if (Array.isArray(options.removedMatches)) {
      // Deleting a finalized match retains its recorded season statistics.
      // Move the deleted match into the baseline so recalculation cannot
      // subtract goals against, clean sheets, or W/D/L from the dashboard.
      const removed = aggregateSeasonMatchStats(options.removedMatches, session);
      const nextBaseline = addSeasonMatchStats(currentBaseline, removed);
      const remaining = aggregateSeasonMatchStats(
        remainingMatches.filter((match) => Number(match.session_id) === Number(sessionId)),
        session
      );
      update.season_match_stats_baseline = nextBaseline;
      update.season_match_stats = addSeasonMatchStats(nextBaseline, remaining);
    }
  }
  return updateRecord(SESSIONS_FILE, sessionId, update, 'session_id');
}

function cleanupExpiredMatches(now = Date.now()) {
  const matches = readCollection(MATCHES_FILE);
  const expired = matches.filter((match) => isExpiredFinalizedMatch(match, now));
  if (!expired.length) return { matches: [], sessions: [] };

  const remaining = matches.filter((match) => !expired.includes(match));
  writeCollection(MATCHES_FILE, remaining);
  const sessionIds = [...new Set(expired.map((match) => Number(match.session_id)))];
  const sessions = sessionIds.map((sessionId) => preserveSeasonStatsAfterMatchRemoval(
    sessionId,
    remaining,
    { archivedMatches: expired.filter((match) => Number(match.session_id) === Number(sessionId)) }
  )).filter(Boolean);
  return { matches: expired, sessions };
}

function recalculateSeasonPlayerStats(sessionId, sessions = readCollection(SESSIONS_FILE), matches = readCollection(MATCHES_FILE)) {
  const session = getSessionById(sessionId, sessions);
  if (!session) throw sessionNotFound(sessionId);
  const seasonMatches = matches.filter((match) => Number(match.session_id) === Number(sessionId));
  const baseline = baselineForSession(session);
  const eventTotals = aggregateFinalizedMatches(seasonMatches, [session]);
  const seasonMatchStats = addSeasonMatchStats(
    seasonMatchStatsBaseline(session),
    aggregateSeasonMatchStats(seasonMatches, session)
  );
  const resultTrackingEnabled = supportsMatchResult(session);
  const nextPlayerMatch = (session.player_match || []).map((item) => {
    const base = baseline[String(item.player_id)] || zeroStats();
    const events = eventTotals.get(Number(item.player_id)) || zeroStats();
    return {
      ...item,
      stats: {
        matches: numberOr(base.matches) + events.matches,
        goals: numberOr(base.goals) + events.goals,
        assists: numberOr(base.assists) + events.assists,
        bestPlayer: numberOr(base.bestPlayer) + events.bestPlayer,
        ...combineDefensiveStats(base, events),
        ...(resultTrackingEnabled ? {
          wins: numberOr(base.wins) + numberOr(events.wins),
          draws: numberOr(base.draws) + numberOr(events.draws),
          losses: numberOr(base.losses) + numberOr(events.losses)
        } : {})
      }
    };
  });
  const updated = updateRecord(SESSIONS_FILE, sessionId, {
    stats_baseline: baseline,
    player_match: nextPlayerMatch,
    season_match_stats_baseline: seasonMatchStatsBaseline(session),
    season_match_stats: seasonMatchStats
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
  DEFENSIVE_STATS_VERSION,
  getSessionById,
  getMatchById,
  supportsMatchResult,
  deriveMatchResult,
  normalizeMatch,
  aggregateFinalizedMatches,
  aggregateSeasonMatchStats,
  normalizeSeasonMatchStats,
  baselineFromPlayerMatch,
  isExpiredFinalizedMatch,
  preserveSeasonStatsAfterMatchRemoval,
  cleanupExpiredMatches,
  initializeDefensiveStats,
  recalculateSeasonPlayerStats,
  getSessionPlayerUsage,
  removeMatchesForSession,
  addMatch: (match) => addRecord(MATCHES_FILE, match, 'match_id'),
  updateMatch: (id, match) => updateRecord(MATCHES_FILE, id, match, 'match_id'),
  removeMatch: (id) => removeRecord(MATCHES_FILE, id, 'match_id')
};
