const express = require('express');
const router = express.Router();
const { readCollection } = require('../jsonStore');

router.get('/stats', async (req, res) => {
  try {
    const players = readCollection('players.json');
    const matches = readCollection('matches.json');
    const sessions = readCollection('sessions.json');
    const sum = (field) => players.reduce((total, player) => total + (Number(player.stats?.[field]) || Number(player[field]) || 0), 0);
    const totalMatchesAcrossSeasons = sessions.reduce((total, session) => {
      const seasonMatches = (session.player_match || []).map((entry) => Number(entry.stats?.matches) || 0);
      return total + (seasonMatches.length ? Math.max(...seasonMatches) : 0);
    }, 0);
    const averageRating = players.length
      ? players.reduce((total, player) => total + (Number(player.ovr) || Number(player.rating) || 0), 0) / players.length
      : 0;
    const topRated = [...players].sort((a, b) => (Number(b.ovr) || Number(b.rating) || 0) - (Number(a.ovr) || Number(a.rating) || 0)).slice(0, 6);
    const recentMatches = [...matches].sort((a, b) => (Number(b.matchNumber) || 0) - (Number(a.matchNumber) || 0)).slice(0, 5);

    res.json({
      summary: {
        totalPlayers: players.length,
        totalMatches: totalMatchesAcrossSeasons,
        totalGoals: sum('goalAmounts'),
        totalAssists: sum('assistAmounts'),
        totalMotm: sum('bestPlayerAmount'),
        averageRating: Math.round(averageRating * 10) / 10
      },
      topRated,
      recentMatches
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard stats' });
  }
});

module.exports = router;
