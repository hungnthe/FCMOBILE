const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { readCollection, addRecord, updateRecord, removeRecord, writeCollection } = require('../jsonStore');
const { getPlayerCardById, getCurrentPlayerCard } = require('../services/playerCardService');
const { recalculateAllPlayerStats } = require('../services/playerStatsService');
const { getSessionPlayerUsage, removeMatchesForSession, baselineFromPlayerMatch, MATCHES_FILE } = require('../services/matchService');

const SESSIONS_FILE = 'sessions.json';
const SESSION_ID_KEY = 'session_id';
const MAX_SEASON_RANKING_PLAYERS = 14;
const PLAYERS_FILE = 'players.json';
const SESSION_IMAGE_DIR = path.resolve(__dirname, '../../../frontend/public/SessionImages');
const SESSION_VIDEO_DIR = path.resolve(__dirname, '../../../frontend/public/Video');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.ogg', '.mov']);

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};
const arrayOr = (value, fallback = []) => Array.isArray(value) ? value : fallback;
const objectOr = (value, fallback = {}) => value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
const boolOr = (value, fallback) => value === true || value === 'true' ? true : value === false || value === 'false' ? false : fallback;
const validationError = (message, details) => Object.assign(new Error(message), { statusCode: 400, details });

function getPlayerById(value) {
  const players = readCollection(PLAYERS_FILE);
  const requested = value && typeof value === 'object'
    ? value.player_id ?? value.playerId ?? value.objectId ?? value.player_objectId
    : value;
  return players.find((player) => String(player.player_id) === String(requested) || String(player.objectId || '') === String(requested)) || null;
}

function playerReferenceOf(value) {
  const player = getPlayerById(value);
  return player ? { player_id: Number(player.player_id), objectId: String(player.objectId || '') } : null;
}

function normalizePlayerMatch(value, fallback = []) {
  const sourceList = arrayOr(value, fallback);
  const seen = new Set();
  return sourceList.map((item) => {
    const source = item && typeof item === 'object' ? item : { objectId: item };
    const reference = playerReferenceOf(source);
    if (!reference) throw validationError(`player_match references an unknown player: ${source.player_id ?? source.objectId ?? source}`);
    if (seen.has(reference.player_id)) throw validationError(`Player ${reference.player_id} is registered more than once in this season.`);
    seen.add(reference.player_id);
    const stats = objectOr(source.stats);
    const requestedCardId = source.player_card_id ?? getCurrentPlayerCard(reference.player_id)?.player_card_id ?? null;
    const card = requestedCardId === null || requestedCardId === '' ? null : getPlayerCardById(requestedCardId);
    if (requestedCardId !== null && requestedCardId !== '' && (!card || Number(card.player_id) !== reference.player_id)) {
      throw validationError(`player_match player_card_id ${requestedCardId} does not belong to player ${reference.player_id}.`);
    }
    return {
      player_id: reference.player_id,
      objectId: reference.objectId,
      player_card_id: card ? Number(card.player_card_id) : null,
      stats: {
        matches: numberOr(stats.matches),
        goals: numberOr(stats.goals),
        assists: numberOr(stats.assists),
        bestPlayer: numberOr(stats.bestPlayer)
      }
    };
  });
}

function normalizeAwards(value, fallback = {}, playerMatch = []) {
  const awards = objectOr(value, fallback);
  const registeredIds = new Set(playerMatch.map((item) => Number(item.player_id)));
  return Object.fromEntries(Object.entries(awards).filter(([key, award]) => key !== 'best_player' && award?.title !== 'Cầu thủ xuất sắc nhất mùa').map(([key, award]) => {
    if (!award || typeof award !== 'object' || Array.isArray(award)) return [key, award];
    const playerId = award.player_id;
    if (playerId === null || playerId === undefined || playerId === '') return [key, { ...award, player_id: null }];
    const player = getPlayerById(playerId);
    if (!player) throw validationError(`Award ${key} references an unknown player: ${playerId}`);
    if (!registeredIds.has(Number(player.player_id))) throw validationError(`Award ${key} can only select a player registered in this season.`, { award: key, player_id: Number(player.player_id) });
    return [key, { ...award, player_id: Number(player.player_id) }];
  }));
}

