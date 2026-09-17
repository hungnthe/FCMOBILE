const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { readCollection, addRecord, updateRecord, removeRecord } = require('../jsonStore');
const {
  resolvePlayer,
  getPlayerCardById,
  getPlayerCards,
  createPlayerCard
} = require('../services/playerCardService');
const { recalculateAllPlayerStats } = require('../services/playerStatsService');
const { normalizeHthEntries } = require('../services/honorService');

const PLAYERS_FILE = 'players.json';
const NATION_FILE = 'nation.json';
const PLAYER_ID_KEY = 'player_id';
const IMAGE_CARD_DIR = path.resolve(__dirname, '../../../frontend/public/ImageCard');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const newObjectId = () => crypto.randomBytes(12).toString('hex');

const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const arrayOr = (value, fallback = []) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return fallback;
  return [value];
};

const nationIdOf = (value) => {
  if (value && typeof value === 'object') return Number(value.nation_id ?? value.id) || null;
  if (Number.isFinite(Number(value)) && String(value).trim() !== '') return Number(value);
  const match = readCollection(NATION_FILE).find((nation) => String(nation.name).toLowerCase() === String(value || '').trim().toLowerCase() || String(nation.code).toLowerCase() === String(value || '').trim().toLowerCase());
  return match ? Number(match.nation_id) : null;
};

const nationReference = (value) => {
  const nationId = nationIdOf(value);
  return nationId ? { nation_id: nationId } : null;
};

const nationNameOf = (value) => {
  const nationId = nationIdOf(value);
  const nation = readCollection(NATION_FILE).find((item) => Number(item.nation_id) === nationId);
  return nation?.name || (typeof value === 'string' ? value : '');
};

function normalizePlayer(input, existing = {}) {
  const { card: _card, ...playerInput } = input || {};
  const incomingStats = playerInput.stats || {};
  const currentStats = existing.stats || {};
  const incomingActive = playerInput.active || {};
  const currentActive = existing.active || {};
  const incomingMetadata = playerInput.metadata || {};
  const currentMetadata = existing.metadata || {};
  const nation = nationReference(playerInput.nation !== undefined ? playerInput.nation : existing.nation) || existing.nation || null;

  const stats = {
    ...currentStats,
    ...incomingStats,
    goalAmounts: numberOr(incomingStats.goalAmounts ?? playerInput.goals ?? currentStats.goalAmounts),
    assistAmounts: numberOr(incomingStats.assistAmounts ?? playerInput.assists ?? currentStats.assistAmounts),
    match: numberOr(incomingStats.match ?? playerInput.matches ?? currentStats.match),
    bestPlayerAmount: numberOr(incomingStats.bestPlayerAmount ?? playerInput.motm ?? currentStats.bestPlayerAmount),
    sessionAmount: numberOr(incomingStats.sessionAmount ?? currentStats.sessionAmount)
  };

  return {
    ...existing,
    ...playerInput,
    objectId: playerInput.objectId || existing.objectId || newObjectId(),
    current_card_id: playerInput.current_card_id !== undefined ? playerInput.current_card_id : (existing.current_card_id ?? null),
    program: arrayOr(playerInput.program, existing.program || []),
    ovr: numberOr(playerInput.ovr ?? playerInput.rating ?? existing.ovr, 75),
    position: arrayOr(playerInput.position, existing.position || []).map((item) => String(item).toLowerCase()),
    nation,
    Status_I_H_M: playerInput.Status_I_H_M ?? playerInput.cardType ?? existing.Status_I_H_M ?? 'Gold',
    number: numberOr(playerInput.number ?? existing.number),
    name: playerInput.name ?? existing.name ?? 'Unknown Player',
    stats,
    active: { ...currentActive, ...incomingActive, HTH: normalizeHthEntries(incomingActive.HTH ?? currentActive.HTH), lastWeekCup: numberOr(incomingActive.lastWeekCup ?? currentActive.lastWeekCup) },
    imageCard: arrayOr(playerInput.imageCard, existing.imageCard || []),
    metadata: {
      ...currentMetadata,
      ...incomingMetadata,
      note: incomingMetadata.note ?? currentMetadata.note ?? '',
      imageCard: arrayOr(incomingMetadata.imageCard, currentMetadata.imageCard || []),
      createdAt: currentMetadata.createdAt || incomingMetadata.createdAt || new Date().toISOString().slice(0, 10)
    }
  };
}

function playerId(player) {
  return Number(player.player_id);
}

function statValue(player, key) {
  return numberOr(player.stats?.[key]);
}

const upload = multer({ storage: multer.memoryStorage() });

