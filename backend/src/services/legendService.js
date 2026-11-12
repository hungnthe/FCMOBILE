const AWARD_DEFINITIONS = [
  { key: 'golden_ball', title: 'Quả bóng vàng', icon: '🥇' },
  { key: 'silver_ball', title: 'Quả bóng bạc', icon: '🥈' },
  { key: 'bronze_ball', title: 'Quả bóng đồng', icon: '🥉' },
  { key: 'top_scorer', title: 'Vua phá lưới', icon: '⚽' },
  { key: 'top_assist', title: 'Vua kiến tạo', icon: '🎯' },
  { key: 'best_transfer', title: 'Bản hợp đồng xuất sắc nhất', icon: '🤝' },
  { key: 'best_goal', title: 'Bàn thắng đẹp nhất', icon: '🎬' }
];

const AWARD_KEYS = new Set(AWARD_DEFINITIONS.map(({ key }) => key));
const numberOr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function playerIdOf(value) {
  if (value && typeof value === 'object') return value.player_id ?? value.playerId;
  return value;
}

function compareLegendRecords(left, right) {
  return right.count - left.count || String(left.name || '').localeCompare(String(right.name || ''), 'vi');
}

function createLegend(player) {
  return {
    player_id: Number(player.player_id),
    player,
    totalAwards: 0,
    awards: Object.fromEntries(AWARD_DEFINITIONS.map(({ key }) => [key, 0])),
    history: []
  };
}

function aggregatePlayerAwards(sessions = [], players = []) {
  const playerMap = new Map(players.map((player) => [String(player.player_id), player]));
  const legends = new Map();
  const categories = Object.fromEntries(AWARD_DEFINITIONS.map(({ key, title, icon }) => [key, {
    key, title, icon, totalAwards: 0, playersCount: 0, records: [], history: []
  }]));

  [...sessions]
    .sort((left, right) => numberOr(right.session_id) - numberOr(left.session_id))
    .forEach((session) => {
      Object.entries(session.awards || {}).forEach(([key, award]) => {
        if (!AWARD_KEYS.has(key) || !award || typeof award !== 'object') return;
        const rawPlayerId = playerIdOf(award);
        if (rawPlayerId === null || rawPlayerId === undefined || rawPlayerId === '') return;
        const player = playerMap.get(String(rawPlayerId));
        if (!player) return;

        const id = Number(player.player_id);
        const legend = legends.get(id) || createLegend(player);
        const definition = AWARD_DEFINITIONS.find((item) => item.key === key);
        const historyItem = {
          session_id: Number(session.session_id),
          season: session.season || '',
          session_title: session.Title || session.title || '',
          key,
          title: award.title || definition.title,
          video: key === 'best_goal' ? (award.video || '') : ''
        };
        legend.totalAwards += 1;
        legend.awards[key] += 1;
        legend.history.push(historyItem);
        legends.set(id, legend);

        const category = categories[key];
        category.totalAwards += 1;
        category.history.push({ ...historyItem, player_id: id, player_name: player.name });
      });
    });

  const legendList = [...legends.values()];
  AWARD_DEFINITIONS.forEach(({ key }) => {
    const category = categories[key];
    const records = legendList
      .filter((legend) => legend.awards[key] > 0)
      .map((legend) => ({ player_id: legend.player_id, name: legend.player.name, count: legend.awards[key] }))
      .sort(compareLegendRecords);
    category.records = records;
    category.playersCount = records.length;
  });

  const sortedLegends = legendList.sort((left, right) => (
    right.totalAwards - left.totalAwards
    || right.awards.golden_ball - left.awards.golden_ball
    || right.awards.top_scorer - left.awards.top_scorer
    || right.awards.top_assist - left.awards.top_assist
    || String(left.player.name || '').localeCompare(String(right.player.name || ''), 'vi')
  ));

  return {
    summary: {
      honoredPlayers: sortedLegends.length,
      totalAwards: AWARD_DEFINITIONS.reduce((total, { key }) => total + categories[key].totalAwards, 0),
      seasons: new Set(sortedLegends.flatMap((legend) => legend.history.map((item) => item.session_id))).size,
      categories: AWARD_DEFINITIONS.length
    },
    awardDefinitions: AWARD_DEFINITIONS,
    legends: sortedLegends,
    categories
  };
}

module.exports = { AWARD_DEFINITIONS, aggregatePlayerAwards };
