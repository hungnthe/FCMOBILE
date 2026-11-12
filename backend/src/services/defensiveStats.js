const { readCollection } = require('../jsonStore');

const defensivePositions = new Set(['gk', 'cb', 'rb', 'lb', 'cdm']);

function hasDefensivePosition(positions) {
  return (Array.isArray(positions) ? positions : [positions])
    .some((position) => defensivePositions.has(String(position).trim().toLowerCase()));
}

function seasonDefenderIds(session, players = readCollection('players.json'), cards = readCollection('player_cards.json')) {
  const defenders = new Set();
  for (const entry of session.player_match || []) {
    const id = Number(entry.player_id);
    const player = players.find((item) => Number(item.player_id) === id);
    const cardId = entry.player_card_id ?? player?.current_card_id;
    const card = cards.find((item) => Number(item.player_id) === id && Number(item.player_card_id) === Number(cardId));
    const source = card || player;
    if (hasDefensivePosition(source?.ovr_positions?.[source.ovr] ?? source?.position)) defenders.add(id);
  }
  return defenders;
}

// Keep the position decision for existing appearances when a score or lineup is corrected.
function defensiveAppearances(match, defenders, previous) {
  return (match.appearances || []).filter((id) => {
    if (previous?.defensive_appearances && previous.appearances.includes(id)) {
      return previous.defensive_appearances.includes(id);
    }
    return defenders.has(Number(id));
  });
}

function recordedGoalsAgainst(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return null;
  const goals = Number(value);
  return Number.isInteger(goals) && goals >= 0 ? goals : null;
}

function combineDefensiveStats(left = {}, right = {}, sign = 1) {
  if (left.goalsAgainst == null && right.goalsAgainst == null && left.cleanSheets == null && right.cleanSheets == null) return {};
  return {
    goalsAgainst: Math.max(0, (Number(left.goalsAgainst) || 0) + sign * (Number(right.goalsAgainst) || 0)),
    cleanSheets: Math.max(0, (Number(left.cleanSheets) || 0) + sign * (Number(right.cleanSheets) || 0))
  };
}

module.exports = { hasDefensivePosition, seasonDefenderIds, defensiveAppearances, recordedGoalsAgainst, combineDefensiveStats };
