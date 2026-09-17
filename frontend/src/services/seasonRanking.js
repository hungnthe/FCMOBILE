const toId = (value) => Number(value);
export const MAX_SEASON_RANKING_PLAYERS = 14;
const playerIdOf = (item) => item?.player_id ?? item?.playerId;

const findPlayer = (players, match) => players.find((candidate) => (
  String(candidate.player_id) === String(playerIdOf(match))
  || (candidate.objectId && String(candidate.objectId) === String(match?.objectId))
));

const findCard = (player, playerCards, cardId) => {
  if (cardId === null || cardId === undefined || cardId === '') return player?.currentCard || null;
  return playerCards.find((card) => Number(card.player_card_id) === Number(cardId))
    || player?.cards?.find((card) => Number(card.player_card_id) === Number(cardId))
    || null;
};

/** Resolve registered season players in their manually saved order. */
export function getSeasonPlayerList(session, players = [], playerCards = []) {
  const participants = Array.isArray(session?.player_match) ? session.player_match : [];
  const savedOrder = Array.isArray(session?.player_ranking) ? session.player_ranking.map(toId) : [];
  const order = new Map(savedOrder.map((id, index) => [id, index]));

  return participants.map((match, originalIndex) => {
    const player = findPlayer(players, match);
    if (!player) return null;
    return {
      player,
      playerCard: findCard(player, playerCards, match.player_card_id),
      seasonStats: {
        matches: Math.max(0, Number(match.stats?.matches) || 0),
        goals: Math.max(0, Number(match.stats?.goals) || 0),
        assists: Math.max(0, Number(match.stats?.assists) || 0),
        bestPlayer: Math.max(0, Number(match.stats?.bestPlayer) || 0)
      },
      originalIndex,
      playerMatch: match
    };
  }).filter(Boolean)
    .sort((left, right) => (order.get(Number(left.player.player_id)) ?? savedOrder.length + left.originalIndex)
      - (order.get(Number(right.player.player_id)) ?? savedOrder.length + right.originalIndex))
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

// Compatibility alias for existing imports.
export const getSeasonRanking = getSeasonPlayerList;
