const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeMatch,
  aggregateFinalizedMatches,
  baselineFromPlayerMatch,
  isExpiredFinalizedMatch
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
