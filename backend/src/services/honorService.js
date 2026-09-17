const crypto = require('crypto');
const { readCollection, writeCollection } = require('../jsonStore');

const PLAYERS_FILE = 'players.json';
const SESSIONS_FILE = 'sessions.json';

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const validationError = (message, statusCode = 400, details) => Object.assign(new Error(message), { statusCode, details });

function normalizeHthEntries(value) {
  const source = Array.isArray(value) ? value : value ? [value] : [];
  return source.map((entry) => {
    if (entry && typeof entry === 'object') {
      const sessionId = entry.session_id === null || entry.session_id === undefined || entry.session_id === '' ? null : Number(entry.session_id);
      return { session_id: Number.isFinite(sessionId) ? sessionId : null, value: String(entry.value ?? '').trim() };
    }
    return { session_id: null, value: String(entry ?? '').trim() };
  }).filter((entry) => entry.value);
}

function registeredPlayerIds(session) {
  return [...new Set((session.player_match || []).map((item) => numberOr(item?.player_id, NaN)).filter(Number.isFinite))];
}

function findSession(sessionId, sessions = readCollection(SESSIONS_FILE)) {
  return sessions.find((session) => Number(session.session_id) === Number(sessionId));
}

function withTransaction(work) {
  const playersBefore = readCollection(PLAYERS_FILE);
  const sessionsBefore = readCollection(SESSIONS_FILE);
  try {
    return work(playersBefore, sessionsBefore);
  } catch (error) {
    try {
      writeCollection(PLAYERS_FILE, playersBefore);
      writeCollection(SESSIONS_FILE, sessionsBefore);
    } catch (rollbackError) {
      error.rollbackError = rollbackError.message;
    }
    throw error;
  }
}

function applyHth(sessionId, now = new Date().toISOString()) {
  return withTransaction((players, sessions) => {
    const session = findSession(sessionId, sessions);
    if (!session) throw validationError('Season không tồn tại.', 404);
    const archive = String(session.Archive ?? '').trim();
    if (!archive) throw validationError('Season chưa có Archive để cập nhật HTH.');
    const playerIds = registeredPlayerIds(session);
    if (!playerIds.length) throw validationError('Season chưa có cầu thủ đăng ký.');
    if (session.honor_updates?.hth?.applied) throw validationError('HTH của Season này đã được cập nhật trước đó.', 409);

    const playerIdSet = new Set(players.map((player) => Number(player.player_id)));
    const missingIds = playerIds.filter((playerId) => !playerIdSet.has(playerId));
    if (missingIds.length) throw validationError('Season chứa player không tồn tại.', 400, { player_ids: missingIds });

    const registeredSet = new Set(playerIds);
    const updatedPlayers = players.map((player) => {
      if (!registeredSet.has(Number(player.player_id))) return player;
      return { ...player, active: { ...(player.active || {}), HTH: [...normalizeHthEntries(player.active?.HTH), { session_id: Number(session.session_id), value: archive }] } };
    });
    const updatedSession = {
      ...session,
      honor_updates: {
        ...(session.honor_updates || {}),
        hth: { applied: true, archive, applied_at: now }
      }
    };
    writeCollection(PLAYERS_FILE, updatedPlayers);
    writeCollection(SESSIONS_FILE, sessions.map((item) => Number(item.session_id) === Number(session.session_id) ? updatedSession : item));
    return { session: updatedSession, players: updatedPlayers, player_ids: playerIds };
  });
}

function makeBatchId() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);
  return `lwc-${stamp}-${crypto.randomBytes(3).toString('hex')}`;
}

function applyLastWeekCup(sessionId, playerIds, batchId = makeBatchId(), now = new Date().toISOString()) {
  return withTransaction((players, sessions) => {
    const session = findSession(sessionId, sessions);
    if (!session) throw validationError('Season không tồn tại.', 404);
    if (!Array.isArray(playerIds) || !playerIds.length) throw validationError('Phải chọn ít nhất một cầu thủ.');
    const normalizedIds = playerIds.map((id) => Number(id));
    if (normalizedIds.some((id) => !Number.isInteger(id) || id < 1)) throw validationError('player_ids không hợp lệ.');
    if (new Set(normalizedIds).size !== normalizedIds.length) throw validationError('Không được chọn trùng player_id.');
    const registeredIds = new Set(registeredPlayerIds(session));
    const outsideSeason = normalizedIds.filter((id) => !registeredIds.has(id));
    if (outsideSeason.length) throw validationError('Chỉ được cập nhật cầu thủ đã đăng ký trong Season.', 400, { player_ids: outsideSeason });
    const existingBatch = (Array.isArray(session.last_week_cup_batches) ? session.last_week_cup_batches : []).find((batch) => batch.batch_id === batchId);
    if (existingBatch) {
      const samePlayers = JSON.stringify([...existingBatch.player_ids].sort((a, b) => a - b)) === JSON.stringify([...normalizedIds].sort((a, b) => a - b));
      if (!samePlayers) throw validationError('batch_id đã được dùng cho selection khác.', 409);
      return { session, players, player_ids: normalizedIds, batch_id: batchId, alreadyApplied: true };
    }

    const playerIdSet = new Set(players.map((player) => Number(player.player_id)));
    const missingIds = normalizedIds.filter((playerId) => !playerIdSet.has(playerId));
    if (missingIds.length) throw validationError('Player không tồn tại.', 400, { player_ids: missingIds });
    const selected = new Set(normalizedIds);
    const updatedPlayers = players.map((player) => selected.has(Number(player.player_id))
      ? { ...player, active: { ...(player.active || {}), lastWeekCup: numberOr(player.active?.lastWeekCup) + 1 } }
      : player);
    const batch = { batch_id: batchId, player_ids: normalizedIds, applied_at: now };
    const existingBatches = Array.isArray(session.last_week_cup_batches) ? session.last_week_cup_batches : [];
    const updatedSession = { ...session, last_week_cup_batches: [...existingBatches, batch] };
    writeCollection(PLAYERS_FILE, updatedPlayers);
    writeCollection(SESSIONS_FILE, sessions.map((item) => Number(item.session_id) === Number(session.session_id) ? updatedSession : item));
    return { session: updatedSession, players: updatedPlayers, player_ids: normalizedIds, batch_id: batchId, alreadyApplied: false };
  });
}

module.exports = { normalizeHthEntries, applyHth, applyLastWeekCup, makeBatchId };
