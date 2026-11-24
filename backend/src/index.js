const express = require('express');
const cors = require('cors');
require('dotenv').config();

const playerRoutes = require('./routes/playerRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const nationRoutes = require('./routes/nationRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const programRoutes = require('./routes/programRoutes');
const playerCardRoutes = require('./routes/playerCardRoutes');
const matchRoutes = require('./routes/matchRoutes');
const legendRoutes = require('./routes/legendRoutes');
const honorRoutes = require('./routes/honorRoutes');
const recordRoutes = require('./routes/recordRoutes');
const rankRoutes = require('./routes/rankRoutes');
const rankService = require('./services/rankService');
rankService.recover();
const { recalculateAllPlayerStats } = require('./services/playerStatsService');
const { cleanupExpiredMatches, initializeDefensiveStats, MATCH_RETENTION_DAYS } = require('./services/matchService');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// API Routes
app.use('/api/players', playerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/nations', nationRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/player-cards', playerCardRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/legends', legendRoutes);
app.use('/api/honors', honorRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/rank-journey', rankRoutes);

try {
  initializeDefensiveStats();
  recalculateAllPlayerStats();
} catch (error) {
  console.error('Unable to recalculate player global stats at startup:', error);
}

function cleanupMatches() {
  try {
    const result = cleanupExpiredMatches();
    if (result.matches.length) {
      recalculateAllPlayerStats();
      console.log(`Archived ${result.matches.length} match(es) after ${MATCH_RETENTION_DAYS} days; player statistics were preserved.`);
    }
  } catch (error) {
    console.error('Unable to archive expired matches:', error);
  }
}

// Run once on boot (so downtime is handled) and then check every hour.
cleanupMatches();
const matchCleanupTimer = setInterval(cleanupMatches, 60 * 60 * 1000);
matchCleanupTimer.unref?.();

rankService.initialize();

app.listen(PORT, () => {
  console.log(`⚽ Football Card Manager Backend API running on port ${PORT}`);
});
