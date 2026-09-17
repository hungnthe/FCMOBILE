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
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
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
  const record = { ...data, [idKey]: nextId(records, idKey) };
  if (record.metadata) {
    record.metadata = { ...record.metadata, createdAt: record.metadata.createdAt || now, updatedAt: now };
  } else {
    record.createdAt = now;
    record.updatedAt = now;
  }
  records.push(record);
  writeCollection(fileName, records);
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
  readCollection,
  writeCollection,
  addRecord,
  updateRecord,
  removeRecord,
  replaceCollection
};
