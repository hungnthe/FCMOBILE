const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const defaultStore = require('../jsonStore');

const FILE = 'records.json';
const ID = 'record_id';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function imageExtension(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return '.png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return '.jpg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return '.webp';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.toString('ascii', 0, 6))) return '.gif';
  return null;
}

function createRecordRouter(store = defaultStore, imageDir = path.join(store.DATA_DIR, 'record-images')) {
  const router = express.Router();
  router.use('/images', express.static(imageDir, { fallthrough: false, dotfiles: 'deny' }));
  const find = (id) => store.readCollection(FILE).find((record) => Number(record[ID]) === Number(id));
  const removeImage = (filename) => {
    if (filename && path.basename(filename) === filename) {
      try { fs.unlinkSync(path.join(imageDir, filename)); } catch (error) { if (error.code !== 'ENOENT') console.error('Unable to remove record image:', error); }
    }
  };
  router.get('/', (req, res) => {
    try { res.json(store.readCollection(FILE)); } catch (error) { res.status(500).json({ error: 'Không thể tải kỷ lục.' }); }
  });
  const save = (editing) => (req, res) => {
    let newImage = '';
    try {
      const existing = editing ? find(req.params.id) : null;
      if (editing && !existing) return res.status(404).json({ error: 'Không tìm thấy kỷ lục.' });
      const name = String(req.body.name || '').trim();
      const awardName = String(req.body.award_name ?? existing?.award_name ?? '').trim();
      const note = String(req.body.note ?? existing?.note ?? '').replace(/\r\n/g, '\n').trim();
      let player = String(req.body.player || '').trim();
      let playerId = null;
      if (req.body.player_id) {
        const selected = store.readCollection('players.json').find((item) => Number(item.player_id) === Number(req.body.player_id));
        if (!selected) return res.status(400).json({ error: 'Cầu thủ đã chọn không còn trong kho.' });
        playerId = Number(selected.player_id);
        player = String(selected.name || '').trim();
      }
      if (note.length > 2000) return res.status(400).json({ error: 'Ghi chú không được vượt quá 2000 ký tự.' });
      if (awardName.length > 200) return res.status(400).json({ error: 'Tên danh hiệu không được vượt quá 200 ký tự.' });
      if (!name || !player || name.length > 200 || player.length > 200) return res.status(400).json({ error: 'Hãy nhập tên kỷ lục và cầu thủ, tối đa 200 ký tự mỗi trường.' });
      if (req.file) {
        const extension = imageExtension(req.file.buffer);
        if (!extension) return res.status(400).json({ error: 'Ảnh bìa phải là PNG, JPG, GIF hoặc WebP.' });
        fs.mkdirSync(imageDir, { recursive: true });
        newImage = `${randomUUID()}${extension}`;
        fs.writeFileSync(path.join(imageDir, newImage), req.file.buffer);
      }
      const image = newImage || (req.body.removeImage === 'true' ? '' : existing?.image || '');
      const history = Array.isArray(existing?.player_history) ? [...existing.player_history] : [];
      if (existing?.player) {
        const changed = existing.player_id && playerId
          ? Number(existing.player_id) !== playerId
          : String(existing.player).trim().toLocaleLowerCase('vi') !== player.toLocaleLowerCase('vi');
        if (changed) history.push({ player: existing.player, player_id: existing.player_id || null, changed_at: new Date().toISOString() });
      }
      const data = { name, award_name: awardName, note, player, player_id: playerId, player_history: history, image };
      const record = editing ? store.updateRecord(FILE, req.params.id, data, ID) : store.addRecord(FILE, data, ID);
      if (existing?.image && existing.image !== image) removeImage(existing.image);
      res.status(editing ? 200 : 201).json(record);
    } catch (error) {
      if (newImage) removeImage(newImage);
      console.error('Unable to save record:', error);
      res.status(500).json({ error: 'Không thể lưu kỷ lục.' });
    }
  };
  router.post('/', upload.single('image'), save(false));
  router.put('/:id', upload.single('image'), save(true));
  router.delete('/:id', (req, res) => {
    try {
      const record = find(req.params.id);
      if (!record) return res.status(404).json({ error: 'Không tìm thấy kỷ lục.' });
      store.removeRecord(FILE, req.params.id, ID);
      removeImage(record.image);
      res.json({ message: 'Đã xóa kỷ lục.' });
    } catch (error) { res.status(500).json({ error: 'Không thể xóa kỷ lục.' }); }
  });
  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Ảnh bìa không được vượt quá 5 MB.' : 'Không thể tải ảnh bìa.' });
    next(error);
  });
  return router;
}
module.exports = createRecordRouter();
module.exports.createRecordRouter = createRecordRouter;
