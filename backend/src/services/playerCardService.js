const { readCollection, addRecord, updateRecord, removeRecord } = require('../jsonStore');

const PLAYERS_FILE = 'players.json';
const PROGRAMS_FILE = 'programs.json';
const PLAYER_CARDS_FILE = 'player_cards.json';

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const arrayOr = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return fallback;
  return [value];
};

const objectOr = (value, fallback = {}) => (
  value && typeof value === 'object' && !Array.isArray(value) ? value : fallback
);

function getPlayerById(value) {
  const requested = value && typeof value === 'object'
    ? value.player_id ?? value.playerId ?? value.objectId
    : value;
  return readCollection(PLAYERS_FILE).find((player) => (
    String(player.player_id) === String(requested)
    || String(player.objectId || '') === String(requested)
  )) || null;
}

function getProgramById(value) {
  const requested = value && typeof value === 'object'
    ? value.program_id ?? value.programId ?? value.code ?? value.name
    : value;
  return readCollection(PROGRAMS_FILE).find((program) => (
    String(program.program_id) === String(requested)
    || String(program.code || '').toLowerCase() === String(requested || '').toLowerCase()
    || String(program.name || '').toLowerCase() === String(requested || '').toLowerCase()
  )) || null;
}

function getPlayerCardById(value) {
  return readCollection(PLAYER_CARDS_FILE).find((card) => Number(card.player_card_id) === Number(value)) || null;
}

function getPlayerCards(playerId) {
  return readCollection(PLAYER_CARDS_FILE).filter((card) => Number(card.player_id) === Number(playerId));
}

function resolvePlayerCard(card) {
  if (!card) return null;
  return { ...card, program: getProgramById(card.program_id) };
}

function getCurrentPlayerCard(playerOrId) {
  const player = playerOrId && typeof playerOrId === 'object' ? playerOrId : getPlayerById(playerOrId);
  if (!player?.current_card_id) return null;
  const card = getPlayerCardById(player.current_card_id);
  return card && Number(card.player_id) === Number(player.player_id) ? card : null;
}

function resolvePlayer(player) {
  const cards = getPlayerCards(player.player_id).map(resolvePlayerCard);
  const currentCard = resolvePlayerCard(getCurrentPlayerCard(player));
  const fallbackProgram = arrayOr(player.program).filter(Boolean);
  const programName = currentCard?.program?.name;
  return {
    ...player,
    cards,
    currentCard,
    // These are read-only compatibility projections for existing list/UI code.
    program: programName ? [programName] : fallbackProgram,
    ovr: currentCard?.ovr ?? player.ovr ?? 0,
    position: currentCard?.position ?? arrayOr(player.position),
    imageCard: currentCard?.imageCard ? [currentCard.imageCard] : arrayOr(player.imageCard),
    Status_I_H_M: currentCard?.Status_I_H_M ?? player.Status_I_H_M ?? 'Matching'
  };
}

function normalizeCard(input, existing = {}) {
  const player = getPlayerById(input.player_id ?? existing.player_id);
  const program = getProgramById(input.program_id ?? existing.program_id ?? input.program);
  if (!player) {
    const error = new Error(`Player ${input.player_id ?? existing.player_id} does not exist.`);
    error.statusCode = 400;
    throw error;
  }
  if (!program) {
    const error = new Error(`Program ${input.program_id ?? existing.program_id ?? input.program} does not exist.`);
    error.statusCode = 400;
    throw error;
  }
  const metadata = { ...objectOr(existing.metadata), ...objectOr(input.metadata) };
  return {
    ...existing,
    ...input,
    player_id: Number(player.player_id),
    program_id: Number(program.program_id),
    ovr: numberOr(input.ovr ?? input.rating ?? existing.ovr),
    position: arrayOr(input.position, existing.position || []).map((position) => String(position).trim().toLowerCase()).filter(Boolean),
    Status_I_H_M: String(input.Status_I_H_M ?? input.cardType ?? existing.Status_I_H_M ?? 'Matching'),
    imageCard: String(input.imageCard ?? existing.imageCard ?? '').trim(),
    metadata: {
      ...metadata,
      note: metadata.note || '',
      createdAt: metadata.createdAt || new Date().toISOString().slice(0, 10)
    }
  };
}

function createPlayerCard(input) {
  return addRecord(PLAYER_CARDS_FILE, normalizeCard(input), 'player_card_id');
}

function updatePlayerCard(id, input) {
  const existing = getPlayerCardById(id);
  if (!existing) return null;
  const normalized = normalizeCard({ ...input, player_id: existing.player_id }, existing);
  return updateRecord(PLAYER_CARDS_FILE, id, normalized, 'player_card_id');
}

function setCurrentPlayerCard(playerId, playerCardId) {
  const player = getPlayerById(playerId);
  const card = getPlayerCardById(playerCardId);
  if (!player || !card || Number(card.player_id) !== Number(player.player_id)) return null;
  return updateRecord(PLAYERS_FILE, player.player_id, { current_card_id: Number(card.player_card_id) }, 'player_id');
}

function clearCurrentPlayerCard(playerId) {
  return updateRecord(PLAYERS_FILE, playerId, { current_card_id: null }, 'player_id');
}

function removePlayerCard(id) {
  return removeRecord(PLAYER_CARDS_FILE, id, 'player_card_id');
}

module.exports = {
  PLAYERS_FILE,
  PROGRAMS_FILE,
  PLAYER_CARDS_FILE,
  numberOr,
  arrayOr,
  objectOr,
  getPlayerById,
  getProgramById,
  getPlayerCardById,
  getPlayerCards,
  getCurrentPlayerCard,
  resolvePlayerCard,
  resolvePlayer,
  normalizeCard,
  createPlayerCard,
  updatePlayerCard,
  setCurrentPlayerCard,
  clearCurrentPlayerCard,
  removePlayerCard
};
