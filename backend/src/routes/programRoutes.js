const express = require('express');
const router = express.Router();
const { readCollection, addRecord, updateRecord, removeRecord } = require('../jsonStore');
const { PLAYER_CARDS_FILE, getProgramById } = require('../services/playerCardService');

const PROGRAMS_FILE = 'programs.json';

function sendError(res, error, fallback) {
  res.status(error.statusCode || 500).json({ error: error.message || fallback });
}

function normalizeProgram(input = {}, existing = {}) {
  const name = String(input.name ?? existing.name ?? '').trim();
  const code = String(input.code ?? existing.code ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).trim();
  if (!name || !code) {
    const error = new Error('Program name and code are required.');
    error.statusCode = 400;
    throw error;
  }
  const duplicate = readCollection(PROGRAMS_FILE).find((program) => (
    Number(program.program_id) !== Number(existing.program_id)
    && (String(program.code).toLowerCase() === code.toLowerCase() || String(program.name).toLowerCase() === name.toLowerCase())
  ));
  if (duplicate) {
    const error = new Error('A program with this name or code already exists.');
    error.statusCode = 409;
    throw error;
  }
  return {
    ...existing,
    ...input,
    name,
    code,
    display_name: String(input.display_name ?? existing.display_name ?? name).trim(),
    active: input.active === undefined ? existing.active !== false : Boolean(input.active)
  };
}

router.get('/', (req, res) => {
  try {
    const cards = readCollection(PLAYER_CARDS_FILE);
    const programs = readCollection(PROGRAMS_FILE).map((program) => ({
      ...program,
      card_count: cards.filter((card) => Number(card.program_id) === Number(program.program_id)).length
    }));
    res.json(programs);
  } catch (error) { sendError(res, error, 'Failed to fetch programs'); }
});

router.get('/:id', (req, res) => {
  try {
    const program = getProgramById(req.params.id);
    if (!program) return res.status(404).json({ error: 'Program not found' });
    const cards = readCollection(PLAYER_CARDS_FILE).filter((card) => Number(card.program_id) === Number(program.program_id));
    res.json({ ...program, cards });
  } catch (error) { sendError(res, error, 'Failed to fetch program'); }
});

router.post('/', (req, res) => {
  try { res.status(201).json(addRecord(PROGRAMS_FILE, normalizeProgram(req.body || {}), 'program_id')); }
  catch (error) { sendError(res, error, 'Failed to create program'); }
});

router.put('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = getProgramById(id);
    if (!existing) return res.status(404).json({ error: 'Program not found' });
    res.json(updateRecord(PROGRAMS_FILE, id, normalizeProgram(req.body || {}, existing), 'program_id'));
  } catch (error) { sendError(res, error, 'Failed to update program'); }
});

router.delete('/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!getProgramById(id)) return res.status(404).json({ error: 'Program not found' });
    const usedBy = readCollection(PLAYER_CARDS_FILE).filter((card) => Number(card.program_id) === id);
    if (usedBy.length) return res.status(409).json({ error: 'Cannot delete a program that is still used by player cards.', card_count: usedBy.length });
    removeRecord(PROGRAMS_FILE, id, 'program_id');
    res.json({ message: 'Program deleted successfully' });
  } catch (error) { sendError(res, error, 'Failed to delete program'); }
});

module.exports = router;
