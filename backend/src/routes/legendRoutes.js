const express = require('express');
const router = express.Router();
const { readCollection } = require('../jsonStore');
const { resolvePlayer } = require('../services/playerCardService');
const { aggregatePlayerAwards } = require('../services/legendService');

router.get('/', (req, res) => {
  try {
    const players = readCollection('players.json').map(resolvePlayer);
    const sessions = readCollection('sessions.json');
    res.json(aggregatePlayerAwards(sessions, players));
  } catch (error) {
    console.error('Error building hall of legends:', error);
    res.status(500).json({ error: 'Failed to load hall of legends' });
  }
});

module.exports = router;
