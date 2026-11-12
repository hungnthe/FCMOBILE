import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, Goal, Medal, Pencil, Plus,
  Save, Search, Trash2, UserRound, X
} from 'lucide-react';
import SeasonPlayerRanking from './SeasonPlayerRanking';
import SeasonMatches from './SeasonMatches';
import PlayerStatsSummary from './PlayerStatsSummary';
import { applyLastWeekCup, applySeasonHth, getSessionImages, getSessionVideos } from '../services/api';
import { supportsMatchResult } from '../services/seasonCapabilities';

const blankSession = {
  Title: '', season: '', description: '', status: 'ĐÃ LƯU TRỮ', image: '', awardImage: '',
  Archive: '', lastWeekCup: '', awards: {}, player_match: [], player_ranking: [], awards_published: false, player_ranking_published: false
};

const POSITION_ORDER = ['ST', 'LW', 'RW', 'CAM', 'CM', 'RM', 'LM', 'CDM', 'LB', 'RB', 'CB', 'GK'];
const DEFAULT_SESSION_IMAGES = [
  'public/SessionImages/champions-award.png',
  'public/SessionImages/champions-season.png',
  'public/SessionImages/numero-season.png',
  'public/SessionImages/season-archive-banner.png'
];
const DEFAULT_SESSION_VIDEOS = ['public/Video/63636956821940360 (1).mp4'];
const AWARD_ICONS = {
  golden_ball: '🥇',
  silver_ball: '🥈',
  bronze_ball: '🥉',
  top_scorer: '⚽',
  top_assist: '🎯',
  best_transfer: '🤝',
  best_goal: '🎬'
};
const DEFAULT_AWARDS = {
  golden_ball: { title: 'Quả bóng vàng', player_id: null },
  silver_ball: { title: 'Quả bóng bạc', player_id: null },
  bronze_ball: { title: 'Quả bóng đồng', player_id: null },
  top_scorer: { title: 'Vua phá lưới', player_id: null },
  top_assist: { title: 'Vua kiến tạo', player_id: null },
  best_transfer: { title: 'Bản hợp đồng xuất sắc nhất', player_id: null },
  best_goal: { title: 'Bàn thắng đẹp nhất', player_id: null, video: '' }
};

const readTitle = (session) => session.Title || session.title || `Mùa giải ${session.session_id || ''}`.trim();
const publicAssetUrl = (value) => value?.startsWith('public/') ? `/${value.slice('public/'.length)}` : value || '';
const playerIdOf = (item) => {
  const value = item?.player_id ?? item?.playerId ?? (typeof item === 'number' || typeof item === 'string' ? item : '');
  return String(value || '');
};
const playerObjectIdOf = (item) => String(item?.objectId || item?.player_objectId || (typeof item === 'object' ? '' : item) || '');
const playerKeyOf = (item) => playerIdOf(item) || playerObjectIdOf(item);
const playerMatches = (match, player) => (playerIdOf(match) && playerIdOf(match) === playerIdOf(player)) || (playerObjectIdOf(match) && playerObjectIdOf(match) === playerObjectIdOf(player));
const playerForMatch = (match, players) => players.find((player) => playerMatches(match, player));
const playerImage = (player) => publicAssetUrl(player?.seasonCard?.imageCard || player?.currentCard?.imageCard || player?.imageCard?.[0] || player?.metadata?.imageCard?.[0] || player?.metadata?.image);
const positionRank = (player) => {
  const positions = Array.isArray(player?.position) ? player.position : [player?.position];
  const ranks = positions
    .map((position) => POSITION_ORDER.indexOf(String(position || '').toUpperCase()))
    .filter((rank) => rank >= 0);
  return ranks.length ? Math.min(...ranks) : POSITION_ORDER.length;
};

function nationFor(value, nations = []) {
  const id = value && typeof value === 'object' ? value.nation_id : value;
  return nations.find((nation) => Number(nation.nation_id) === Number(id));
}

function nationNameFor(player, nations = []) {
  return nationFor(player?.nation, nations)?.name || 'Chưa rõ quốc gia';
}

function nationFlagFor(player, nations = []) {
  return nationFor(player?.nation, nations)?.flag_url || '';
}

export function getSeasonPlayers(session, players = []) {
  return (session?.player_match || []).map((match) => {
    const player = playerForMatch(match, players);
    const seasonCard = player?.cards?.find((card) => Number(card.player_card_id) === Number(match.player_card_id)) || player?.currentCard || null;
    return player ? { ...player, seasonStats: match.stats || {}, playerMatch: match, seasonCard } : null;
  }).filter(Boolean);
}

function seasonTotals(session) {
  const playerTotals = (session?.player_match || []).reduce((current, item) => ({
    // A match is a season-wide event, so use the highest player's match count
    // instead of adding the same matches once per registered player.
    matches: Math.max(current.matches, Number(item.stats?.matches) || 0),
    goals: current.goals + (Number(item.stats?.goals) || 0),
    assists: current.assists + (Number(item.stats?.assists) || 0),
    bestPlayer: current.bestPlayer + (Number(item.stats?.bestPlayer) || 0),
    goalsAgainst: current.goalsAgainst,
    cleanSheets: current.cleanSheets
  }), {
    matches: 0,
    goals: 0,
    assists: 0,
    bestPlayer: 0,
    goalsAgainst: 0,
    cleanSheets: 0
  });
  const totals = {
    ...playerTotals,
    goalsAgainst: Number(session?.season_match_stats?.goalsAgainst) || 0,
    cleanSheets: Number(session?.season_match_stats?.cleanSheets) || 0
  };
  if (!supportsMatchResult(session)) return totals;
  return {
    ...totals,
    wins: Math.max(0, ...(session?.player_match || []).map((item) => Number(item.stats?.wins) || 0)),
    draws: Math.max(0, ...(session?.player_match || []).map((item) => Number(item.stats?.draws) || 0)),
    losses: Math.max(0, ...(session?.player_match || []).map((item) => Number(item.stats?.losses) || 0))
  };
}

function emptySeasonStats(item, resultTrackingEnabled = false) {
  return {
    matches: Number(item?.stats?.matches) || 0,
    goals: Number(item?.stats?.goals) || 0,
    assists: Number(item?.stats?.assists) || 0,
    bestPlayer: Number(item?.stats?.bestPlayer) || 0,
    ...(resultTrackingEnabled ? {
      wins: Number(item?.stats?.wins) || 0,
      draws: Number(item?.stats?.draws) || 0,
      losses: Number(item?.stats?.losses) || 0
    } : {})
  };
}

