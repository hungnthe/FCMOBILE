const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeMatch,
  aggregateFinalizedMatches,
  aggregateSeasonMatchStats,
  baselineFromPlayerMatch,
  isExpiredFinalizedMatch,
  supportsMatchResult
} = require('../src/services/matchService');

const season = {
  session_id: 1,
  player_match: [1, 2, 3, 4, 5].map((player_id) => ({ player_id }))
};

test('normalizes a valid match and allows goals without assists', () => {
  const match = normalizeMatch({
    session_id: 1,
    title: 'Vòng 1',
    date: '2026-09-03',
    appearances: [1, 2, 3, 4],
    goals: [
      { scorer_id: 1, assist_id: 2 },
      { scorer_id: 1, assist_id: null },
      { scorer_id: 3, assist_id: 4 }
    ],
    best_player_id: 1,
    status: 'finalized'
  }, season, null, { allowFinalized: true });

  assert.deepEqual(match.goals[1], { scorer_id: 1, assist_id: null });
  assert.equal(match.status, 'finalized');
});

test('allows a match without a title while still requiring its date', () => {
  const match = normalizeMatch({
    session_id: 1,
    title: '',
    date: '2026-09-03',
    appearances: [],
    goals: []
  }, season);

  assert.equal(match.title, '');
  assert.throws(() => normalizeMatch({
    session_id: 1,
    title: '',
    appearances: [],
    goals: []
  }, season), /Match date is required/);
});

test('aggregates finalized matches and ignores drafts', () => {
  const totals = aggregateFinalizedMatches([
    { status: 'draft', appearances: [1], goals: [{ scorer_id: 1, assist_id: null }], best_player_id: 1 },
    { status: 'finalized', appearances: [1, 2, 3, 4], goals: [{ scorer_id: 1, assist_id: 2 }, { scorer_id: 1, assist_id: null }, { scorer_id: 3, assist_id: 4 }], best_player_id: 1 }
  ]);

  assert.deepEqual(totals.get(1), { matches: 1, goals: 2, assists: 0, bestPlayer: 1 });
  assert.deepEqual(totals.get(2), { matches: 1, goals: 0, assists: 1, bestPlayer: 0 });
  assert.deepEqual(totals.get(3), { matches: 1, goals: 1, assists: 0, bestPlayer: 0 });
  assert.deepEqual(totals.get(4), { matches: 1, goals: 0, assists: 1, bestPlayer: 0 });
  assert.equal(totals.has(5), false);
});

test('rejects invalid player references and self-assists', () => {
  assert.throws(() => normalizeMatch({
    session_id: 1,
    title: 'Invalid',
    date: '2026-09-03',
    appearances: [1, 2],
    goals: [{ scorer_id: 1, assist_id: 1 }]
  }, season));

  assert.throws(() => normalizeMatch({
    session_id: 1,
    title: 'Invalid',
    date: '2026-09-03',
    appearances: [1, 2],
    goals: [{ scorer_id: 5, assist_id: null }]
  }, season));

  assert.throws(() => normalizeMatch({
    session_id: 1,
    title: 'Invalid',
    date: '2026-09-03',
    appearances: [1, 1],
    goals: []
  }, season));
});

test('supports clearing an optional best player', () => {
  const existing = normalizeMatch({
    session_id: 1,
    title: 'Vòng 1',
    date: '2026-09-03',
    appearances: [1, 2],
    goals: [],
    best_player_id: 1,
    status: 'finalized'
  }, season, null, { allowFinalized: true });
  const corrected = normalizeMatch({ best_player_id: null }, season, existing, { allowFinalized: true });
  assert.equal(corrected.best_player_id, null);
});

test('expires finalized matches after three days and preserves their recorded stats', () => {
  const now = Date.parse('2026-09-10T00:00:00.000Z');
  assert.equal(isExpiredFinalizedMatch({ status: 'finalized', finalizedAt: '2026-09-07T00:00:00.000Z' }, now, 3), true);
  assert.equal(isExpiredFinalizedMatch({ status: 'finalized', finalizedAt: '2026-09-07T00:00:01.000Z' }, now, 3), false);
  assert.equal(isExpiredFinalizedMatch({ status: 'draft', finalizedAt: '2026-01-01T00:00:00.000Z' }, now, 3), false);

  const baseline = baselineFromPlayerMatch({ session_id: 1 }, [
    { player_id: 1, stats: { matches: 3, goals: 2, assists: 1, bestPlayer: 1 } }
  ], [
    { session_id: 1, status: 'finalized', appearances: [1], goals: [{ scorer_id: 1, assist_id: null }], best_player_id: null }
  ]);
  assert.deepEqual(baseline['1'], { matches: 2, goals: 1, assists: 1, bestPlayer: 1 });
});

