const assert = require('node:assert/strict');
const test = require('node:test');
const { normalizeOvr, normalizeOvrAppearance, normalizeOvrPrograms, normalizeOvrPositions } = require('../src/services/ovrService');

test('converts a legacy scalar OVR into a single available level', () => {
  assert.deepEqual(normalizeOvr({}, { ovr: 119 }), { ovr: 119, ovr_options: [119] });
});

test('selects an older OVR while preserving all available levels', () => {
  assert.deepEqual(normalizeOvr({ ovr: '119', ovr_options: ['119', '120', '121', '120'] }), {
    ovr: 119, ovr_options: [119, 120, 121]
  });
});

test('supports older clients that update only the scalar OVR', () => {
  assert.deepEqual(normalizeOvr({ ovr: 121 }, { ovr: 119, ovr_options: [119, 120] }), {
    ovr: 121, ovr_options: [119, 120, 121]
  });
});

test('allows removing an unused level', () => {
  assert.deepEqual(normalizeOvr({ ovr: 120, ovr_options: [119, 120] }, { ovr: 121, ovr_options: [119, 120, 121] }), {
    ovr: 120, ovr_options: [119, 120]
  });
});

test('rejects invalid or empty OVR lists and selections outside the list', () => {
  for (const input of [
    { ovr: 119, ovr_options: [] },
    { ovr: 119, ovr_options: '119,120' },
    { ovr: 121, ovr_options: [119, 120] },
    ...['', ' ', null, true, -1, 1.5, 'abc', Infinity].map((value) => ({ ovr: 119, ovr_options: [119, value] })),
    { ovr: -1 }, { ovr: '' }
  ]) assert.throws(() => normalizeOvr(input), (error) => error.statusCode === 400);
});

test('migrates a legacy card image only to its original OVR', () => {
  const result = normalizeOvrAppearance({ ovr: 120, ovr_options: [119, 120] }, { ovr: 119, imageCard: 'rice-119.png' });
  assert.deepEqual(result.ovr_images, { 119: 'rice-119.png' });
  assert.equal(result.imageCard, '');
  assert.equal(normalizeOvrAppearance({ ovr: 119 }, result).imageCard, 'rice-119.png');
});

test('selects the matching image and preserves all other OVR images', () => {
  const existing = { ovr: 119, ovr_options: [119, 120, 121], ovr_images: { 119: 'rice-119.png', 120: 'rice-120.png', 121: 'rice-121.png' } };
  const selected = normalizeOvrAppearance({ ovr: 121 }, existing);
  assert.equal(selected.imageCard, 'rice-121.png');
  assert.deepEqual(selected.ovr_images, existing.ovr_images);
  assert.equal(normalizeOvrAppearance({ ovr: 120 }, selected).imageCard, 'rice-120.png');
});

test('removes obsolete image mappings and supports legacy image updates', () => {
  const existing = { ovr: 120, ovr_options: [119, 120], imageCard: 'rice-120.png', ovr_images: { 119: 'rice-119.png', 120: 'rice-120.png' } };
  assert.deepEqual(normalizeOvrAppearance({ ovr: 119, ovr_options: [119], ovr_images: { 119: 'rice-new.png', 120: 'rice-120.png' } }, existing), {
    ovr: 119, ovr_options: [119], ovr_images: { 119: 'rice-new.png' }, imageCard: 'rice-new.png'
  });
  assert.equal(normalizeOvrAppearance({ imageCard: 'rice-replaced.png' }, existing).ovr_images[120], 'rice-replaced.png');
});

test('rejects malformed OVR image mappings', () => {
  for (const ovr_images of ['bad', [], { 119: 123 }]) {
    assert.throws(() => normalizeOvrAppearance({ ovr: 119, ovr_images }), (error) => error.statusCode === 400);
  }
});

test('migrates a legacy Program only to its original OVR', () => {
  assert.deepEqual(normalizeOvrPrograms({ ovr: 120, ovr_options: [119, 120] }, { ovr: 119, program_id: 1 }), {
    ovr_programs: { 119: 1 }, program_id: null
  });
});

test('selects the matching Program and preserves all other assignments', () => {
  const existing = { ovr: 119, program_id: 1, ovr_options: [119, 120, 121], ovr_programs: { 119: 1, 120: 2, 121: 3 } };
  const selected = normalizeOvrPrograms({ ovr: 121 }, existing);
  assert.equal(selected.program_id, 3);
  assert.deepEqual(selected.ovr_programs, existing.ovr_programs);
  assert.equal(normalizeOvrPrograms({ ovr: 120 }, existing).program_id, 2);
  assert.deepEqual(normalizeOvrPrograms({ ovr: 119, ovr_options: [119], ovr_programs: existing.ovr_programs }, existing), {
    ovr_programs: { 119: 1 }, program_id: 1
  });
});

test('supports scalar Program edits without changing other OVR assignments', () => {
  assert.deepEqual(normalizeOvrPrograms({ program_id: '3' }, { ovr: 119, ovr_options: [119, 120], ovr_programs: { 119: 1, 120: 2 } }), {
    ovr_programs: { 119: 3, 120: 2 }, program_id: 3
  });
});

test('rejects malformed Program mappings', () => {
  for (const ovr_programs of [[], 'bad', { 119: 0 }, { 119: -1 }, { 119: true }, { 119: 1.5 }, { 119: 'abc' }]) {
    assert.throws(() => normalizeOvrPrograms({ ovr: 119, ovr_programs }), (error) => error.statusCode === 400);
  }
});

test('migrates legacy positions only to their original OVR', () => {
  assert.deepEqual(normalizeOvrPositions({ ovr: 120, ovr_options: [119, 120] }, { ovr: 119, position: ['CDM', 'cm'] }), {
    ovr_positions: { 119: ['cdm', 'cm'] }, position: []
  });
});

test('selects and normalizes positions without changing another OVR', () => {
  const existing = { ovr: 119, ovr_options: [119, 120, 121], ovr_positions: { 119: ['cdm', 'cm'], 120: [' CM ', 'CB', 'cm', ''], 121: ['cam'] } };
  const selected = normalizeOvrPositions({ ovr: 120 }, existing);
  assert.deepEqual(selected.position, ['cm', 'cb']);
  assert.deepEqual(selected.ovr_positions[119], ['cdm', 'cm']);
  assert.deepEqual(normalizeOvrPositions({ ovr: 119, ovr_options: [119], ovr_positions: existing.ovr_positions }, existing), {
    ovr_positions: { 119: ['cdm', 'cm'] }, position: ['cdm', 'cm']
  });
});

test('supports legacy position edits while preserving other OVR positions', () => {
  assert.deepEqual(normalizeOvrPositions({ position: ['CAM', ' CM '] }, { ovr: 119, ovr_options: [119, 120], ovr_positions: { 119: ['cdm'], 120: ['cb'] } }), {
    ovr_positions: { 119: ['cam', 'cm'], 120: ['cb'] }, position: ['cam', 'cm']
  });
});

test('rejects malformed position mappings', () => {
  for (const ovr_positions of [[], 'bad', { 119: 'cm' }, { 119: [123] }, { 119: [null] }]) {
    assert.throws(() => normalizeOvrPositions({ ovr: 119, ovr_positions }), (error) => error.statusCode === 400);
  }
});