function serializePlayerMatch(item, player, resultTrackingEnabled = false) {
  return {
    player_id: Number(item.player_id || player?.player_id),
    objectId: item.objectId || player?.objectId,
    player_card_id: Number(item.player_card_id || player?.seasonCard?.player_card_id || player?.current_card_id) || null,
    stats: Object.fromEntries(Object.entries(emptySeasonStats(item, resultTrackingEnabled)).map(([key, value]) => [key, Number(value) || 0]))
  };
}

function SessionEditor({ session, players = [], onClose, onSave, saving }) {
  const [form, setForm] = useState(() => ({ ...blankSession, ...session }));
  const [archiveDraft, setArchiveDraft] = useState(() => session?.Archive || '');
  const [sessionImages, setSessionImages] = useState(DEFAULT_SESSION_IMAGES);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(() => (session?.player_match || []).map((item) => Number(item.player_id)));

  useEffect(() => {
    setForm({ ...blankSession, ...session });
    setArchiveDraft(session?.Archive || '');
    setSelectedPlayerIds((session?.player_match || []).map((item) => Number(item.player_id)));
  }, [session]);
  useEffect(() => { getSessionImages().then((images) => setSessionImages(images.length ? images : DEFAULT_SESSION_IMAGES)).catch(() => setSessionImages(DEFAULT_SESSION_IMAGES)); }, []);

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const togglePlayer = (playerId) => setSelectedPlayerIds((current) => current.includes(Number(playerId)) ? current.filter((id) => id !== Number(playerId)) : [...current, Number(playerId)]);
  const addArchive = () => {
    const value = String(archiveDraft || '').trim();
    if (value) setField('Archive', value);
  };
  const imageOptions = [...new Set([...(form.image ? [form.image] : []), ...sessionImages, ...(form.awardImage ? [form.awardImage] : [])])];
  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSave({
      Title: form.Title,
      season: form.season,
      description: form.description,
      status: form.status,
      Archive: form.Archive,
      image: form.image,
      awardImage: form.awardImage,
      lastWeekCup: form.lastWeekCup,
      ...(session ? {} : {
        player_match: selectedPlayerIds.map((player_id) => ({ player_id, stats: { matches: 0, goals: 0, assists: 0, bestPlayer: 0 } })),
        awards_published: false,
        player_ranking_published: false
      })
    });
  };

  return <div className="session-modal-backdrop"><form className="session-editor" onSubmit={handleSubmit}>
    <div className="session-editor-heading"><div><span className="session-eyebrow">{session ? 'EDIT SEASON' : 'NEW SEASON'}</span><h2>{session ? 'Chỉnh sửa mùa giải' : 'Tạo mùa giải mới'}</h2></div><button type="button" className="session-close-button" onClick={onClose}><X /></button></div>
    <div className="session-form-grid">
      <label>Title<input required value={form.Title} onChange={(event) => setField('Title', event.target.value)} placeholder="Mùa giải Champions" /></label>
      <label>Season<input value={form.season} onChange={(event) => setField('season', event.target.value)} placeholder="2022/23" /></label>
       <label className="session-status-field">Status<select value={form.status} onChange={(event) => setField('status', event.target.value)}><option>ĐANG DIỄN RA</option><option>ĐÃ KẾT THÚC</option><option>ĐÃ LƯU TRỮ</option></select></label>
       <div className="session-archive-field"><label>Archive (HTH)</label><div className="session-archive-input"><input value={archiveDraft} onChange={(event) => setArchiveDraft(event.target.value)} placeholder="20*" /><button type="button" className="session-inline-button" onClick={addArchive} disabled={!String(archiveDraft).trim()}>Thêm</button></div>{form.Archive && <span className="session-archive-added">Đã thêm: {form.Archive}</span>}</div>
       <label>Last Week Cup<input value={form.lastWeekCup} onChange={(event) => setField('lastWeekCup', event.target.value)} /></label>
       <label className="session-image-picker">Season image<select value={form.image} onChange={(event) => setField('image', event.target.value)}><option value="">Chọn ảnh mùa giải</option>{imageOptions.map((source) => <option key={`season-${source}`} value={source}>{source.split('/').pop()}</option>)}</select>{form.image && <img src={publicAssetUrl(form.image)} alt="Xem trước ảnh mùa giải" />}</label>
       <label className="session-image-picker">Award image<select value={form.awardImage} onChange={(event) => setField('awardImage', event.target.value)}><option value="">Chọn ảnh giải thưởng</option>{imageOptions.map((source) => <option key={`award-${source}`} value={source}>{source.split('/').pop()}</option>)}</select>{form.awardImage && <img src={publicAssetUrl(form.awardImage)} alt="Xem trước ảnh giải thưởng" />}</label>
       {!session && <div className="session-form-wide session-registration-picker"><div className="session-registration-heading"><span>Players đăng ký thi đấu</span><strong>{selectedPlayerIds.length} đã chọn</strong></div><p>Chọn từ danh sách Player hiện có; Match sau này chỉ dùng các cầu thủ này.</p><div className="session-registration-list">{players.length ? players.map((player) => { const id = Number(player.player_id); const image = playerImage(player); return <label className={`session-registration-row ${selectedPlayerIds.includes(id) ? 'is-selected' : ''}`} key={id}><input type="checkbox" checked={selectedPlayerIds.includes(id)} onChange={() => togglePlayer(id)} /><span className="session-register-avatar">{image ? <img src={image} alt="" /> : <UserRound />}</span><span><strong>{player.name}</strong><small>{Array.isArray(player.position) ? player.position.join(' · ').toUpperCase() : '—'} · OVR {player.ovr ?? 0}</small></span></label>; }) : <span className="session-registration-empty">Chưa có Player trong hệ thống.</span>}</div></div>}
       <label className="session-form-wide">Description<textarea rows="4" value={form.description} onChange={(event) => setField('description', event.target.value)} /></label>
    </div>
    <p className="session-editor-note">Bạn có thể đăng ký Player ngay tại đây hoặc tiếp tục quản lý trong tab Cầu thủ; Match chỉ dùng các Player đã đăng ký.</p>
    <div className="session-editor-actions"><button type="button" className="session-secondary-button" onClick={onClose}>Hủy</button><button className="session-primary-button" disabled={saving}><Save />{saving ? 'Đang lưu...' : 'Lưu mùa giải'}</button></div>
  </form></div>;
}