// Get all players with search & filters
router.get('/', async (req, res) => {
  try {
    const { search, cardType, position, nation, sortBy = 'rating', order = 'desc' } = req.query;

    const sortAliases = { rating: 'ovr', goals: 'stats.goalAmounts', assists: 'stats.assistAmounts', matches: 'stats.match', motm: 'stats.bestPlayerAmount', session: 'stats.sessionAmount' };
    const validSortFields = ['ovr', 'name', 'stats.goalAmounts', 'stats.assistAmounts', 'stats.match', 'stats.bestPlayerAmount', 'stats.sessionAmount'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : (sortAliases[sortBy] || 'ovr');
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    let players = readCollection(PLAYERS_FILE).map(resolvePlayer);
    const query = String(search || '').trim().toLowerCase();
    if (query) {
      players = players.filter((player) => [player.name, nationNameOf(player.nation), ...arrayOr(player.program)]
        .some((value) => String(value || '').toLowerCase().includes(query)));
    }
    if (cardType && cardType !== 'ALL') {
      players = players.filter((player) => String(player.Status_I_H_M).toLowerCase() === String(cardType).toLowerCase());
    }
    if (position && position !== 'ALL') {
      players = players.filter((player) => arrayOr(player.position).some((item) => String(item).toLowerCase() === String(position).toLowerCase()));
    }
    if (nation && nation !== 'ALL') {
      const requestedNationId = nationIdOf(nation);
      players = players.filter((player) => requestedNationId ? nationIdOf(player.nation) === requestedNationId : nationNameOf(player.nation).toLowerCase() === String(nation).toLowerCase());
    }
    players.sort((a, b) => {
      const getSortValue = (player) => sortField === 'name'
        ? String(player.name || '').toLowerCase()
        : numberOr(sortField.startsWith('stats.') ? player.stats?.[sortField.split('.')[1]] : player[sortField]);
      const left = getSortValue(a);
      const right = getSortValue(b);
      const result = sortField === 'name' ? left.localeCompare(right) : left - right;
      return sortOrder === 'asc' ? result : -result;
    });

    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

router.post('/recalculate-stats', (req, res) => {
  try {
    const players = recalculateAllPlayerStats();
    res.json({ message: `Recalculated global stats for ${players.length} players.`, count: players.length, players });
  } catch (error) {
    console.error('Error recalculating player stats:', error);
    res.status(500).json({ error: 'Failed to recalculate player stats' });
  }
});

// List image cards available in the frontend public folder.
router.get('/image-cards', (req, res) => {
  try {
    fs.mkdirSync(IMAGE_CARD_DIR, { recursive: true });
    const files = fs.readdirSync(IMAGE_CARD_DIR)
      .filter((file) => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .sort((left, right) => left.localeCompare(right));
    res.json(files.map((file) => `public/ImageCard/${file}`));
  } catch (error) {
    console.error('Error listing image cards:', error);
    res.status(500).json({ error: 'Failed to list image cards' });
  }
});

// Upload a new image card directly into frontend/public/ImageCard.
router.post('/image-cards', upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    fs.mkdirSync(IMAGE_CARD_DIR, { recursive: true });
    const safeOriginalName = path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const extension = path.extname(safeOriginalName).toLowerCase() || '.png';
    const stem = path.basename(safeOriginalName, extension) || 'image-card';
    let filename = `${stem}${extension}`;
    let counter = 1;

    while (fs.existsSync(path.join(IMAGE_CARD_DIR, filename))) {
      filename = `${stem}-${counter}${extension}`;
      counter += 1;
    }

    fs.writeFileSync(path.join(IMAGE_CARD_DIR, filename), req.file.buffer);
    res.status(201).json({ path: `public/ImageCard/${filename}`, filename });
  } catch (error) {
    console.error('Error uploading image card:', error);
    res.status(500).json({ error: 'Failed to upload image card' });
  }
});

// Get player by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const player = readCollection(PLAYERS_FILE).find((item) => playerId(item) === id);
    if (!player) return res.status(404).json({ error: 'Player not found' });
    res.json(resolvePlayer(player));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player details' });
  }
});

