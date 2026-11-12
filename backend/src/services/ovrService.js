function normalizeOvr(input = {}, existing = {}) {
  const fail = (message) => {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  };
  const parse = (value) => {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') fail('OVR must be a non-negative integer.');
    const number = Number(value);
    if (!Number.isSafeInteger(number) || number < 0) fail('OVR must be a non-negative integer.');
    return number;
  };
  const ovr = parse(input.ovr ?? input.rating ?? existing.ovr ?? 0);
  const values = input.ovr_options ?? existing.ovr_options ?? [ovr];
  if (!Array.isArray(values) || !values.length) fail('ovr_options must contain at least one OVR.');
  const ovr_options = [...new Set(values.map(parse))];
  if (!ovr_options.includes(ovr)) {
    if (input.ovr_options !== undefined) fail('The selected OVR must be in ovr_options.');
    ovr_options.push(ovr);
  }
  return { ovr, ovr_options };
}

function normalizeOvrAppearance(input = {}, existing = {}) {
  const levels = normalizeOvr(input, existing);
  const source = input.ovr_images ?? existing.ovr_images ?? {};
  const fail = () => {
    const error = new Error('ovr_images must map OVR levels to image paths.');
    error.statusCode = 400;
    throw error;
  };
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail();
  const images = {};
  for (const [key, value] of Object.entries(source)) {
    if (typeof value !== 'string') fail();
    if (levels.ovr_options.includes(Number(key))) images[Number(key)] = value.trim();
  }
  const imageOf = (value) => String((Array.isArray(value) ? value[0] : value) ?? '').trim();
  // Migrate a legacy image only to its original OVR, never to a newly selected level.
  if (input.ovr_images === undefined && !Object.hasOwn(images, existing.ovr) && levels.ovr_options.includes(Number(existing.ovr))) {
    images[existing.ovr] = imageOf(existing.imageCard);
  }
  if (input.imageCard !== undefined && input.ovr_images === undefined) images[levels.ovr] = imageOf(input.imageCard);
  return { ...levels, ovr_images: images, imageCard: images[levels.ovr] || '' };
}

function normalizeOvrPrograms(input = {}, existing = {}, levels = normalizeOvr(input, existing)) {
  const fail = () => {
    const error = new Error('ovr_programs must map OVR levels to valid program IDs.');
    error.statusCode = 400;
    throw error;
  };
  const programId = (value) => {
    if (!['number', 'string'].includes(typeof value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) fail();
    return Number(value);
  };
  const source = input.ovr_programs ?? existing.ovr_programs ?? {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail();
  const programs = {};
  for (const [key, value] of Object.entries(source)) {
    const id = programId(value);
    if (levels.ovr_options.includes(Number(key))) programs[Number(key)] = id;
  }
  if (input.ovr_programs === undefined) {
    if (existing.program_id && !Object.hasOwn(programs, existing.ovr) && levels.ovr_options.includes(Number(existing.ovr))) programs[existing.ovr] = programId(existing.program_id);
    if (input.program_id !== undefined) programs[levels.ovr] = programId(input.program_id);
  }
  return { ovr_programs: programs, program_id: programs[levels.ovr] ?? null };
}

function normalizeOvrPositions(input = {}, existing = {}, levels = normalizeOvr(input, existing)) {
  const fail = () => {
    const error = new Error('ovr_positions must map OVR levels to arrays of position names.');
    error.statusCode = 400;
    throw error;
  };
  const positionsOf = (value) => {
    const values = typeof value === 'string' ? [value] : value;
    if (!Array.isArray(values) || values.some((position) => typeof position !== 'string')) fail();
    return [...new Set(values.map((position) => position.trim().toLowerCase()).filter(Boolean))];
  };
  const source = input.ovr_positions ?? existing.ovr_positions ?? {};
  if (!source || typeof source !== 'object' || Array.isArray(source)) fail();
  const positions = {};
  for (const [key, value] of Object.entries(source)) {
    if (!Array.isArray(value)) fail();
    const normalized = positionsOf(value);
    if (levels.ovr_options.includes(Number(key))) positions[Number(key)] = normalized;
  }
  if (input.ovr_positions === undefined) {
    if (existing.position !== undefined && !Object.hasOwn(positions, existing.ovr) && levels.ovr_options.includes(Number(existing.ovr))) positions[existing.ovr] = positionsOf(existing.position);
    if (input.position !== undefined) positions[levels.ovr] = positionsOf(input.position);
  }
  return { ovr_positions: positions, position: positions[levels.ovr] || [] };
}

module.exports = { normalizeOvr, normalizeOvrAppearance, normalizeOvrPrograms, normalizeOvrPositions };