function normalizePlayerRanking(value, fallback = [], playerMatch = []) {
  const eligibleIds = new Set(playerMatch
    .filter((item) => numberOr(item.stats?.matches) > 0)
    .map((item) => Number(item.player_id)));
  const isExplicit = value !== undefined;
  const source = isExplicit ? arrayOr(value) : arrayOr(fallback);
  const seen = new Set();
  const ranking = [];
  source.forEach((entry) => {
    const player = getPlayerById(entry);
    if (!player) {
      if (isExplicit) throw validationError(`player_ranking references an unknown player: ${entry}`);
      return;
    }
    const playerId = Number(player.player_id);
    if (!eligibleIds.has(playerId)) {
      if (isExplicit) throw validationError(`player_ranking can only contain players who played in this season: ${playerId}`);
      return;
    }
    if (!seen.has(playerId)) {
      if (ranking.length >= MAX_SEASON_RANKING_PLAYERS) {
        throw validationError(`A season ranking can contain at most ${MAX_SEASON_RANKING_PLAYERS} players.`);
      }
      seen.add(playerId);
      ranking.push(playerId);
    }
  });
  return ranking;
}

function normalizeSession(input = {}, existing = {}) {
  const { force: _force, ...cleanInput } = input;
  const title = cleanInput.Title ?? cleanInput.title ?? existing.Title ?? existing.title ?? 'Mùa giải mới';
  const playerMatch = normalizePlayerMatch(cleanInput.player_match, arrayOr(existing.player_match));
  const playerRanking = normalizePlayerRanking(cleanInput.player_ranking, arrayOr(existing.player_ranking), playerMatch);
  return {
    ...existing,
    ...cleanInput,
    Title: String(title).trim(),
    season: String(cleanInput.season ?? existing.season ?? '').trim(),
    description: String(cleanInput.description ?? existing.description ?? '').trim(),
    status: String(cleanInput.status ?? existing.status ?? 'ĐÃ LƯU TRỮ').trim(),
    image: String(cleanInput.image ?? existing.image ?? '').trim(),
    awardImage: String(cleanInput.awardImage ?? existing.awardImage ?? '').trim(),
    awards: normalizeAwards(cleanInput.awards, objectOr(existing.awards), playerMatch),
    player_match: playerMatch,
    player_ranking: playerRanking,
    awards_published: boolOr(cleanInput.awards_published, existing.awards_published ?? true),
    player_ranking_published: boolOr(cleanInput.player_ranking_published, existing.player_ranking_published ?? true),
    Archive: cleanInput.Archive ?? existing.Archive ?? '',
    lastWeekCup: cleanInput.lastWeekCup ?? existing.lastWeekCup ?? ''
  };
}

router.get('/images', (req, res) => {
  try {
    fs.mkdirSync(SESSION_IMAGE_DIR, { recursive: true });
    const images = fs.readdirSync(SESSION_IMAGE_DIR)
      .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort((left, right) => left.localeCompare(right))
      .map((file) => `public/SessionImages/${file}`);
    res.json(images);
  } catch (error) { sendError(res, error, 'Failed to list session images'); }
});

router.get('/videos', (req, res) => {
  try {
    fs.mkdirSync(SESSION_VIDEO_DIR, { recursive: true });
    const videos = fs.readdirSync(SESSION_VIDEO_DIR)
      .filter((file) => VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort((left, right) => left.localeCompare(right))
      .map((file) => `public/Video/${file}`);
    res.json(videos);
  } catch (error) { sendError(res, error, 'Failed to list session videos'); }
});

function sendError(res, error, fallback) {
  const status = error.statusCode || 500;
  res.status(status).json({ error: error.message || fallback, details: error.details });
}

function persistSession(id, normalized, existing = null) {
  const saved = updateRecord(SESSIONS_FILE, id, normalized, SESSION_ID_KEY);
  try {
    recalculateAllPlayerStats();
  } catch (error) {
    if (existing) updateRecord(SESSIONS_FILE, id, existing, SESSION_ID_KEY);
    throw error;
  }
  return saved;
}

router.get('/', (req, res) => {
  try {
    const sessions = readCollection(SESSIONS_FILE).sort((left, right) => Number(left.session_id) - Number(right.session_id));
    res.json(sessions);
  } catch (error) { sendError(res, error, 'Failed to fetch sessions'); }
});

router.get('/:id/players', (req, res) => {
  try {
    const session = readCollection(SESSIONS_FILE).find((item) => Number(item.session_id) === Number(req.params.id));
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const players = readCollection(PLAYERS_FILE);
    res.json((session.player_match || []).map((match) => {
      const player = players.find((item) => (
        Number(item.player_id) === Number(match.player_id)
        || String(item.objectId || '') === String(match.objectId || '')
      ));
      const seasonCard = match.player_card_id ? getPlayerCardById(match.player_card_id) : getCurrentPlayerCard(player);
      return player ? { ...player, seasonStats: match.stats || {}, playerMatch: match, seasonCard } : null;
    }).filter(Boolean));
  } catch (error) { sendError(res, error, 'Failed to resolve season players'); }
});

router.get('/:id', (req, res) => {
  try {
    const session = readCollection(SESSIONS_FILE).find((item) => Number(item.session_id) === Number(req.params.id));
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error) { sendError(res, error, 'Failed to fetch session'); }
});

router.post('/', (req, res) => {
  try {
    const body = req.body || {};
    const normalized = normalizeSession(body);
    if (Object.prototype.hasOwnProperty.call(body, 'player_match')) {
      normalized.stats_baseline = baselineFromPlayerMatch(normalized, normalized.player_match);
    }
    if (!normalized.Title) return res.status(400).json({ error: 'Title is required' });
    const before = readCollection(SESSIONS_FILE);
    const saved = addRecord(SESSIONS_FILE, normalized, SESSION_ID_KEY);
    try {
      recalculateAllPlayerStats();
    } catch (error) {
      writeCollection(SESSIONS_FILE, before);
      throw error;
    }
    res.status(201).json(saved);
  } catch (error) { sendError(res, error, 'Failed to create session'); }
});

router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = readCollection(SESSIONS_FILE).find((item) => Number(item.session_id) === id);
    if (!existing) return res.status(404).json({ error: 'Session not found' });
    const body = req.body || {};
    const normalized = normalizeSession(body, existing);
    if (Object.prototype.hasOwnProperty.call(body, 'player_match')) {
      normalized.stats_baseline = baselineFromPlayerMatch(normalized, normalized.player_match);
    }
    if (!normalized.Title) return res.status(400).json({ error: 'Title is required' });
    res.json(persistSession(id, normalized, existing));
  } catch (error) { sendError(res, error, 'Failed to update session'); }
});

