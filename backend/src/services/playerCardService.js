const { readCollection, addRecord, updateRecord, removeRecord } = require('../jsonStore');
const { normalizeOvrAppearance, normalizeOvrPrograms, normalizeOvrPositions } = require('./ovrService');
const { hasDefensivePosition } = require('./defensiveStats');

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
  const appearance = normalizeOvrAppearance({}, card);
  const selection = normalizeOvrPrograms({}, card, appearance);
  return { ...card, ...appearance, ...selection, ...normalizeOvrPositions({}, card, appearance), program: selection.program_id ? getProgramById(selection.program_id) : null };
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
  const appearance = currentCard || normalizeOvrAppearance({}, player);
  const selection = currentCard || normalizeOvrPrograms({}, { ...player, program_id: player.program_id || getProgramById(fallbackProgram[0])?.program_id }, appearance);
  const selectedProgram = currentCard?.program || (selection.program_id ? getProgramById(selection.program_id) : null);
  const positions = currentCard || normalizeOvrPositions({}, player, appearance);
  const imageCard = [...new Set([
    appearance.imageCard,
    ...arrayOr(player.imageCard),
    ...arrayOr(player.metadata?.imageCard),
    ...cards.flatMap((card) => [...Object.values(objectOr(card.ovr_images)), ...arrayOr(card.imageCard)])
  ].filter((image) => typeof image === 'string').map((image) => image.trim()).filter(Boolean))];
  return {
    ...player,
    cards,
    currentCard,
    // These are read-only compatibility projections for existing list/UI code.
    program: selectedProgram ? [selectedProgram.name] : (currentCard || player.ovr_programs ? [] : fallbackProgram),
    program_id: selection.program_id,
    ovr_programs: selection.ovr_programs,
    ovr: currentCard?.ovr ?? player.ovr ?? 0,
    ovr_options: currentCard?.ovr_options ?? player.ovr_options ?? [player.ovr ?? 0],
    ovr_images: appearance.ovr_images,
    position: positions.position,
    tracksDefensiveStats: hasDefensivePosition(positions.position),
    ovr_positions: positions.ovr_positions,
    imageCard,
    Status_I_H_M: currentCard?.Status_I_H_M ?? player.Status_I_H_M ?? 'Matching'
  };
}

function normalizeCardPrograms(input, existing = {}, appearance = normalizeOvrAppearance(input, existing)) {
  const programInput = input.program !== undefined && input.program_id === undefined ? { ...input, program_id: getProgramById(input.program)?.program_id } : input;
  const selection = normalizeOvrPrograms(programInput, existing, appearance);
  if (!selection.program_id || Object.values(selection.ovr_programs).some((id) => !getProgramById(id))) {
    const error = new Error('Choose an existing Program for the selected OVR.');
    error.statusCode = 400;
    throw error;
  }
  return selection;
}

function normalizeCard(input, existing = {}) {
  const player = getPlayerById(input.player_id ?? existing.player_id);
  if (!player) {
    const error = new Error(`Player ${input.player_id ?? existing.player_id} does not exist.`);
    error.statusCode = 400;
    throw error;
  }
  const appearance = normalizeOvrAppearance(input, existing);
  const selection = normalizeCardPrograms(input, existing, appearance);
  const metadata = { ...objectOr(existing.metadata), ...objectOr(input.metadata) };
  return {
    ...existing,
    ...input,
    player_id: Number(player.player_id),
    ...appearance,
    ...selection,
    ...normalizeOvrPositions(input, existing, appearance),
    Status_I_H_M: String(input.Status_I_H_M ?? input.cardType ?? existing.Status_I_H_M ?? 'Matching'),
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
  normalizeCardPrograms,
  createPlayerCard,
  updatePlayerCard,
  setCurrentPlayerCard,
  clearCurrentPlayerCard,
  removePlayerCard
};
