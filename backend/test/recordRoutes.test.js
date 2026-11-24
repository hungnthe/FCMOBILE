const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createRecordRouter } = require('../src/routes/recordRoutes');

test('record CRUD persists names and covers, rejects invalid uploads, and removes replaced images', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fcm-records-'));
  let records = [];
  const store = {
    readCollection: (file) => file === 'players.json' ? [{ player_id: 8, name: 'Cầu thủ dự bị', is_active: false }, { player_id: 9, name: 'Cầu thủ chính', is_active: true }] : records,
    addRecord: (file, data) => { const record = { ...data, record_id: 1 }; records.push(record); return record; },
    updateRecord: (file, id, data) => { records = records.map((item) => item.record_id === Number(id) ? { ...item, ...data } : item); return records[0]; },
    removeRecord: (file, id) => { records = records.filter((item) => item.record_id !== Number(id)); }
  };
  const app = express(); app.use('/records', createRecordRouter(store, directory));
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}/records`;
  const form = (name, player, image) => {
    const data = new FormData(); data.append('name', name); data.append('player', player);
    if (image) data.append('image', new Blob([image], { type: 'image/png' }), 'cover.png');
    return data;
  };
  try {
    let response = await fetch(base, { method: 'POST', body: form('', 'Messi') });
    assert.equal(response.status, 400);
    const missing = form('Bàn thắng', 'Messi'); missing.append('player_id', '999');
    response = await fetch(base, { method: 'POST', body: missing }); assert.equal(response.status, 400);
    response = await fetch(base, { method: 'POST', body: form('Bàn thắng', 'Messi', Buffer.from('not an image')) });
    assert.equal(response.status, 400);
    const png = Buffer.from('89504e470d0a1a0a00000000', 'hex');
    const create = form(' Bàn thắng ', ' Messi ', png); create.append('award_name', '  Chiếc giày vàng  '); create.append('note', '  Mùa giải đầu tiên\nĐáng nhớ  ');
    response = await fetch(base, { method: 'POST', body: create });
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.name, 'Bàn thắng'); assert.equal(created.player, 'Messi'); assert.equal(created.award_name, 'Chiếc giày vàng'); assert.equal(created.note, 'Mùa giải đầu tiên\nĐáng nhớ'); assert.deepEqual(created.player_history, []);
    response = await fetch(`${base}/images/${created.image}`);
    assert.equal(response.status, 200); assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
    response = await fetch(base); assert.equal((await response.json()).length, 1);
    const update = form('Kiến tạo', 'Ronaldo', png); update.append('player_id', '8');
    response = await fetch(`${base}/1`, { method: 'PUT', body: update });
    assert.equal(response.status, 200); const updated = await response.json();
    assert.equal(updated.name, 'Kiến tạo'); assert.equal(updated.player, 'Cầu thủ dự bị'); assert.equal(updated.player_id, 8); assert.equal(updated.award_name, 'Chiếc giày vàng'); assert.equal(updated.note, created.note); assert.deepEqual(updated.player_history.map((entry) => entry.player), ['Messi']);
    assert.notEqual(updated.image, created.image);
    assert.equal(fs.existsSync(path.join(directory, created.image)), false);
    assert.equal((await (await fetch(base)).json())[0].image, updated.image);
    const active = form('Kiến tạo', ''); active.append('player_id', '9'); active.append('award_name', '');
    response = await fetch(`${base}/1`, { method: 'PUT', body: active });
    assert.equal(response.status, 200); const activeResult = await response.json(); assert.equal(activeResult.player, 'Cầu thủ chính'); assert.equal(activeResult.award_name, ''); assert.deepEqual(activeResult.player_history.map((entry) => entry.player), ['Messi', 'Cầu thủ dự bị']);
    const unchanged = form('Kiến tạo', ''); unchanged.append('player_id', '9'); unchanged.append('note', 'Ghi chú mới');
    response = await fetch(`${base}/1`, { method: 'PUT', body: unchanged }); const unchangedResult = await response.json();
    assert.equal(unchangedResult.note, 'Ghi chú mới'); assert.equal(unchangedResult.player_history.length, 2);
    const reloaded = (await (await fetch(base)).json())[0]; assert.equal(reloaded.note, 'Ghi chú mới'); assert.equal(reloaded.player_history.length, 2);
    response = await fetch(`${base}/1`, { method: 'DELETE' }); assert.equal(response.status, 200);
    assert.equal(fs.existsSync(path.join(directory, updated.image)), false);
    response = await fetch(base); assert.deepEqual(await response.json(), []);
    response = await fetch(`${base}/1`, { method: 'DELETE' }); assert.equal(response.status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
