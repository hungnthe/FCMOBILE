const express = require('express');
const router = express.Router();
const { readCollection, writeCollection } = require('../jsonStore');
const { recalculateAllPlayerStats } = require('../services/playerStatsService');
const PLAYERS_FILE = 'players.json';
const {
  MATCHES_FILE,
  SESSIONS_FILE,
  getSessionById,
  getMatchById,
  normalizeMatch,
  recalculateSeasonPlayerStats,
  preserveSeasonStatsAfterMatchRemoval,
  addMatch,
  updateMatch,
  removeMatch
} = require('../services/matchService');

const sendError = (res, error, fallback) => res.status(error.statusCode || 500).json({
  error: error.message || fallback,
  details: error.details
});

function withTransaction(work) {
  const sessionsBefore = readCollection(SESSIONS_FILE);
  const matchesBefore = readCollection(MATCHES_FILE);
  const playersBefore = readCollection(PLAYERS_FILE);
  try {
    return work();
  } catch (error) {
    writeCollection(SESSIONS_FILE, sessionsBefore);
    writeCollection(MATCHES_FILE, matchesBefore);
    writeCollection(PLAYERS_FILE, playersBefore);
    try { recalculateAllPlayerStats(); } catch (_ignored) { /* preserve the original error */ }
    throw error;
  }
}

router.get('/', (req, res) => {
  try {
    const sessionId = req.query.session_id ?? req.query.sessionId;
    const matches = readCollection(MATCHES_FILE)
      .filter((match) => sessionId === undefined || Number(match.session_id) === Number(sessionId))
      .sort((left, right) => Number(right.match_id) - Number(left.match_id));
    res.json(matches);
  } catch (error) { sendError(res, error, 'Failed to fetch matches'); }
});

router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    const session = getSessionById(body.session_id);
    const normalized = normalizeMatch({ ...body, status: 'draft' }, session);
    res.status(201).json(addMatch(normalized));
  } catch (error) { sendError(res, error, 'Failed to create match'); }
});

router.get('/:id', (req, res) => {
  try {
    const match = getMatchById(req.params.id);
    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (error) { sendError(res, error, 'Failed to fetch match'); }
});

router.put('/:id', (req, res) => {
  try {
    const existing = getMatchById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Match not found' });
    const session = getSessionById(existing.session_id);
    const requestedStatus = req.body?.status ?? existing.status;
    if (existing.status === 'finalized' && requestedStatus !== 'finalized') {
      return res.status(400).json({ error: 'A finalized match cannot be reverted to draft.' });
    }
    if (existing.status === 'draft' && requestedStatus === 'finalized') {
      return res.status(400).json({ error: 'Use the finalize action to confirm a match.' });
    }
    const normalized = normalizeMatch(req.body || {}, session, existing, { allowFinalized: existing.status === 'finalized' });
    const saved = existing.status === 'finalized'
      ? withTransaction(() => {
        const updated = updateMatch(existing.match_id, normalized);
        const updatedSession = recalculateSeasonPlayerStats(existing.session_id);
        recalculateAllPlayerStats();
        return { match: updated, session: updatedSession };
      })
      : updateMatch(existing.match_id, normalized);
    res.json(saved);
  } catch (error) { sendError(res, error, 'Failed to update match'); }
});

router.post('/:id/finalize', (req, res) => {
  try {
    const existing = getMatchById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Match not found' });
    if (existing.status === 'finalized') return res.status(409).json({ error: 'Match has already been finalized.' });
    const session = getSessionById(existing.session_id);
    const normalized = normalizeMatch({ ...existing, ...(req.body || {}), status: 'finalized' }, session, existing, { allowFinalized: true });
    const result = withTransaction(() => {
      const match = updateMatch(existing.match_id, { ...normalized, finalizedAt: new Date().toISOString() });
      const updatedSession = recalculateSeasonPlayerStats(existing.session_id);
      recalculateAllPlayerStats();
      return { match, session: updatedSession };
    });
    res.json(result);
  } catch (error) { sendError(res, error, 'Failed to finalize match'); }
});

router.delete('/:id', (req, res) => {
  try {
    const existing = getMatchById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Match not found' });
    const result = existing.status === 'finalized'
      ? withTransaction(() => {
        removeMatch(existing.match_id);
        const session = preserveSeasonStatsAfterMatchRemoval(existing.session_id, readCollection(MATCHES_FILE));
        recalculateAllPlayerStats();
        return { message: 'Match deleted successfully; recorded statistics were kept.', session };
      })
      : { message: 'Match deleted successfully', deleted: removeMatch(existing.match_id) };
    res.json(result);
  } catch (error) { sendError(res, error, 'Failed to delete match'); }
});

module.exports = router;
