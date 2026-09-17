const assert = require('node:assert/strict');
const test = require('node:test');
const { aggregatePlayerAwards } = require('../src/services/legendService');

test('aggregates only published six-category player awards and ignores legacy best_player', () => {
  const players = [
    { player_id: 1, name: 'Zidane', currentCard: { imageCard: 'public/ImageCard/zidane.png' } },
    { player_id: 2, name: 'Ajax Player' }
  ];
  const data = aggregatePlayerAwards([
    { session_id: 2, season: '2026', Title: 'Numero', awards: {
      golden_ball: { player_id: 1 }, best_goal: { player_id: 1, video: 'public/Video/goal.mp4' },
      best_player: { player_id: 2 }
    } },
    { session_id: 1, season: '2025', Title: 'Champions', awards: {
      top_scorer: { player_id: 1 }, silver_ball: { player_id: null }
    } }
  ], players);

  assert.equal(data.summary.honoredPlayers, 1);
  assert.equal(data.summary.totalAwards, 3);
  assert.equal(data.summary.seasons, 2);
  assert.deepEqual(data.legends[0].awards, {
    golden_ball: 1, silver_ball: 0, top_scorer: 1, top_assist: 0, best_transfer: 0, best_goal: 1
  });
  assert.equal(data.categories.best_goal.history[0].video, 'public/Video/goal.mp4');
});

test('uses the specified deterministic tie-break order', () => {
  const data = aggregatePlayerAwards([
    { session_id: 1, awards: { golden_ball: { player_id: 2 }, top_scorer: { player_id: 1 } } }
  ], [{ player_id: 1, name: 'Alpha' }, { player_id: 2, name: 'Beta' }]);

  assert.deepEqual(data.legends.map((item) => item.player_id), [2, 1]);
});