test('keeps legacy matches scoreless and does not infer a draw', () => {
  const legacy = normalizeMatch({
    session_id: 1,
    title: 'Legacy',
    date: '2026-09-04',
    appearances: [1, 2],
    goals: [],
    status: 'finalized'
  }, season, null, { allowFinalized: true });

  assert.equal(supportsMatchResult({ session_id: 1 }), false);
  assert.equal('score' in legacy, false);
  assert.equal('result' in legacy, false);
  assert.deepEqual(aggregateFinalizedMatches([{ ...legacy, match_id: 1 }]).get(1), {
    matches: 1,
    goals: 0,
    assists: 0,
    bestPlayer: 0
  });
});

const resultSeason = {
  session_id: 3,
  result_tracking_enabled: true,
  player_match: [1, 2, 3, 4].map((player_id) => ({ player_id }))
};

function finalizedResultMatch(goals, against, match_id = 1) {
  return normalizeMatch({
    session_id: 3,
    title: `Result ${match_id}`,
    date: '2026-09-04',
    appearances: [1, 2, 3, 4],
    goals: goals.map((scorer_id) => ({ scorer_id, assist_id: null })),
    score: { against },
    status: 'finalized'
  }, resultSeason, null, { allowFinalized: true, defenderIds: new Set([3]) });
}

test('derives WIN, DRAW and LOSS from goals and opponent score for season 3', () => {
  const matches = [
    finalizedResultMatch([1, 2, 1], 1, 1),
    finalizedResultMatch([1, 2], 2, 2),
    finalizedResultMatch([1], 3, 3)
  ];
  assert.equal(matches[0].score.for, 3);
  assert.equal(matches[0].result, 'WIN');
  assert.equal(matches[1].result, 'DRAW');
  assert.equal(matches[2].result, 'LOSS');

  const totals = aggregateFinalizedMatches(matches, [resultSeason]);
  assert.deepEqual(totals.get(4), { matches: 3, goals: 0, assists: 0, bestPlayer: 0, wins: 1, draws: 1, losses: 1 });
});

test('aggregates season-level goals against and result totals', () => {
  const matches = [
    finalizedResultMatch([1, 2, 1], 1, 1),
    finalizedResultMatch([1, 2], 2, 2),
    finalizedResultMatch([1], 3, 3)
  ];
  assert.deepEqual(aggregateSeasonMatchStats(matches, resultSeason), {
    matches: 3,
    goalsFor: 6,
    goalsAgainst: 6,
    cleanSheets: 0,
    wins: 1,
    draws: 1,
    losses: 1
  });
});

test('counts a clean sheet only when a finalized match records zero goals against', () => {
  const matches = [
    finalizedResultMatch([1], 0, 1),
    finalizedResultMatch([1], 2, 2),
    { status: 'finalized', goals: [], score: {} }
  ];

  assert.equal(aggregateSeasonMatchStats(matches, resultSeason).cleanSheets, 1);
});

test('reprocessing a finalized result match is idempotent', () => {
  const match = finalizedResultMatch([1, 2], 1);
  const first = aggregateFinalizedMatches([match], [resultSeason]);
  const second = aggregateFinalizedMatches([match], [resultSeason]);
  assert.deepEqual(second.get(1), first.get(1));
  assert.deepEqual(second.get(1), { matches: 1, goals: 1, assists: 0, bestPlayer: 0, wins: 1, draws: 0, losses: 0 });
});

test('rejects a score.for that disagrees with the goals list', () => {
  assert.throws(() => normalizeMatch({
    session_id: 3,
    title: 'Invalid score',
    date: '2026-09-04',
    appearances: [1, 2],
    goals: [{ scorer_id: 1, assist_id: null }, { scorer_id: 2, assist_id: null }],
    score: { for: 3, against: 1 },
    status: 'finalized'
  }, { ...resultSeason, player_match: [{ player_id: 1 }, { player_id: 2 }] }, null, { allowFinalized: true }), /score\.for must equal/);
});
