const express = require('express');
const router = express.Router();
const { readCollection } = require('../jsonStore');

router.get('/', (req, res) => {
  try {
    res.json(readCollection('nation.json'));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch nations' });
  }
});

module.exports = router;
