const assert = require('node:assert/strict');
const test = require('node:test');
const { readCollection, writeCollection } = require('../src/jsonStore');
const { applyHth, applyLastWeekCup } = require('../src/services/honorService');

const playersFile = 'players.json';
const sessionsFile = 'sessions.json';

test('applies HTH once to every registered player and never to outside players', () => {
  const playersBefore = readCollection(playersFile);
  const sessionsBefore = readCollection(sessionsFile);
  try {
    writeCollection(playersFile, [
      { player_id: 1, active: { HTH: ['10*'], lastWeekCup: 0 } },
      { player_id: 2, active: { HTH: [], lastWeekCup: 0 } },
      { player_id: 9, active: { HTH: [], lastWeekCup: 0 } },
      { player_id: 99, active: { HTH: [], lastWeekCup: 0 } }
    ]);
    writeCollection(sessionsFile, [{ session_id: 5, Archive: '20*', player_match: [{ player_id: 1 }, { player_id: 2 }, { player_id: 9 }] }]);

    const result = applyHth(5, '2026-09-03T00:00:00.000Z');
    const players = readCollection(playersFile);
    assert.deepEqual(players.find((player) => player.player_id === 1).active.HTH, [{ session_id: null, value: '10*' }, { session_id: 5, value: '20*' }]);
    assert.deepEqual(players.find((player) => player.player_id === 2).active.HTH, [{ session_id: 5, value: '20*' }]);
    assert.deepEqual(players.find((player) => player.player_id === 99).active.HTH, []);
    assert.equal(result.session.honor_updates.hth.applied, true);
    assert.throws(() => applyHth(5), (error) => error.statusCode === 409);
  } finally {
    writeCollection(playersFile, playersBefore);
    writeCollection(sessionsFile, sessionsBefore);
  }
});

test('increments selected players by exactly one and makes the same batch a no-op', () => {
  const playersBefore = readCollection(playersFile);
  const sessionsBefore = readCollection(sessionsFile);
  try {
    writeCollection(playersFile, [
      { player_id: 1, active: { HTH: [], lastWeekCup: 2 } },
      { player_id: 9, active: { HTH: [], lastWeekCup: 4 } },
      { player_id: 2, active: { HTH: [], lastWeekCup: 7 } }
    ]);
    writeCollection(sessionsFile, [{ session_id: 5, Archive: '20*', player_match: [{ player_id: 1 }, { player_id: 9 }, { player_id: 2 }] }]);

    const first = applyLastWeekCup(5, [1, 9], 'lwc-test-001', '2026-09-03T00:00:00.000Z');
    let players = readCollection(playersFile);
    assert.equal(players.find((player) => player.player_id === 1).active.lastWeekCup, 3);
    assert.equal(players.find((player) => player.player_id === 9).active.lastWeekCup, 5);
    assert.equal(players.find((player) => player.player_id === 2).active.lastWeekCup, 7);
    assert.equal(first.alreadyApplied, false);

    const second = applyLastWeekCup(5, [1, 9], 'lwc-test-001');
    players = readCollection(playersFile);
    assert.equal(second.alreadyApplied, true);
    assert.equal(players.find((player) => player.player_id === 1).active.lastWeekCup, 3);
    assert.equal(players.find((player) => player.player_id === 9).active.lastWeekCup, 5);
    assert.throws(() => applyLastWeekCup(5, [1, 1], 'lwc-test-002'), (error) => error.statusCode === 400);
    assert.throws(() => applyLastWeekCup(5, [99], 'lwc-test-003'), (error) => error.statusCode === 400);
  } finally {
    writeCollection(playersFile, playersBefore);
    writeCollection(sessionsFile, sessionsBefore);
  }
});
