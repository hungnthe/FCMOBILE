import React from 'react';
import { UserRound, Search, Filter, ArrowUpDown, Plus, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import AjaxLogo from './AjaxLogo';
import PlayerStatsSummary from './PlayerStatsSummary';

const fallbackPlayers = [
  { player_id: 1, program: ['The world game 26'], ovr: 122, position: ['lw', 'st'], nation: 'Pháp', Status_I_H_M: 'Matching', number: 10, name: 'Kylian Mbappe', stats: { goalAmounts: 34, assistAmounts: 21, match: 61, bestPlayerAmount: 13, sessionAmount: 2 }, active: { HTH: ['20*', '20*'], lastWeekCup: 1 }, imageCard: ['public/ImageCard/mbappe-card.png'], metadata: { note: '' } },
  { player_id: 2, program: ['The world game 26'], ovr: 119, position: ['st', 'lw', 'cf'], nation: 'Hàn Quốc', Status_I_H_M: 'Matching', number: 7, name: 'Son Heung-Min', stats: { goalAmounts: 36, assistAmounts: 24, match: 61, bestPlayerAmount: 12, sessionAmount: 2 }, active: { HTH: ['20*', '20*'], lastWeekCup: 1 }, imageCard: ['public/ImageCard/Son_256_fc_25_download.png'], metadata: { note: '' } },
  { player_id: 3, program: ['Nhà Vô Địch'], ovr: 121, position: ['cm', 'lm'], nation: 'Đức', Status_I_H_M: 'Icon', number: 31, name: 'Bastian Schweinsteiger', stats: { goalAmounts: 7, assistAmounts: 23, match: 51, bestPlayerAmount: 2, sessionAmount: 1 }, active: { HTH: ['20*'], lastWeekCup: 0 }, imageCard: ['public/ImageCard/Schweinsteiger_256_fc_25_download (3).png'], metadata: { note: '' } },
  { player_id: 4, program: ['Pitch Perfect'], ovr: 119, position: ['cm', 'cam'], nation: 'Slovakia', Status_I_H_M: 'Hero', number: 17, name: 'Marek Hamšík', stats: { goalAmounts: 19, assistAmounts: 16, match: 61, bestPlayerAmount: 7, sessionAmount: 4 }, active: { HTH: ['10*', '10*', '20*', '20*'], lastWeekCup: 1 }, imageCard: ['public/ImageCard/Ham_k_256_fc_25_download.png'], metadata: { note: '' } }
];

export default function PlayerTable({ players = [], loading = false, useFallback = false, nations = [], search = '', setSearch, cardTypeFilter = 'ALL', setCardTypeFilter, positionFilter = 'ALL', setPositionFilter, nationFilter = 'ALL', setNationFilter, sortBy = 'rating', setSortBy, onOpenAddModal, onEditPlayer, onDeletePlayer, onRecalculateStats }) {
  const sourcePlayers = useFallback ? fallbackPlayers : players;
  const query = String(search || '').trim().toLowerCase();
  const nationFor = (value) => {
    const id = value && typeof value === 'object' ? value.nation_id : null;
    return nations.find((nation) => Number(nation.nation_id) === Number(id)) || (typeof value === 'string' ? nations.find((nation) => String(nation.name).toLowerCase() === value.toLowerCase()) || { name: value } : value || {});
  };
  const nationNameFor = (value) => nationFor(value).name || (value?.nation_id ? `Nation #${value.nation_id}` : 'Unknown');
  const nationFlagFor = (value) => nationFor(value).flag_url || '';
  const nationIdFor = (value) => nationFor(value).nation_id || (value?.nation_id || '');
  const displayPlayers = sourcePlayers
    .filter((player) => !query || [player.name, nationNameFor(player.nation), ...(Array.isArray(player.program) ? player.program : [player.program]), player.currentCard?.program?.name].some((value) => String(value || '').toLowerCase().includes(query)))
    .filter((player) => cardTypeFilter === 'ALL' || String(player.Status_I_H_M || '').toLowerCase() === String(cardTypeFilter).toLowerCase())
    .filter((player) => positionFilter === 'ALL' || (Array.isArray(player.position) ? player.position : [player.position]).some((value) => String(value || '').toLowerCase() === String(positionFilter).toLowerCase()))
    .filter((player) => nationFilter === 'ALL' || String(nationIdFor(player.nation)) === String(nationFilter))
    .sort((left, right) => {
      const values = { rating: [left.ovr, right.ovr], goals: [left.stats?.goalAmounts, right.stats?.goalAmounts], assists: [left.stats?.assistAmounts, right.stats?.assistAmounts], matches: [left.stats?.match, right.stats?.match], motm: [left.stats?.bestPlayerAmount, right.stats?.bestPlayerAmount], session: [left.stats?.sessionAmount, right.stats?.sessionAmount] }[sortBy] || [left.ovr, right.ovr];
      return (Number(values[1]) || 0) - (Number(values[0]) || 0);
    });
  const positions = ['ALL', ...new Set(['ST', 'RW', 'LW', 'CF', 'CAM', 'CM', 'LM', 'CDM', 'CB', 'LB', 'RB', 'GK', ...sourcePlayers.flatMap((player) => Array.isArray(player.position) ? player.position : [])].map((position) => String(position).toUpperCase()))];
  const nationOptions = nations.length ? nations : sourcePlayers.map((player) => nationFor(player.nation)).filter((nation) => nation?.name);
  const cardTypes = ['ALL', ...new Set([
    'Matching', 'Icon', 'Hero',
    ...sourcePlayers.map((player) => player.Status_I_H_M).filter((status) => status && !['gold', 'legend'].includes(String(status).toLowerCase()))
  ])];

  return <div className="players-page">
    <section className="players-hero"><div className="players-hero-art" /><div className="players-logo"><div className="hero-stars"><i>★</i><i>★</i><i>★</i></div><AjaxLogo size={138} /></div><div className="hero-divider" /><div><h1>Phòng thay đồ</h1><p><b />save name</p></div></section>
    <div className="players-toolbar"><div className="toolbar-actions toolbar-actions-right"><button className="secondary-player-button" onClick={onRecalculateStats}>Đồng bộ thống kê</button><button className="primary-button" onClick={onOpenAddModal}><Plus /> Add Player</button></div></div>
    <div className="filters-row"><label className="search-field"><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, nation, program..." /></label><label className="filter-field"><Filter /><select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>{positions.map((p) => <option key={p} value={p}>{p === 'ALL' ? 'All positions' : `Position: ${p}`}</option>)}</select></label><label className="filter-field"><Filter /><select value={nationFilter} onChange={(e) => setNationFilter(e.target.value)}><option value="ALL">All nations</option>{nationOptions.map((nation) => <option key={nation.nation_id || nation.name} value={nation.nation_id || nation.name}>{nation.name}</option>)}</select></label><label className="filter-field"><span className="filter-label">STATUS</span><select value={cardTypeFilter} onChange={(e) => setCardTypeFilter(e.target.value)}>{cardTypes.map((c) => <option key={c} value={c}>{c === 'ALL' ? 'All statuses' : `Status: ${c}`}</option>)}</select></label><label className="filter-field"><ArrowUpDown /><select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="rating">Sort by: OVR</option><option value="goals">Sort by: Goals</option><option value="assists">Sort by: Assists</option><option value="matches">Sort by: Matches</option><option value="motm">Sort by: Best player</option><option value="session">Sort by: Session</option></select></label></div>
    <div className="player-list-header" aria-hidden="true"><span>PLAYER</span><span>PROGRAM</span><span>NATION</span><span>POSITION</span><span>PERFORMANCE</span><span>OVR</span><span>ACTION</span></div>
    {loading ? <div className="loading-state compact"><div className="spinner" /><p>Loading player database...</p></div> : <div className="arrivals-list">{displayPlayers.map((player) => {
      const currentCard = player.currentCard;
      const cardImage = currentCard?.imageCard || player.imageCard?.[0];
      const positionsText = Array.isArray(player.position) ? player.position.join(' · ').toUpperCase() : String(player.position || '—').toUpperCase();
      const nationName = nationNameFor(player.nation);
      const nationFlag = nationFlagFor(player.nation);
      const stats = { matches: player.stats?.match ?? 0, goals: player.stats?.goalAmounts ?? 0, assists: player.stats?.assistAmounts ?? 0, bestPlayer: player.stats?.bestPlayerAmount ?? 0 };
      return <div className="arrival-row" key={player.player_id || player.id || player.name}>
        <div className="arrival-player-main"><span className="arrival-player-avatar">{cardImage ? <img src={cardImage.startsWith('public/') ? `/${cardImage.slice(7)}` : cardImage} alt="" /> : <UserRound />}</span><div className="arrival-player-identity"><strong>{player.name}</strong></div></div>
        <span className="arrival-program" title={currentCard?.program?.name || player.program?.[0] || '—'}>{currentCard?.program?.name || player.program?.[0] || '—'}</span>
        <span className="arrival-player-nation" title={nationName}>{nationFlag ? <img src={nationFlag} alt={nationName} /> : '—'}</span>
        <span className="arrival-position">{positionsText}</span>
        <PlayerStatsSummary stats={stats} />
        <span className="arrival-ovr"><small>OVR</small><strong>{player.ovr ?? 0}</strong></span>
        <button className="arrival-details-button" onClick={() => onEditPlayer?.(player)}>View details <ChevronRight /></button>
        <div className="row-actions"><button onClick={() => onEditPlayer?.(player)} aria-label="Edit"><Edit3 /></button><button onClick={() => onDeletePlayer?.(player.player_id ?? player.id)} aria-label="Delete"><Trash2 /></button></div>
      </div>;
    })}</div>}
  </div>;
}
