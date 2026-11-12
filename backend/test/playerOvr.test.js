const assert = require('node:assert/strict');
const { test, mock } = require('node:test');
const express = require('express');
const store = require('../src/jsonStore');

// Keep route and persistence checks entirely in memory, away from the user's data.
const collections = {
  'players.json': [{ player_id: 1, name: 'Rice', ovr: 119, current_card_id: 1 }],
  'programs.json': [{ program_id: 1, name: 'UTOTS' }, { program_id: 2, name: 'TOTY' }, { program_id: 3, name: 'Anniversary' }],
  'player_cards.json': [
    { player_card_id: 1, player_id: 1, program_id: 1, ovr: 119, position: ['cdm'] },
    { player_card_id: 2, player_id: 1, program_id: 1, ovr: 118, position: ['cm'] }
  ],
  'sessions.json': []
};
mock.method(store, 'readCollection', (name) => structuredClone(collections[name] || []));
mock.method(store, 'writeCollection', (name, records) => { collections[name] = structuredClone(records); });
mock.method(store, 'updateRecord', (name, id, input, idKey = 'id') => {
  const record = collections[name].find((item) => item[idKey] === Number(id));
  if (!record) return null;
  Object.assign(record, structuredClone(input));
  return structuredClone(record);
});
mock.method(store, 'removeRecord', (name, id, idKey = 'id') => {
  const before = collections[name].length;
  collections[name] = collections[name].filter((item) => item[idKey] !== Number(id));
  return collections[name].length !== before;
});
const { resolvePlayer, updatePlayerCard } = require('../src/services/playerCardService');
const playerRoutes = require('../src/routes/playerRoutes');
const programRoutes = require('../src/routes/programRoutes');

test('saves OVR levels through player details and returns the selected OVR on reload', async () => {
  const app = express();
  app.use(express.json());
  app.use('/players', playerRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/players/1`;
  try {
    let response = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card: { ovr: 121, ovr_options: [119, 120, 121], ovr_images: { 119: 'rice-119.png', 120: 'rice-120.png', 121: 'rice-121.png' }, ovr_programs: { 119: 1, 120: 2, 121: 3 }, ovr_positions: { 119: ['cdm', 'cm'], 120: ['cm', 'cb'], 121: ['cam', 'cm'] } } })
    });
    assert.equal(response.status, 200);
    let player = await response.json();
    assert.equal(player.ovr, 121);
    assert.deepEqual(player.ovr_options, [119, 120, 121]);
    assert.deepEqual(player.currentCard.ovr_options, [119, 120, 121]);
    assert.deepEqual(player.imageCard, ['rice-121.png']);
    assert.equal(player.currentCard.imageCard, 'rice-121.png');
    assert.equal(player.currentCard.program_id, 3);
    assert.equal(player.currentCard.program.name, 'Anniversary');
    assert.deepEqual(player.program, ['Anniversary']);
    assert.deepEqual(player.position, ['cam', 'cm']);
    assert.deepEqual(player.currentCard.position, ['cam', 'cm']);
    assert.deepEqual(player.cards.find((card) => card.player_card_id === 2).ovr_options, [118]);

    response = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card: { ovr: 119, ovr_options: [119, 120, 121] } })
    });
    assert.equal(response.status, 200);
    player = await (await fetch(url)).json();
    assert.equal(player.ovr, 119);
    assert.deepEqual(player.ovr_options, [119, 120, 121]);
    assert.deepEqual(player.imageCard, ['rice-119.png']);
    assert.deepEqual(player.currentCard.ovr_images, { 119: 'rice-119.png', 120: 'rice-120.png', 121: 'rice-121.png' });
    assert.equal(player.currentCard.program_id, 1);
    assert.deepEqual(player.program, ['UTOTS']);
    assert.deepEqual(player.ovr_programs, { 119: 1, 120: 2, 121: 3 });
    assert.deepEqual(player.position, ['cdm', 'cm']);
    assert.deepEqual(player.ovr_positions, { 119: ['cdm', 'cm'], 120: ['cm', 'cb'], 121: ['cam', 'cm'] });

    const before = structuredClone(collections);
    response = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: 42, card: { ovr: 122, ovr_options: [119] } })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(collections, before);
    response = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: 42, card: { ovr_positions: { 119: 'cm' } } })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(collections, before);
    response = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ number: 42, card: { ovr_programs: { 119: 1, 120: 9999, 121: 3 } } })
    });
    assert.equal(response.status, 400);
    assert.deepEqual(collections, before);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('updates another card independently and preserves options on unrelated edits', () => {
  updatePlayerCard(2, { ovr: 120, ovr_options: [118, 119, 120], ovr_images: { 118: 'other-118.png', 120: 'other-120.png' }, ovr_programs: { 118: 1, 119: 2, 120: 3 }, ovr_positions: { 118: ['cm'], 119: ['cb'], 120: ['cdm'] } });
  updatePlayerCard(2, { position: ['cm', 'cdm'] });
  const player = resolvePlayer(collections['players.json'][0]);
  assert.equal(player.ovr, 119);
  assert.deepEqual(player.ovr_options, [119, 120, 121]);
  const otherCard = player.cards.find((card) => card.player_card_id === 2);
  assert.equal(otherCard.ovr, 120);
  assert.deepEqual(otherCard.ovr_options, [118, 119, 120]);
  assert.deepEqual(otherCard.position, ['cm', 'cdm']);
  assert.equal(otherCard.imageCard, 'other-120.png');
  assert.deepEqual(otherCard.ovr_images, { 118: 'other-118.png', 120: 'other-120.png' });
  assert.deepEqual(player.imageCard, ['rice-119.png']);
  assert.deepEqual(player.program, ['UTOTS']);
  assert.equal(otherCard.program.name, 'Anniversary');
  assert.deepEqual(otherCard.ovr_programs, { 118: 1, 119: 2, 120: 3 });
  assert.deepEqual(otherCard.ovr_positions, { 118: ['cm'], 119: ['cb'], 120: ['cm', 'cdm'] });
  assert.deepEqual(player.position, ['cdm', 'cm']);
});

test('counts and protects Programs assigned to inactive OVR levels', async () => {
  const app = express();
  app.use('/programs', programRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/programs`;
  try {
    const programs = await (await fetch(url)).json();
    assert.equal(programs.find((program) => program.program_id === 2).card_count, 2);
    const detail = await (await fetch(`${url}/2`)).json();
    assert.equal(detail.cards.length, 2);
    const response = await fetch(`${url}/2`, { method: 'DELETE' });
    assert.equal(response.status, 409);
    assert.equal(collections['programs.json'].length, 3);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
