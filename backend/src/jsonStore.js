const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '../data');

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function collectionPath(fileName) {
  ensureDataDir();
  return path.join(DATA_DIR, fileName);
}

function readCollection(fileName) {
  const filePath = collectionPath(fileName);
  if (!fs.existsSync(filePath)) return [];

  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(value) ? value : [];
  } catch (error) {
    throw new Error(`Invalid JSON in ${fileName}: ${error.message}`);
  }
}

function writeCollection(fileName, records) {
  const filePath = collectionPath(fileName);
  if (fileName === 'players.json') {
    const old = new Map(readCollection(fileName).map((player) => [String(player.player_id), player]));
    records = records.map((player) => ({ ...player, rank: old.get(String(player.player_id))?.rank || player.rank || 'young_talent' }));
  }
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

// Only rank promotion code uses this writer; all ordinary writes preserve the current rank.
function writePromotedPlayers(records) {
  const filePath = collectionPath('players.json');
  const tempPath = filePath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(records, null, 2) + '\n', 'utf8');
  fs.renameSync(tempPath, filePath);
}

function nextId(records, idKey = 'id') {
  return records.reduce((max, record) => Math.max(max, Number(record[idKey]) || 0), 0) + 1;
}

function timestamp() {
  return new Date().toISOString();
}

function addRecord(fileName, data, idKey = 'id') {
  const records = readCollection(fileName);
  const now = timestamp();
  let id = nextId(records, idKey);
  if (fileName === 'players.json') {
    const journeyPath = collectionPath('player-rank-data.json');
    if (fs.existsSync(journeyPath)) {
      const journey = JSON.parse(fs.readFileSync(journeyPath, 'utf8').replace(/^\uFEFF/, ''));
      id = Math.max(id, ...Object.keys(journey.players || {}).map((key) => (Number(key) || 0) + 1));
    }
  }
  const record = { ...data, [idKey]: id };
  if (record.metadata) {
    record.metadata = { ...record.metadata, createdAt: record.metadata.createdAt || now, updatedAt: now };
  } else {
    record.createdAt = now;
    record.updatedAt = now;
  }
  records.push(record);
  writeCollection(fileName, records);
  if (fileName === 'players.json' && fs.existsSync(collectionPath('player-rank-data.json'))) require('./services/rankService').startPlayer(record[idKey]);
  return record;
}

function updateRecord(fileName, id, data, idKey = 'id') {
  const records = readCollection(fileName);
  const index = records.findIndex((record) => Number(record[idKey]) === Number(id));
  if (index === -1) return null;

  const updated = { ...records[index], ...data, [idKey]: records[index][idKey] };
  if (updated.metadata) {
    updated.metadata = { ...updated.metadata, updatedAt: timestamp() };
  } else {
    updated.updatedAt = timestamp();
  }
  records[index] = updated;
  writeCollection(fileName, records);
  return updated;
}

function removeRecord(fileName, id, idKey = 'id') {
  const records = readCollection(fileName);
  if (fileName === 'players.json') {
    const player = records.find((record) => Number(record[idKey]) === Number(id));
    if (player && player.rank && player.rank !== 'young_talent') {
      throw Object.assign(new Error('Không thể xóa cầu thủ đã được trao bậc.'), { statusCode: 409 });
    }
  }
  const nextRecords = records.filter((record) => Number(record[idKey]) !== Number(id));
  if (nextRecords.length === records.length) return false;
  writeCollection(fileName, nextRecords);
  return true;
}

function replaceCollection(fileName, records, idKey = 'id') {
  const now = timestamp();
  const normalized = records.map((record, index) => ({
    ...record,
    [idKey]: Number(record[idKey]) || index + 1,
    ...(record.metadata
      ? { metadata: { ...record.metadata, createdAt: record.metadata.createdAt || now, updatedAt: record.metadata.updatedAt || now } }
      : { createdAt: record.createdAt || now, updatedAt: record.updatedAt || now })
  }));
  writeCollection(fileName, normalized);
}

module.exports = {
  DATA_DIR,
  writePromotedPlayers,
  readCollection,
  writeCollection,
  addRecord,
  updateRecord,
  removeRecord,
  replaceCollection
};
