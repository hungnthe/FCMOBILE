const express = require('express');
const router = express.Router();
const { readCollection } = require('../jsonStore');
const {
  PLAYER_CARDS_FILE,
  getPlayerById,
  getProgramById,
  getPlayerCardById,
  getPlayerCards,
  resolvePlayerCard,
  createPlayerCard,
  updatePlayerCard,
  setCurrentPlayerCard,
  removePlayerCard
} = require('../services/playerCardService');

const SESSIONS_FILE = 'sessions.json';

function sendError(res, error, fallback) {
  res.status(error.statusCode || 500).json({ error: error.message || fallback });
}

router.get('/', (req, res) => {
  try {
    let cards = readCollection(PLAYER_CARDS_FILE).map(resolvePlayerCard);
    if (req.query.player_id) cards = cards.filter((card) => Number(card.player_id) === Number(req.query.player_id));
    if (req.query.program_id) cards = cards.filter((card) => Number(card.program_id) === Number(req.query.program_id));
    if (req.query.position) cards = cards.filter((card) => (card.position || []).some((position) => String(position).toLowerCase() === String(req.query.position).toLowerCase()));
    if (req.query.ovr) cards = cards.filter((card) => Number(card.ovr) === Number(req.query.ovr));
    res.json(cards);
  } catch (error) { sendError(res, error, 'Failed to fetch player cards'); }
});

router.get('/:id', (req, res) => {
  try {
    const card = resolvePlayerCard(getPlayerCardById(req.params.id));
    if (!card) return res.status(404).json({ error: 'Player card not found' });
    res.json(card);
  } catch (error) { sendError(res, error, 'Failed to fetch player card'); }
});

router.post('/', (req, res) => {
  try {
    const card = createPlayerCard(req.body || {});
    const shouldSetCurrent = req.body?.set_current !== false;
    if (shouldSetCurrent) setCurrentPlayerCard(card.player_id, card.player_card_id);
    res.status(201).json(resolvePlayerCard(getPlayerCardById(card.player_card_id)));
  } catch (error) { sendError(res, error, 'Failed to create player card'); }
});

router.put('/:id', (req, res) => {
  try {
    const existing = getPlayerCardById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Player card not found' });
    if (req.body?.player_id !== undefined && Number(req.body.player_id) !== Number(existing.player_id)) return res.status(400).json({ error: 'A player card cannot be moved to another player.' });
    const card = updatePlayerCard(req.params.id, req.body || {});
    if (req.body?.set_current === true) setCurrentPlayerCard(card.player_id, card.player_card_id);
    res.json(resolvePlayerCard(getPlayerCardById(card.player_card_id)));
  } catch (error) { sendError(res, error, 'Failed to update player card'); }
});

router.post('/:id/current', (req, res) => {
  try {
    const card = getPlayerCardById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Player card not found' });
    const player = setCurrentPlayerCard(card.player_id, card.player_card_id);
    if (!player) return res.status(400).json({ error: 'Player card does not belong to the player.' });
    res.json({ player, currentCard: resolvePlayerCard(card) });
  } catch (error) { sendError(res, error, 'Failed to set current player card'); }
});

router.delete('/:id', (req, res) => {
  try {
    const card = getPlayerCardById(req.params.id);
    if (!card) return res.status(404).json({ error: 'Player card not found' });
    const player = getPlayerById(card.player_id);
    if (Number(player?.current_card_id) === Number(card.player_card_id)) return res.status(409).json({ error: 'Cannot delete the current player card. Set another card as current first.' });
    const usedInSeasons = readCollection(SESSIONS_FILE).flatMap((session) => (session.player_match || []).filter((match) => Number(match.player_card_id) === Number(card.player_card_id)).map(() => session.session_id));
    if (usedInSeasons.length) return res.status(409).json({ error: 'Cannot delete a card used by a season.', sessions: usedInSeasons });
    removePlayerCard(card.player_card_id);
    res.json({ message: 'Player card deleted successfully' });
  } catch (error) { sendError(res, error, 'Failed to delete player card'); }
});

module.exports = router;
