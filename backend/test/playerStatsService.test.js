const assert = require('node:assert/strict');
const test = require('node:test');
const { calculatePlayerGlobalStats } = require('../src/services/playerStatsService');

const player = {
  player_id: 20,
  objectId: 'cesc-object-id',
  stats: {
    goalAmounts: 10,
    assistAmounts: 8,
    match: 12,
    bestPlayerAmount: 3,
    sessionAmount: 2
  }
};

test('keeps existing career totals without double-counting the first migrated season', () => {
  const sessions = [{
    session_id: 1,
    player_match: [{
      player_id: 20,
      stats: { goals: 4, assists: 3, matches: 5, bestPlayer: 1 }
    }]
  }];

  assert.deepEqual(calculatePlayerGlobalStats(20, sessions, [player]), {
    goalAmounts: 10,
    assistAmounts: 8,
    match: 12,
    bestPlayerAmount: 3,
    sessionAmount: 2
  });
});

test('adds stats from a newly registered season to the player ID totals', () => {
  const sessions = [
    {
      session_id: 1,
      player_match: [{ player_id: 20, stats: { goals: 4, assists: 3, matches: 5, bestPlayer: 1 } }]
    },
    {
      session_id: 2,
      player_match: [{ player_id: 20, stats: { goals: 2, assists: 1, matches: 3, bestPlayer: 2 } }]
    }
  ];
  const migratedPlayer = {
    ...player,
    stats_career_baseline: { goalAmounts: 6, assistAmounts: 5, match: 7, bestPlayerAmount: 2, sessionAmount: 1 }
  };

  assert.deepEqual(calculatePlayerGlobalStats(20, sessions, [migratedPlayer]), {
    goalAmounts: 12,
    assistAmounts: 9,
    match: 15,
    bestPlayerAmount: 5,
    sessionAmount: 3
  });
});

test('adds W/D/L only for a season with result tracking enabled', () => {
  const sessions = [{
    session_id: 3,
    result_tracking_enabled: true,
    player_match: [{
      player_id: 20,
      stats: { matches: 3, goals: 1, assists: 0, bestPlayer: 0, wins: 1, draws: 1, losses: 1 }
    }]
  }];
  const migratedPlayer = {
    ...player,
    stats_career_baseline: { goalAmounts: 6, assistAmounts: 5, match: 9, bestPlayerAmount: 3, sessionAmount: 2 }
  };

  assert.deepEqual(calculatePlayerGlobalStats(20, sessions, [migratedPlayer]), {
    goalAmounts: 7,
    assistAmounts: 5,
    match: 12,
    bestPlayerAmount: 3,
    sessionAmount: 3,
    wins: 1,
    draws: 1,
    losses: 1
  });
});