function RegisterPlayersModal({ players, nations, registeredIds, onClose, onRegister, saving }) {
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('ALL');
  const [nation, setNation] = useState('ALL');
  const [program, setProgram] = useState('ALL');
  const [selected, setSelected] = useState([]);
  const [selectedCards, setSelectedCards] = useState({});

  const positions = useMemo(() => {
    const available = new Set(players.flatMap((player) => Array.isArray(player.position) ? player.position : [player.position]).filter(Boolean).map((item) => String(item).toUpperCase()));
    return ['ALL', ...POSITION_ORDER.filter((item) => available.has(item)), ...[...available].filter((item) => !POSITION_ORDER.includes(item)).sort()];
  }, [players]);
  const programs = useMemo(() => ['ALL', ...new Set(players.flatMap((player) => (player.cards || []).map((card) => card.program?.name || card.program?.display_name).filter(Boolean).concat(Array.isArray(player.program) ? player.program : [player.program])).filter(Boolean))], [players]);
  const filteredPlayers = useMemo(() => players.filter((player) => {
    const query = search.trim().toLowerCase();
    const playerProgram = (player.cards || []).map((card) => card.program?.name || card.program?.display_name).filter(Boolean).concat(Array.isArray(player.program) ? player.program : [player.program]);
    const positionsOfPlayer = Array.isArray(player.position) ? player.position : [player.position];
    const matchesSearch = !query || [player.name, ...playerProgram, nationNameFor(player, nations)].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesPosition = position === 'ALL' || positionsOfPlayer.some((item) => String(item).toUpperCase() === position);
    const matchesNation = nation === 'ALL' || Number(player.nation?.nation_id) === Number(nation);
    const matchesProgram = program === 'ALL' || playerProgram.includes(program);
    return !registeredIds.has(Number(player.player_id)) && matchesSearch && matchesPosition && matchesNation && matchesProgram;
  }), [players, nations, registeredIds, search, position, nation, program]);

  const togglePlayer = (playerId, player) => { setSelected((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]); if (!selectedCards[playerId]) setSelectedCards((current) => ({ ...current, [playerId]: player.current_card_id || player.cards?.[0]?.player_card_id || '' })); };
  const submit = async () => { await onRegister(selected, selectedCards); setSelected([]); setSelectedCards({}); };

  return <div className="session-modal-backdrop"><section className="session-register-modal">
    <div className="session-editor-heading"><div><span className="session-eyebrow">SEASON PLAYERS</span><h2>Đăng ký cầu thủ</h2><p>Chọn cầu thủ tham dự mùa giải này</p></div><button type="button" className="session-close-button" onClick={onClose}><X /></button></div>
    <div className="session-register-filters"><label className="session-search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm theo tên cầu thủ..." /></label><select value={position} onChange={(event) => setPosition(event.target.value)}><option value="ALL">Tất cả vị trí</option>{positions.filter((item) => item !== 'ALL').map((item) => <option key={item}>{item}</option>)}</select><select value={nation} onChange={(event) => setNation(event.target.value)}><option value="ALL">Tất cả quốc gia</option>{nations.map((item) => <option key={item.nation_id} value={item.nation_id}>{item.name}</option>)}</select><select value={program} onChange={(event) => setProgram(event.target.value)}><option value="ALL">Tất cả chương trình</option>{programs.filter((item) => item !== 'ALL').map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="session-register-list">{filteredPlayers.length ? filteredPlayers.map((player) => { const id = Number(player.player_id); const image = playerImage(player); const isSelected = selected.includes(id); return <label className={`session-register-row ${isSelected ? 'is-selected' : ''}`} key={id}><input type="checkbox" checked={isSelected} onChange={() => togglePlayer(id, player)} /><span className="session-register-avatar">{image ? <img src={image} alt="" /> : <UserRound />}</span><span className="session-register-copy"><strong>{player.name}</strong><small>{Array.isArray(player.position) ? player.position.join(' · ').toUpperCase() : '—'} · OVR {player.ovr ?? 0}</small><small>{nationFlagFor(player, nations) && <img src={nationFlagFor(player, nations)} alt="" />} {nationNameFor(player, nations)}</small>{isSelected && player.cards?.length > 0 && <select className="session-card-picker" value={selectedCards[id] || player.current_card_id || player.cards[0].player_card_id} onClick={(event) => event.stopPropagation()} onChange={(event) => setSelectedCards((current) => ({ ...current, [id]: Number(event.target.value) }))}><option value="">Chọn thẻ thi đấu</option>{player.cards.map((card) => <option key={card.player_card_id} value={card.player_card_id}>{card.program?.name || `Card #${card.player_card_id}`} · OVR {card.ovr}</option>)}</select>}</span><span className="session-register-check">{isSelected && <Check />}</span></label>; }) : <div className="session-empty-state">Không tìm thấy cầu thủ phù hợp.</div>}</div>
    <div className="session-register-footer"><button type="button" className="session-secondary-button" onClick={onClose}>Hủy</button><button type="button" className="session-primary-button" disabled={!selected.length || saving} onClick={submit}><Plus /> {saving ? 'Đang đăng ký...' : `Đăng ký (${selected.length})`}</button></div>
  </section></div>;
}

function SeasonPlayerMobileCard({ entry, stats, editing, nations, onUpdateCard, onRemove, onSetStat, resultTrackingEnabled }) {
  const image = playerImage(entry);
  const nationName = nationNameFor(entry, nations);
  const nationFlag = nationFlagFor(entry, nations);
  const statDefinitions = [['matches', 'Trận'], ['goals', 'Bàn'], ['assists', 'KT'], ['bestPlayer', 'MVP'], ...(resultTrackingEnabled ? [['wins', 'W'], ['draws', 'D'], ['losses', 'L']] : [])];
  return <article className="season-player-mobile-card"><div className="season-mobile-player-heading"><span className="season-player-avatar">{image ? <img src={image} alt="" /> : <UserRound />}</span><div><strong>{entry.name}</strong><span>{nationFlag ? <img src={nationFlag} alt={nationName} /> : '—'} {Array.isArray(entry.position) ? entry.position.join(' · ').toUpperCase() : '—'}</span></div><b>OVR {entry.seasonCard?.ovr ?? entry.ovr ?? 0}</b></div><label className="season-mobile-card-select">Thẻ<select value={entry.playerMatch?.player_card_id || entry.seasonCard?.player_card_id || ''} onChange={(event) => onUpdateCard(entry, event.target.value)}>{(entry.cards || []).map((card) => <option key={card.player_card_id} value={card.player_card_id}>{card.program?.name || `#${card.player_card_id}`} · {card.ovr}</option>)}</select></label><div className="season-mobile-stats">{statDefinitions.map(([key, label]) => <label key={key}><span>{label}</span>{editing && onSetStat ? <input type="number" min="0" value={stats?.[key] ?? 0} onChange={(event) => onSetStat(entry.player_id, key, event.target.value)} /> : <strong>{stats?.[key] ?? 0}</strong>}</label>)}</div><button type="button" className="season-remove-player-button" title="Bỏ đăng ký" onClick={() => onRemove(entry)}><Trash2 /> Bỏ đăng ký</button></article>;
}

function SeasonPlayerTable({ session, players, nations, onRegister, onUpdateStats, onUpdatePlayerCard, onRemovePlayer }) {
  const seasonPlayers = getSeasonPlayers(session, players);
  const resultTrackingEnabled = supportsMatchResult(session);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('position');
  const [nationFilter, setNationFilter] = useState('ALL');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({});

  useEffect(() => {
    setDraft(Object.fromEntries(seasonPlayers.map((entry) => [Number(entry.player_id), emptySeasonStats(entry.playerMatch, resultTrackingEnabled)])));
    setEditing(false);
  }, [session, players]);

  const visiblePlayers = useMemo(() => seasonPlayers.filter((entry) => String(entry.name || '').toLowerCase().includes(search.trim().toLowerCase()) && (nationFilter === 'ALL' || String(entry.nation?.nation_id ?? entry.nation?.id ?? entry.nation) === String(nationFilter))).sort((left, right) => {
    if (sortBy === 'position') {
      return positionRank(left) - positionRank(right) || String(left.name).localeCompare(String(right.name));
    }
    if (sortBy === 'name') return String(left.name).localeCompare(String(right.name));
    const leftValue = sortBy === 'ovr' ? Number(left.ovr) : Number(left.seasonStats?.[sortBy]);
    const rightValue = sortBy === 'ovr' ? Number(right.ovr) : Number(right.seasonStats?.[sortBy]);
    return rightValue - leftValue;
  }), [seasonPlayers, search, sortBy, nationFilter]);

  const setStat = (playerId, key, value) => setDraft((current) => ({ ...current, [playerId]: { ...current[playerId], [key]: value } }));
  const cancel = () => {
    setDraft(Object.fromEntries(seasonPlayers.map((entry) => [Number(entry.player_id), emptySeasonStats(entry.playerMatch, resultTrackingEnabled)])));
    setEditing(false);
  };
  const save = async () => {
    setSaving(true);
    try {
      await onUpdateStats(seasonPlayers.map((entry) => serializePlayerMatch({ player_id: entry.player_id, objectId: entry.objectId, stats: draft[Number(entry.player_id)] }, entry, resultTrackingEnabled)));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  const remove = async (entry) => {
    const playerId = Number(entry.player_id);
    const awards = Object.values(session.awards || {}).filter((award) => Number(award?.player_id) === playerId).map((award) => award.title);
    const stats = emptySeasonStats(entry.playerMatch, resultTrackingEnabled);
    const usedStats = Object.values(stats).some((value) => value > 0);
    const usage = [...(awards.length ? [`Danh hiệu: ${awards.join(', ')}`] : []), ...(usedStats ? [`Stats: ${stats.matches} trận, ${stats.goals} bàn, ${stats.assists} kiến tạo, ${stats.bestPlayer} MVP`] : [])];
    const message = usage.length ? `Không thể xóa ${entry.name} khỏi mùa giải mà không xác nhận.\n\nĐang được sử dụng tại:\n- ${usage.join('\n- ')}\n\nBạn có muốn xóa cưỡng bức và gỡ các liên kết danh hiệu không?` : `Bỏ đăng ký ${entry.name} khỏi mùa giải?`;
    if (!window.confirm(message)) return;
    await onRemovePlayer(playerId, Boolean(usage.length));
  };
  const updateCard = async (entry, value) => {
    const playerMatch = (session.player_match || []).map((item) => Number(item.player_id) === Number(entry.player_id) ? { ...item, player_card_id: Number(value) } : item);
    await onUpdatePlayerCard(playerMatch);
  };

  const statDefinitions = [['matches', 'Trận'], ['goals', 'Bàn'], ['assists', 'KT'], ['bestPlayer', 'MVP'], ...(resultTrackingEnabled ? [['wins', 'W'], ['draws', 'D'], ['losses', 'L']] : [])];
  return <section className="session-detail-panel session-players-panel">
    <div className="session-detail-panel-heading"><div><span className="session-eyebrow">SEASON PLAYERS</span><h2>Cầu thủ tham dự</h2></div><div className="session-detail-panel-heading-actions"><span>{seasonPlayers.length} cầu thủ</span><button type="button" className="session-primary-button" onClick={onRegister}><Plus /> Đăng ký cầu thủ</button></div></div>
    {seasonPlayers.length ? <><div className="season-player-toolbar"><label className="session-search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm cầu thủ trong mùa giải..." /></label><select value={nationFilter} onChange={(event) => setNationFilter(event.target.value)} aria-label="Lọc cầu thủ theo nation"><option value="ALL">Tất cả nation</option>{nations.map((nation) => <option key={nation.nation_id} value={nation.nation_id}>{nation.name}</option>)}</select><select value={sortBy} onChange={(event) => setSortBy(event.target.value)}><option value="position">Sắp xếp: Vị trí</option><option value="name">Sắp xếp: Tên</option><option value="ovr">Sắp xếp: OVR</option><option value="matches">Sắp xếp: Trận đấu</option><option value="goals">Sắp xếp: Bàn thắng</option><option value="assists">Sắp xếp: Kiến tạo</option><option value="bestPlayer">Sắp xếp: Best player</option>{resultTrackingEnabled && <><option value="wins">Sắp xếp: Thắng</option><option value="draws">Sắp xếp: Hòa</option><option value="losses">Sắp xếp: Thua</option></>}</select>{editing ? <><button type="button" className="session-secondary-button" onClick={cancel}>Hủy</button><button type="button" className="session-primary-button" disabled={saving} onClick={save}><Save /> {saving ? 'Đang lưu...' : 'Lưu chỉ số'}</button></> : <button type="button" className="session-secondary-button" onClick={() => setEditing(true)}>Cập nhật chỉ số</button>}</div><div className="season-player-table-wrap"><table className={`season-player-table ${resultTrackingEnabled ? 'has-result-tracking' : ''}`}><thead><tr><th>Cầu thủ</th><th>Nation</th><th>POS</th><th>Thẻ</th><th>OVR</th><th colSpan={resultTrackingEnabled ? 7 : 4} className="season-stats-group-heading">THỐNG KÊ MÙA GIẢI</th><th>Action</th></tr><tr className="season-player-subheader"><th colSpan="5"></th>{statDefinitions.map(([, label]) => <th key={label}>{label}</th>)}<th></th></tr></thead><tbody>{visiblePlayers.map((entry) => { const stats = editing ? draft[Number(entry.player_id)] : entry.seasonStats; const image = playerImage(entry); const nationName = nationNameFor(entry, nations); const nationFlag = nationFlagFor(entry, nations); return <tr key={entry.player_id}><td><div className="season-player-cell"><span className="season-player-avatar">{image ? <img src={image} alt="" /> : <UserRound />}</span><strong>{entry.name}</strong></div></td><td><span className="season-player-nation" title={nationName}>{nationFlag ? <img src={nationFlag} alt={nationName} /> : '—'}</span></td><td>{Array.isArray(entry.position) ? entry.position.join(' · ').toUpperCase() : '—'}</td><td><select className="season-card-select" value={entry.playerMatch?.player_card_id || entry.seasonCard?.player_card_id || ''} onChange={(event) => updateCard(entry, event.target.value)}>{(entry.cards || []).map((card) => <option key={card.player_card_id} value={card.player_card_id}>{card.program?.name || `#${card.player_card_id}`} · {card.ovr}</option>)}</select></td><td className="season-ovr-cell">{entry.seasonCard?.ovr ?? entry.ovr ?? 0}</td>{editing ? statDefinitions.map(([key, label]) => <td className="season-stat-cell" key={key}><input className="season-stat-input" type="number" min="0" step="1" aria-label={`${entry.name} ${label}`} value={stats?.[key] ?? 0} onChange={(event) => setStat(entry.player_id, key, event.target.value)} /></td>) : <PlayerStatsSummary variant="table" stats={stats} resultTrackingEnabled={resultTrackingEnabled} />} <td><button type="button" className="season-remove-player-button" title="Bỏ đăng ký" onClick={() => remove(entry)}><Trash2 /></button></td></tr>; })}</tbody></table><div className="season-player-mobile-list">{visiblePlayers.map((entry) => <SeasonPlayerMobileCard key={entry.player_id} entry={entry} stats={editing ? draft[Number(entry.player_id)] : entry.seasonStats} editing={editing} onUpdateCard={updateCard} onRemove={remove} onSetStat={setStat} resultTrackingEnabled={resultTrackingEnabled} />)}</div>{!visiblePlayers.length && <div className="session-empty-state">Không có cầu thủ khớp tìm kiếm.</div>}</div></> : <div className="session-empty-state session-player-empty"><UserRound /><h3>Chưa có cầu thủ nào được đăng ký</h3><p>Đăng ký cầu thủ từ danh sách player hiện có để bắt đầu mùa giải.</p><button type="button" className="session-primary-button" onClick={onRegister}><Plus /> Đăng ký cầu thủ</button></div>}
  </section>;
}

function withoutBestPlayerAward(awards = {}) {
  return Object.fromEntries(Object.entries(awards || {}).filter(([key]) => key !== 'best_player'));
}

function awardDraftFrom(awards = {}) {
  const stored = withoutBestPlayerAward(awards);
  const defaults = Object.fromEntries(Object.entries(DEFAULT_AWARDS).map(([key, award]) => [key, { ...award, ...(stored[key] || {}) }]));
  const custom = Object.fromEntries(Object.entries(stored).filter(([key]) => !Object.prototype.hasOwnProperty.call(DEFAULT_AWARDS, key)));
  return { ...defaults, ...custom };
}

function SeasonAwards({ session, seasonPlayers, onSave, onPublish, saving }) {
  const [editing, setEditing] = useState(false);
  const [savingAwards, setSavingAwards] = useState(false);
  const [draft, setDraft] = useState(() => awardDraftFrom(session.awards));
  const [sessionVideos, setSessionVideos] = useState(DEFAULT_SESSION_VIDEOS);
  const awardImageUrl = publicAssetUrl(session.awardImage);
  const awardEntries = Object.entries(draft).filter(([key, award]) => key !== 'best_player' && award?.title);

  useEffect(() => {
    setDraft(awardDraftFrom(session.awards));
    setEditing(false);
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    getSessionVideos().then((videos) => {
      if (!cancelled && Array.isArray(videos) && videos.length) setSessionVideos(videos);
    }).catch(() => {
      // The frontend fallback also works when the backend runs in a separate container.
    });
    return () => { cancelled = true; };
  }, []);

  const setAwardField = (key, field, value) => setDraft((current) => ({ ...current, [key]: { ...current[key], [field]: value } }));
  const cancel = () => { setDraft(awardDraftFrom(session.awards)); setEditing(false); };
  const save = async () => {
    setSavingAwards(true);
    try {
      const cleanedAwards = awardDraftFrom(draft);
      await onSave(cleanedAwards);
      setDraft(cleanedAwards);
      setEditing(false);
    } finally { setSavingAwards(false); }
  };
  const published = session.awards_published !== false;
  const publish = async () => { if (onPublish) await onPublish(true); };

  return <section className="session-detail-panel session-awards-panel"><div className="session-detail-panel-heading"><div><span className="session-eyebrow">SEASON AWARDS</span><h2>Giải thưởng mùa giải</h2><span className={`season-publication-status ${published ? 'is-published' : ''}`}>{published ? 'Đã công bố' : 'Chưa công bố'}</span></div><div className="session-detail-panel-heading-actions">{!published && !editing && <button type="button" className="session-primary-button" onClick={publish}>Công bố đề cử</button>}{editing ? <><button type="button" className="session-secondary-button" onClick={cancel}>Hủy</button><button type="button" className="session-primary-button" disabled={savingAwards || saving} onClick={save}><Save /> {savingAwards ? 'Đang lưu...' : 'Lưu danh hiệu'}</button></> : <button type="button" className="session-secondary-button" onClick={() => setEditing(true)}>Cập nhật danh hiệu</button>}</div></div>{!published && <p className="season-unpublished-note">Danh sách đề cử đang được chuẩn bị và chưa hiển thị công khai.</p>}{awardImageUrl && <div className="session-detail-award-visual"><img src={awardImageUrl} alt="Hình ảnh danh hiệu mùa giải" /></div>}<div className="season-awards-list">{awardEntries.length ? awardEntries.map(([key, award]) => { const winner = seasonPlayers.find((player) => Number(player.player_id) === Number(award.player_id)); const videoUrl = publicAssetUrl(award.video); const videoOptions = award.video && !sessionVideos.includes(award.video) ? [award.video, ...sessionVideos] : sessionVideos; return <article className={`season-award-card ${key === 'best_goal' ? 'is-best-goal' : ''}`} key={key}><span className="season-award-icon" aria-hidden="true">{AWARD_ICONS[key] || '🏆'}</span><div className="season-award-copy"><strong>{award.title}</strong>{editing ? <select value={award.player_id ?? ''} onChange={(event) => setAwardField(key, 'player_id', event.target.value === '' ? null : Number(event.target.value))}><option value="">Chưa gán cầu thủ</option>{seasonPlayers.map((player) => <option key={player.player_id} value={player.player_id}>{player.name} · OVR {player.ovr ?? 0}</option>)}</select> : <span>{published ? winner?.name || 'Chưa công bố' : 'Chưa công bố'}</span>}{key === 'best_goal' && (editing ? <div className="season-award-video-field"><label htmlFor={`season-award-video-${session.session_id}`}>Video bàn thắng</label><select id={`season-award-video-${session.session_id}`} className="season-award-video" value={award.video || ''} onChange={(event) => setAwardField(key, 'video', event.target.value)}><option value="">Chọn video từ thư mục public/Video</option>{videoOptions.map((video) => <option key={video} value={video}>{video.split('/').pop()}</option>)}</select></div> : published && videoUrl ? <video className="season-award-video-preview" controls preload="metadata"><source src={videoUrl} /></video> : <span className="season-award-video-empty">Chưa có video bàn thắng</span>)}</div>{published && winner && <span className="season-award-avatar">{playerImage(winner) ? <img src={playerImage(winner)} alt="" /> : <UserRound />}</span>}</article>; }) : <div className="session-empty-state">Chưa có danh hiệu trong mùa giải.</div>}</div></section>;
}

function SeasonStats({ session, seasonPlayers }) {
  const totals = seasonTotals(session);
  const hasMatchResults = supportsMatchResult(session);
  const resultTotal = totals.wins + totals.draws + totals.losses;
  const winEnd = resultTotal ? (totals.wins / resultTotal) * 100 : 0;
  const drawEnd = resultTotal ? winEnd + (totals.draws / resultTotal) * 100 : 0;
  const resultChartStyle = resultTotal ? {
    background: `conic-gradient(var(--season-win) 0 ${winEnd}%, var(--season-draw) ${winEnd}% ${drawEnd}%, var(--season-loss) ${drawEnd}% 100%)`,
  } : undefined;
  return <section className="session-detail-panel session-stats-panel">
    <div className="session-detail-panel-heading"><div><span className="session-eyebrow">SEASON STATS</span><h2>Thống kê mùa giải</h2></div><span>{seasonPlayers.length} cầu thủ</span></div>
    <div className="session-inline-stats">
      <div><strong>{totals.matches}</strong><span>Tổng số trận</span></div>
      <div><strong>{totals.goals}</strong><span>Bàn thắng</span></div>
      <div><strong>{totals.goalsAgainst}</strong><span>Bàn thua</span></div>
      <div><strong>{totals.cleanSheets}</strong><span>Giữ sạch lưới</span></div>
      {hasMatchResults && <>
        <div><strong>{totals.wins} / {totals.matches}</strong><span>Thắng / Tổng trận</span></div>
        <div><strong>{totals.draws} / {totals.matches}</strong><span>Hòa / Tổng trận</span></div>
        <div><strong>{totals.losses} / {totals.matches}</strong><span>Thua / Tổng trận</span></div>
      </>}
    </div>
    {hasMatchResults && <div className="season-result-chart">
      <div className={`season-result-donut ${resultTotal ? '' : 'is-empty'}`} style={resultChartStyle} role="img" aria-label={`Kết quả mùa giải: ${totals.wins} trận thắng, ${totals.draws} trận hòa, ${totals.losses} trận thua`}>
        <span>{resultTotal}<small>kết quả</small></span>
      </div>
      <div className="season-result-legend" aria-label="Chú thích kết quả trận đấu">
        <div><i className="season-result-dot is-win" /><span>Thắng</span><strong>{totals.wins}</strong></div>
        <div><i className="season-result-dot is-draw" /><span>Hòa</span><strong>{totals.draws}</strong></div>
        <div><i className="season-result-dot is-loss" /><span>Thua</span><strong>{totals.losses}</strong></div>
        {!resultTotal && <p>Chưa có kết quả trận đấu</p>}
      </div>
    </div>}
  </section>;
}

function SeasonHonorUpdates({ session, seasonPlayers, onChanged, onUpdateArchive }) {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [hthSaving, setHthSaving] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [cupSaving, setCupSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [archiveDraft, setArchiveDraft] = useState(() => String(session.Archive || ''));
  const batchIdRef = useRef(null);
  const hthApplied = session.honor_updates?.hth?.applied === true;
  const archive = archiveDraft.trim();
  const visiblePlayers = seasonPlayers.filter((player) => String(player.name || '').toLowerCase().includes(search.trim().toLowerCase()));
  const togglePlayer = (id) => setSelectedPlayers((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const saveArchive = async () => {
    const value = archiveDraft.trim();
    if (!value || value === String(session.Archive || '').trim() || !onUpdateArchive) return;
    setError(''); setArchiveSaving(true);
    try { await onUpdateArchive(value); } catch (requestError) { setError(requestError.response?.data?.error || 'Không thể lưu Archive.'); } finally { setArchiveSaving(false); }
  };
  const updateHth = async () => {
    setError(''); setHthSaving(true);
    try { const result = await applySeasonHth(session.session_id); onChanged?.(result); } catch (requestError) { setError(requestError.response?.data?.error || 'Không thể cập nhật HTH.'); } finally { setHthSaving(false); }
  };
  const updateCup = async () => {
    if (!selectedPlayers.length) return;
    setError(''); setCupSaving(true);
    if (!batchIdRef.current) batchIdRef.current = `lwc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const result = await applyLastWeekCup(session.session_id, selectedPlayers, batchIdRef.current);
      batchIdRef.current = null; setSelectedPlayers([]); onChanged?.(result);
    } catch (requestError) { setError(requestError.response?.data?.error || 'Không thể cập nhật Last Week Cup.'); } finally { setCupSaving(false); }
  };

  return <section className="session-detail-panel season-honor-updates"><div className="session-detail-panel-heading"><div><span className="session-eyebrow">DANH HIỆU CẦU THỦ</span><h2>Cập nhật danh hiệu cầu thủ</h2></div><span>Chỉ áp dụng cho cầu thủ đã đăng ký</span></div>{error && <p className="season-honor-error" role="alert">{error}</p>}<div className="season-honor-grid"><div className="season-honor-box"><div className="season-honor-box-heading"><div><span className="session-eyebrow">HTH MÙA GIẢI</span><h3>Archive</h3></div><strong>{archive || '—'}</strong></div><label className="season-honor-archive-editor"><span>Giá trị HTH mùa này</span><div><input value={archiveDraft} maxLength={12} disabled={hthApplied || archiveSaving} placeholder="Ví dụ: 20*" onChange={(event) => setArchiveDraft(event.target.value)} /><button type="button" className="session-secondary-button" disabled={hthApplied || archiveSaving || !archive || archive === String(session.Archive || '').trim()} onClick={saveArchive}>{archiveSaving ? 'Đang lưu...' : 'Lưu Archive'}</button></div></label>{!archive && <p className="season-honor-missing">Mùa giải chưa có Archive. Nhập giá trị trước khi cập nhật HTH.</p>}<p>{seasonPlayers.length} cầu thủ đã đăng ký</p><button type="button" className="session-primary-button" disabled={hthApplied || !archive || !seasonPlayers.length || hthSaving} onClick={updateHth}>{hthApplied ? '✓ Đã cập nhật HTH' : hthSaving ? 'Đang cập nhật...' : `Cập nhật HTH cho ${seasonPlayers.length} cầu thủ`}</button></div><div className="season-honor-box"><div className="season-honor-box-heading"><div><span className="session-eyebrow">LAST WEEK CUP</span><h3>Chọn cầu thủ</h3></div><strong>{selectedPlayers.length}</strong></div><label className="session-search-field"><Search /><input value={search} placeholder="Tìm cầu thủ..." aria-label="Tìm cầu thủ Last Week Cup" onChange={(event) => setSearch(event.target.value)} /></label><div className="season-honor-player-list">{visiblePlayers.map((player) => { const id = Number(player.player_id); const checked = selectedPlayers.includes(id); return <label className={`season-honor-player-row ${checked ? 'is-selected' : ''}`} key={id}><input type="checkbox" checked={checked} onChange={() => togglePlayer(id)} /><span>{player.name}</span><small>{player.active?.lastWeekCup ?? 0} Cup</small></label>; })}</div><button type="button" className="session-primary-button" disabled={!selectedPlayers.length || cupSaving} onClick={updateCup}>{cupSaving ? 'Đang cập nhật...' : `+1 Cup cho ${selectedPlayers.length} cầu thủ`}</button></div></div></section>;
}

function SessionDetail({ session, players, nations, onBack, onEdit, onRegister, onUpdateStats, onUpdatePlayerCard, onRemovePlayer, onUpdateAwards, onPublishAwards, onSaveRanking, onPublishRanking, onMatchChanged, onHonorChanged, onUpdateArchive, registrationSaving, saving }) {
  const [activeTab, setActiveTab] = useState('overview');
  const seasonPlayers = getSeasonPlayers(session, players);
  const totals = seasonTotals(session);
  const imageUrl = publicAssetUrl(session.image);
  const status = String(session.status || 'ĐÃ LƯU TRỮ').toLowerCase();
  const statusClass = status.includes('diễn') || status.includes('ongoing') || status.includes('current') ? 'is-active' : status.includes('kết') || status.includes('ended') ? 'is-ended' : '';
  const tabs = [['overview', 'Tổng quan'], ['players', 'Cầu thủ'], ['matches', 'Trận đấu'], ['stats', 'Thống kê'], ['awards', 'Giải thưởng']];

  return <div className="session-detail-page">
    <button className="session-back-button" onClick={onBack}><ArrowLeft /> Quay lại mùa giải</button>
    <section className="session-detail-cover">{imageUrl ? <img src={imageUrl} alt={readTitle(session)} /> : <div className="session-detail-cover-empty"><Medal /><span>Chưa có ảnh mùa giải</span></div>}<div className="session-detail-cover-overlay"><span className={`session-detail-status ${statusClass}`}>{session.status || 'ĐÃ LƯU TRỮ'}</span><span>SESSION {session.session_id}</span></div></section>
    <div className="session-detail-heading"><div><span className="session-eyebrow">SESSION DETAIL</span><h1>{readTitle(session)}</h1></div><button className="session-primary-button" onClick={onEdit}><Pencil /> Sửa mùa giải</button></div>
    <nav className="session-detail-tabs" aria-label="Season detail sections">{tabs.map(([key, label]) => <button type="button" className={activeTab === key ? 'is-active' : ''} key={key} onClick={() => setActiveTab(key)}>{label}</button>)}</nav>
    {activeTab === 'overview' && <div className="session-overview-content"><section className="session-detail-stats"><StatBox icon={CalendarDays} label="Trận đấu" value={totals.matches} /><StatBox icon={Goal} label="Bàn thắng" value={totals.goals} /></section><section className="session-detail-panel"><span className="session-eyebrow">OVERVIEW</span><h2>Thông tin mùa giải</h2><p className="session-detail-description">{session.description || 'Mùa giải đã được lưu trữ trong hệ thống.'}</p><div className="session-overview-meta"><span><CalendarDays /> {session.season || 'Chưa có niên khóa'}</span><span className={`session-detail-status ${statusClass}`}>{session.status || 'ĐÃ LƯU TRỮ'}</span><span><UserRound /> {seasonPlayers.length} cầu thủ đăng ký</span></div></section></div>}
    {activeTab === 'players' && <SeasonPlayerTable session={session} players={players} nations={nations} onRegister={onRegister} onUpdateStats={onUpdateStats} onUpdatePlayerCard={onUpdatePlayerCard} onRemovePlayer={onRemovePlayer} />}
    {activeTab === 'matches' && <SeasonMatches session={session} seasonPlayers={seasonPlayers} onChanged={onMatchChanged} />}
    {activeTab === 'stats' && <SeasonStats session={session} seasonPlayers={seasonPlayers} />}
    {activeTab === 'awards' && <><SeasonAwards session={session} seasonPlayers={seasonPlayers} onSave={onUpdateAwards} onPublish={onPublishAwards} saving={saving} /><SeasonHonorUpdates session={session} seasonPlayers={seasonPlayers} onChanged={onHonorChanged} onUpdateArchive={onUpdateArchive} /><SeasonPlayerRanking session={session} players={players} onSave={onSaveRanking} onPublish={onPublishRanking} /></>}
  </div>;
}

function StatBox({ icon: Icon, label, value }) {
  return <div className="session-stat-box"><span className="session-stat-icon"><Icon /></span><div><span>{label}</span><strong>{value}</strong><small>{label === 'Danh hiệu' ? 'danh hiệu' : label === 'Bàn thắng' ? 'bàn' : label === 'Kiến tạo' ? 'đường chuyền' : label === 'Trận đấu' ? 'trận' : 'mùa'}</small></div></div>;
}

export default function Sessions({ sessions = [], players = [], nations = [], onCreate, onUpdate, onDelete, onRemovePlayerFromSession, onMatchChanged, onHonorChanged }) {
  const [editingSession, setEditingSession] = useState(null);
  const [viewingSession, setViewingSession] = useState(null);
  const [registeringSession, setRegisteringSession] = useState(null);
  const [saving, setSaving] = useState(false);
  const [registrationSaving, setRegistrationSaving] = useState(false);

  const summary = useMemo(() => ({ seasons: sessions.length }), [sessions]);
  const openEditor = (session = null) => { setViewingSession(null); setEditingSession(session || false); };
  const saveSession = async (data) => {
    setSaving(true);
    try {
      if (editingSession) await onUpdate(editingSession.session_id, data);
      else await onCreate({ ...data, player_match: data.player_match || [], awards: {}, player_ranking: [], awards_published: false, player_ranking_published: false });
      setEditingSession(null);
    } finally { setSaving(false); }
  };
  const updatePlayerStats = async (playerMatch) => {
    if (!viewingSession) return;
    await onUpdate(viewingSession.session_id, { player_match: playerMatch });
    setViewingSession((current) => current ? { ...current, player_match: playerMatch } : current);
  };
  const updatePlayerCard = async (playerMatch) => {
    if (!viewingSession) return;
    await onUpdate(viewingSession.session_id, { player_match: playerMatch });
    setViewingSession((current) => current ? { ...current, player_match: playerMatch } : current);
  };
  const registerPlayers = async (playerIds, selectedCards = {}) => {
    if (!registeringSession || !playerIds.length) return;
    setRegistrationSaving(true);
    try {
      const registered = new Set(getSeasonPlayers(registeringSession, players).map((player) => Number(player.player_id)));
      const additions = playerIds.filter((id) => !registered.has(Number(id))).map((id) => {
        const player = players.find((item) => Number(item.player_id) === Number(id));
        return { player_id: Number(id), objectId: player?.objectId, player_card_id: Number(selectedCards[id] || player?.current_card_id || player?.cards?.[0]?.player_card_id) || null, stats: { matches: 0, goals: 0, assists: 0, bestPlayer: 0 } };
      });
      const playerMatch = [...(registeringSession.player_match || []), ...additions];
      await onUpdate(registeringSession.session_id, { player_match: playerMatch });
      setViewingSession((current) => current ? { ...current, player_match: playerMatch } : current);
      setRegisteringSession(null);
    } finally { setRegistrationSaving(false); }
  };
  const updateAwards = async (awards) => {
    if (!viewingSession) return;
    await onUpdate(viewingSession.session_id, { awards });
    setViewingSession((current) => current ? { ...current, awards } : current);
  };
  const updateAwardsPublication = async (published) => {
    if (!viewingSession) return;
    const saved = await onUpdate(viewingSession.session_id, { awards_published: published });
    if (saved) setViewingSession(saved);
    else setViewingSession((current) => current ? { ...current, awards_published: published } : current);
  };
  const updateRanking = async (playerRanking) => {
    if (!viewingSession) return;
    const saved = await onUpdate(viewingSession.session_id, { player_ranking: playerRanking });
    setViewingSession(saved || (current => current ? { ...current, player_ranking: playerRanking } : current));
  };
  const updateRankingPublication = async (published) => {
    if (!viewingSession) return;
    const saved = await onUpdate(viewingSession.session_id, { player_ranking_published: published });
    if (saved) setViewingSession(saved);
    else setViewingSession((current) => current ? { ...current, player_ranking_published: published } : current);
  };
  const updateArchive = async (archive) => {
    if (!viewingSession) return null;
    const saved = await onUpdate(viewingSession.session_id, { Archive: archive });
    if (saved) setViewingSession(saved);
    else setViewingSession((current) => current ? { ...current, Archive: archive } : current);
    return saved;
  };
  const removePlayer = async (playerId, force) => {
    if (!viewingSession || !onRemovePlayerFromSession) return;
    const updated = await onRemovePlayerFromSession(viewingSession.session_id, playerId, force);
    setViewingSession(updated || null);
  };

  const listContent = <>
    <section className="sessions-hero"><img className="sessions-hero-image" src="/SessionImages/season-archive-banner.png" alt="Mùa giải" /></section>
    <div className="sessions-toolbar"><div><span className="session-eyebrow">SEASON ARCHIVE</span><h2>Lịch sử mùa giải</h2></div><button className="session-primary-button" onClick={() => openEditor()}><Plus /> Tạo mùa giải</button></div>
    <section className="sessions-stats"><StatBox icon={CalendarDays} label="Tổng mùa giải" value={summary.seasons} /></section>
    <section className="sessions-timeline"><div className="sessions-timeline-line" />{sessions.map((session) => <article className="session-card session-card-compact" key={session.session_id}><span className="session-timeline-dot" /><div className="session-emblem"><Medal /><strong>S{session.session_id}</strong></div><div className="session-card-main"><div className="session-card-title"><h2>{readTitle(session)}</h2><span className="session-status">{session.status || 'ĐÃ LƯU TRỮ'}</span></div></div><div className="session-card-actions"><button className="session-detail-button" onClick={() => setViewingSession(session)}>Xem chi tiết <ArrowRight /></button><div><button title="Sửa" onClick={() => openEditor(session)}><Pencil /></button><button title="Xóa" onClick={() => onDelete(session.session_id)}><Trash2 /></button></div></div></article>)}</section>
    {!sessions.length && <div className="session-empty-state">Chưa có mùa giải. Hãy tạo mùa giải đầu tiên.</div>}
  </>;

  return <div className="sessions-page">
    {viewingSession ? <SessionDetail session={viewingSession} players={players} nations={nations} onBack={() => setViewingSession(null)} onEdit={() => openEditor(viewingSession)} onRegister={() => setRegisteringSession(viewingSession)} onUpdateStats={updatePlayerStats} onUpdatePlayerCard={updatePlayerCard} onRemovePlayer={removePlayer} onUpdateAwards={updateAwards} onPublishAwards={updateAwardsPublication} onSaveRanking={updateRanking} onPublishRanking={updateRankingPublication} onUpdateArchive={updateArchive} onMatchChanged={(result) => { const updatedSession = result?.session || result; if (updatedSession?.session_id) setViewingSession(updatedSession); return onMatchChanged?.(result); }} onHonorChanged={(result) => { if (result?.session) setViewingSession(result.session); return onHonorChanged?.(result); }} registrationSaving={registrationSaving} saving={saving} /> : listContent}
    {editingSession !== null && <SessionEditor key={editingSession?.session_id || 'new'} session={editingSession || null} players={players} onClose={() => setEditingSession(null)} onSave={saveSession} saving={saving} />}
    {registeringSession && <RegisterPlayersModal players={players} nations={nations} registeredIds={new Set(getSeasonPlayers(registeringSession, players).map((player) => Number(player.player_id)))} onClose={() => setRegisteringSession(null)} onRegister={registerPlayers} saving={registrationSaving} />}
  </div>;
}