// Create player
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const { name, position, nation } = body;

    if (!name || !position || !nation || !nationReference(nation)) {
      return res.status(400).json({ error: 'Missing required fields: name, position, nation' });
    }

    const player = addRecord(PLAYERS_FILE, normalizePlayer(body), PLAYER_ID_KEY);
    const cardInput = body.card || (body.program || body.ovr || body.position || body.imageCard ? {
      program: Array.isArray(body.program) ? body.program[0] : body.program,
      ovr: body.ovr,
      position: body.position,
      Status_I_H_M: body.Status_I_H_M,
      imageCard: Array.isArray(body.imageCard) ? body.imageCard[0] : body.imageCard
    } : null);
    if (cardInput) {
      const card = createPlayerCard({ ...cardInput, player_id: player.player_id });
      updateRecord(PLAYERS_FILE, player.player_id, { current_card_id: card.player_card_id }, PLAYER_ID_KEY);
    }
    recalculateAllPlayerStats();

    res.status(201).json(resolvePlayer(readCollection(PLAYERS_FILE).find((item) => playerId(item) === playerId(player))));
  } catch (error) {
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// Update player
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const records = readCollection(PLAYERS_FILE);
    const existing = records.find((item) => playerId(item) === id);
    if (!existing) return res.status(404).json({ error: 'Player not found' });
    const body = req.body || {};
    if (body.current_card_id !== undefined) {
      const card = getPlayerCardById(body.current_card_id);
      if (body.current_card_id !== null && (!card || Number(card.player_id) !== id)) return res.status(400).json({ error: 'current_card_id must reference a card owned by this player.' });
    }
    const player = updateRecord(PLAYERS_FILE, id, normalizePlayer(body, existing), PLAYER_ID_KEY);
    recalculateAllPlayerStats();

    res.json(resolvePlayer(player));
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// Delete player
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const cards = getPlayerCards(id);
    if (cards.length) return res.status(409).json({ error: 'Cannot delete a player while player cards still exist.', player_card_ids: cards.map((card) => card.player_card_id) });
    if (!removeRecord(PLAYERS_FILE, id, PLAYER_ID_KEY)) return res.status(404).json({ error: 'Player not found' });
    res.json({ message: 'Player deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete player' });
  }
});

// Import Excel File
router.post('/import/excel', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No Excel file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }

    const createdPlayers = [];
    for (const row of rawData) {
      const name = row['Name'] || row['name'];
      if (!name) continue;

      const newPlayer = addRecord(PLAYERS_FILE, normalizePlayer({
        name: String(name),
        ovr: Number(row['OVR'] || row['ovr'] || row['Rating'] || row['rating']) || 80,
        position: String(row['Position'] || row['position'] || 'CM').toLowerCase().split(/\s*,\s*/),
        nation: String(row['Nation'] || row['nation'] || 'Unknown'),
        Status_I_H_M: String(row['Status_I_H_M'] || row['CardType'] || row['cardType'] || 'Gold'),
        stats: {
          match: Number(row['Match'] || row['Matches'] || row['matches']) || 0,
          goalAmounts: Number(row['GoalAmounts'] || row['Goals'] || row['goals']) || 0,
          assistAmounts: Number(row['AssistAmounts'] || row['Assists'] || row['assists']) || 0,
          bestPlayerAmount: Number(row['BestPlayerAmount'] || row['MOTM'] || row['motm']) || 0,
          sessionAmount: Number(row['SessionAmount'] || row['sessionAmount']) || 0
        }
      }), PLAYER_ID_KEY);
      createdPlayers.push(newPlayer);
    }

    res.json({
      message: `Successfully imported ${createdPlayers.length} players!`,
      players: createdPlayers
    });
  } catch (error) {
    console.error('Error importing Excel:', error);
    res.status(500).json({ error: 'Failed to import Excel file: ' + error.message });
  }
});

// Download sample Excel template
router.get('/export/template', (req, res) => {
  try {
    const templateData = [
      {
        Name: "Lamine Yamal",
        Rating: 88,
        Position: "RW",
        Nation: "Spain",
        Club: "FC Barcelona",
        PAC: 91,
        SHO: 82,
        PAS: 85,
        DRI: 92,
        DEF: 38,
        PHY: 68,
        CardType: "TOTY",
        PhotoUrl: "https://images.unsplash.com/photo-1543351611-c82399575a20?auto=format&fit=crop&w=400&q=80",
        Matches: 25,
        Goals: 14,
        Assists: 11,
        MOTM: 6
      },
      {
        Name: "Bukayo Saka",
        Rating: 87,
        Position: "RW",
        Nation: "England",
        Club: "Arsenal",
        PAC: 86,
        SHO: 83,
        PAS: 84,
        DRI: 87,
        DEF: 60,
        PHY: 75,
        CardType: "Gold",
        PhotoUrl: "",
        Matches: 30,
        Goals: 15,
        Assists: 10,
        MOTM: 5
      }
    ];

    const worksheet = xlsx.utils.json_to_sheet(templateData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Players");

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=player_import_template.xlsx');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate template' });
  }
});

module.exports = router;
