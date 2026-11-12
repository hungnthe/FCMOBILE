const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const store = require('../src/jsonStore');

const players = ['ST', 'CM', 'LB', 'RB', 'GK', 'CB', 'LB'].map((position, index) => ({
  player_id: index + 1, position
}));
const archived = { matches: 4, wins: 2, draws: 1, losses: 1, goalsAgainst: 5, cleanSheets: 2 };
const session = {
  session_id: 1, result_tracking_enabled: true, defensive_stats_initialized: true, season_match_stats_baseline: archived,
  player_match: players.map(({ player_id }) => ({
    player_id, player_card_id: player_id === 2 ? 20 : null,
    stats: { matches: player_id === 7 ? 0 : player_id === 3 ? 3 : 4 }
  }))
};
const data = {
  'players.json': players,
  'player_cards.json': [{ player_id: 2, player_card_id: 20, ovr: 100, ovr_positions: { 100: ['CM', ' cDm '] } }],
  'sessions.json': [session, {
    session_id: 2, season_match_stats: { matches: 10, goalsAgainst: 8, cleanSheets: 4 },
    player_match: [{ player_id: 3, stats: { matches: 1 } }]
  }],
  'matches.json': [{ session_id: 1, date: '2026-11-01', status: 'finalized', appearances: [1, 2, 3, 4, 5], goals: [], score: { for: 0, against: 0 }, result: 'DRAW' }]
};
mock.method(store, 'readCollection', (name) => structuredClone(data[name] ?? []));
mock.method(store, 'writeCollection', (name, records) => { data[name] = structuredClone(records); });
mock.method(store, 'updateRecord', (name, id, changes, key) => {
  const record = data[name].find((item) => item[key] === id);
  Object.assign(record, structuredClone(changes));
  return structuredClone(record);
});
const { normalizeMatch, initializeDefensiveStats, recalculateSeasonPlayerStats, preserveSeasonStatsAfterMatchRemoval } = require('../src/services/matchService');
const { calculatePlayerGlobalStats } = require('../src/services/playerStatsService');

test('seeds full totals for seasons played, then counts only finalized appearances', () => {
  session.stats_baseline = Object.fromEntries(session.player_match.map((entry) => [entry.player_id, { ...entry.stats }]));
  initializeDefensiveStats();
  initializeDefensiveStats();
  const match = data['matches.json'][0];
  assert.deepEqual(match.defensive_appearances, [2, 3, 4, 5]);
  const totals = (id) => {
    const { goalsAgainst, cleanSheets } = calculatePlayerGlobalStats(id);
    return [goalsAgainst, cleanSheets];
  };
  assert.deepEqual(totals(1), [undefined, undefined]);
  assert.deepEqual(totals(2), [5, 3]);
  assert.deepEqual(totals(3), [13, 7]);
  assert.deepEqual(totals(6), [5, 3]);
  assert.deepEqual(totals(7), [undefined, undefined]);

  const next = normalizeMatch({
    date: '2026-11-02', status: 'finalized', appearances: [1, 3, 7], score: { against: 2 }
  }, session, null, { allowFinalized: true });
  data['matches.json'].push(next, { ...next, status: 'draft' });
  recalculateSeasonPlayerStats(1);
  initializeDefensiveStats();
  assert.deepEqual(totals(3), [15, 7]);
  assert.deepEqual(totals(6), [5, 3]);
  assert.deepEqual(totals(7), [2, 0]);

  // Player 2 later switches to an attacking card. A correction keeps their original credit.
  data['player_cards.json'][0].ovr_positions[100] = ['ST'];
  const corrected = normalizeMatch({ score: { against: 3 }, appearances: [1, 2, 5, 6] }, session, match, { allowFinalized: true });
  assert.deepEqual(corrected.defensive_appearances, [2, 5, 6]);
  data['matches.json'] = [corrected, next];
  recalculateSeasonPlayerStats(1);
  assert.deepEqual(totals(2), [8, 2]);
  assert.deepEqual(totals(3), [15, 6]);
  assert.deepEqual(totals(6), [8, 3]);
  data['matches.json'] = [next];
  preserveSeasonStatsAfterMatchRemoval(1, [next], { archivedMatches: [corrected] });
  recalculateSeasonPlayerStats(1);
  assert.deepEqual(totals(2), [8, 2]);
  const cleanSheet = normalizeMatch({ score: { against: 0 } }, session, next, { allowFinalized: true });
  data['matches.json'] = [cleanSheet];
  recalculateSeasonPlayerStats(1);
  assert.deepEqual(totals(7), [0, 1]);
  assert.deepEqual(totals(6), [8, 3]);
});

test('requires an explicit opponent score to finalize a tracked match', () => {
  for (const against of [null, '', ' ', false, -1]) {
    assert.throws(() => normalizeMatch({ date: '2026-11-01', status: 'finalized', score: { against } }, session, null, { allowFinalized: true }), /score.against/);
  }
});

test('career edits survive sync, match finalization and score corrections', async () => {
  const playerRoutes = require('../src/routes/playerRoutes');
  const matchRoutes = require('../src/routes/matchRoutes');
  const request = (router, method, url, body) => new Promise((resolve, reject) => {
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(value) { this.statusCode >= 400 ? reject(new Error(value.error)) : resolve(value); }
    };
    router.handle({ method, url, body }, res, reject);
  });
  data['players.json'] = [{ player_id: 1, name: 'Keeper', position: ['GK'], ovr: 100 }];
  data['programs.json'] = [];
  data['player_cards.json'] = [];
  data['sessions.json'] = [{
    session_id: 1, result_tracking_enabled: true,
    player_match: [{ player_id: 1, stats: { matches: 8, goalsAgainst: 12, cleanSheets: 3 } }]
  }];
  data['matches.json'] = [{
    session_id: 1, match_id: 1, status: 'draft', date: '2026-11-12', appearances: [1], goals: [], score: { against: 0 }
  }];
  const sessionsBefore = structuredClone(data['sessions.json']);
  const matchesBefore = structuredClone(data['matches.json']);
  const edit = { careerStatEdits: {
    match: { previous: 8, value: 10 },
    goalsAgainst: { previous: 12, value: 0 },
    cleanSheets: { previous: 3, value: 5 }
  } };
  for (let attempt = 0; attempt < 2; attempt++) {
    const saved = await request(playerRoutes, 'PUT', '/1', edit);
    assert.equal(saved.stats.match, 10);
    assert.equal(saved.stats.goalsAgainst, 0);
    assert.equal(saved.stats.cleanSheets, 5);
  }
  assert.deepEqual(data['sessions.json'], sessionsBefore);
  assert.deepEqual(data['matches.json'], matchesBefore);
  await request(matchRoutes, 'POST', '/1/finalize', {});
  assert.equal(data['players.json'][0].stats.cleanSheets, 6);
  await request(matchRoutes, 'PUT', '/1', { score: { against: 2 } });
  await request(playerRoutes, 'POST', '/recalculate-stats', {});
  const { stats } = await request(playerRoutes, 'GET', '/1');
  assert.equal(stats.match, 11);
  assert.equal(stats.goalsAgainst, 2);
  assert.equal(stats.cleanSheets, 5);
  assert.equal(stats.losses, 1);
  assert.equal(data['sessions.json'][0].player_match[0].stats.goalsAgainst, 14);
  assert.equal(data['sessions.json'][0].player_match[0].stats.matches, 9);
  await assert.rejects(request(playerRoutes, 'PUT', '/1', edit), /vừa được cập nhật/);
  assert.deepEqual(data['players.json'][0].stats, stats);
});