router.delete('/:id/players/:playerId', (req, res) => {
  try {
    const id = Number(req.params.id);
    const playerId = Number(req.params.playerId);
    const existing = readCollection(SESSIONS_FILE).find((item) => Number(item.session_id) === id);
    if (!existing) return res.status(404).json({ error: 'Session not found' });
    const currentMatch = (existing.player_match || []).find((item) => Number(item.player_id) === playerId);
    if (!currentMatch) return res.status(404).json({ error: 'Player is not registered in this season' });
    const matchUsage = getSessionPlayerUsage(id, playerId);
    if (matchUsage.length) return res.status(409).json({ error: `Không thể xóa player ${playerId} khi đang được sử dụng trong trận đấu.`, usage: matchUsage, requiresConfirmation: false });
    const usedAwards = Object.entries(existing.awards || {}).filter(([, award]) => Number(award?.player_id) === playerId).map(([key, award]) => ({ key, title: award.title }));
    const stats = currentMatch.stats || {};
    const usedStats = ['matches', 'goals', 'assists', 'bestPlayer'].some((key) => numberOr(stats[key]) > 0);
    const usage = [...usedAwards.map((award) => `Danh hiệu: ${award.title || award.key}`), ...(usedStats ? [`Stats: ${numberOr(stats.matches)} trận, ${numberOr(stats.goals)} bàn, ${numberOr(stats.assists)} kiến tạo, ${numberOr(stats.bestPlayer)} MVP`] : [])];
    const force = req.query.force === 'true' || req.body?.force === true;
    if (usage.length && !force) return res.status(409).json({ error: `Không thể xóa player ${playerId} khi đang được sử dụng.`, usage, requiresConfirmation: true });
    const awards = Object.fromEntries(Object.entries(existing.awards || {}).map(([key, award]) => [key, Number(award?.player_id) === playerId ? { ...award, player_id: null } : award]));
    const normalized = normalizeSession({ player_match: (existing.player_match || []).filter((item) => Number(item.player_id) !== playerId), awards }, existing);
    res.json(persistSession(id, normalized, existing));
  } catch (error) { sendError(res, error, 'Failed to remove player from season'); }
});

router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const before = readCollection(SESSIONS_FILE);
    const matchesBefore = readCollection(MATCHES_FILE);
    const existing = before.find((item) => Number(item.session_id) === id);
    if (!existing) return res.status(404).json({ error: 'Session not found' });
    try {
      if (!removeRecord(SESSIONS_FILE, id, SESSION_ID_KEY)) return res.status(404).json({ error: 'Session not found' });
      removeMatchesForSession(id);
      recalculateAllPlayerStats();
    } catch (error) {
      writeCollection(SESSIONS_FILE, before);
      writeCollection(MATCHES_FILE, matchesBefore);
      throw error;
    }
    res.json({ message: 'Session deleted successfully' });
  } catch (error) { sendError(res, error, 'Failed to delete session'); }
});

module.exports = router;
