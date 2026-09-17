import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Check, ClipboardList, Pencil, Plus, Save, Search, Trash2, UserRound, X
} from 'lucide-react';
import { createMatch, deleteMatch, finalizeMatch, getMatches, updateMatch } from '../services/api';

const asset = (value) => value?.startsWith('public/') ? `/${value.slice('public/'.length)}` : value || '';
const playerImage = (player) => asset(player?.seasonCard?.imageCard || player?.currentCard?.imageCard || player?.imageCard?.[0]);
const today = () => new Date().toISOString().slice(0, 10);

function draftFromMatch(match) {
  return {
    title: match?.title || '',
    date: match?.date || today(),
    appearances: (match?.appearances || []).map(Number),
    goals: (match?.goals || []).map((goal) => ({ scorer_id: Number(goal.scorer_id) || '', assist_id: goal.assist_id === null || goal.assist_id === undefined ? null : Number(goal.assist_id) })),
    best_player_id: match?.best_player_id === null || match?.best_player_id === undefined ? null : Number(match.best_player_id)
  };
}

function playerName(players, playerId) {
  return players.find((player) => Number(player.player_id) === Number(playerId))?.name || `Player #${playerId}`;
}

function MatchEditor({ session, seasonPlayers, match, onClose, onSaveDraft, onFinalize }) {
  const [draft, setDraft] = useState(() => draftFromMatch(match));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return seasonPlayers.filter((player) => !query || String(player.name || '').toLowerCase().includes(query));
  }, [search, seasonPlayers]);
  const selectedIds = new Set(draft.appearances);

  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const toggleAppearance = (playerId) => {
    const id = Number(playerId);
    if (selectedIds.has(id)) {
      const usedInGoal = draft.goals.some((goal) => Number(goal.scorer_id) === id || Number(goal.assist_id) === id);
      const isBestPlayer = Number(draft.best_player_id) === id;
      if ((usedInGoal || isBestPlayer) && !window.confirm('Cầu thủ này đang được dùng trong sự kiện trận đấu. Bỏ chọn sẽ xóa các sự kiện liên quan. Tiếp tục?')) return;
      setDraft((current) => ({
        ...current,
        appearances: current.appearances.filter((item) => Number(item) !== id),
        goals: current.goals.filter((goal) => Number(goal.scorer_id) !== id && Number(goal.assist_id) !== id),
        best_player_id: Number(current.best_player_id) === id ? null : current.best_player_id
      }));
      return;
    }
    setField('appearances', [...draft.appearances, id]);
  };

  const selectAll = () => setField('appearances', seasonPlayers.map((player) => Number(player.player_id)));
  const clearAll = () => {
    if (draft.goals.length || draft.best_player_id !== null) {
      if (!window.confirm('Bỏ chọn tất cả sẽ xóa các bàn thắng và Best of Match hiện tại. Tiếp tục?')) return;
    }
    setDraft((current) => ({ ...current, appearances: [], goals: [], best_player_id: null }));
  };
  const addGoal = () => setField('goals', [...draft.goals, { scorer_id: draft.appearances[0] || '', assist_id: null }]);
  const removeGoal = (index) => setField('goals', draft.goals.filter((_, goalIndex) => goalIndex !== index));
  const updateGoal = (index, field, value) => setField('goals', draft.goals.map((goal, goalIndex) => {
    if (goalIndex !== index) return goal;
    const nextValue = value === '' ? (field === 'assist_id' ? null : '') : Number(value);
    return field === 'scorer_id' && Number(goal.assist_id) === Number(nextValue)
      ? { ...goal, scorer_id: nextValue, assist_id: null }
      : { ...goal, [field]: nextValue };
  }));

  const payload = { session_id: Number(session.session_id), ...draft, status: match?.status || 'draft' };
  const save = async (finalize = false) => {
    setError('');
    if (!draft.title.trim() || !draft.date) {
      setError('Vui lòng nhập tên/vòng đấu và ngày thi đấu.');
      return;
    }
    if (finalize && !window.confirm('Xác nhận kết quả trận đấu? Hệ thống sẽ tự động cập nhật số trận, bàn thắng, kiến tạo và Best of Match cho các cầu thủ trong mùa giải.')) return;
    setSaving(true);
    try {
      if (finalize) await onFinalize(payload);
      else await onSaveDraft(payload);
      onClose();
    } catch (saveError) {
      setError(saveError.response?.data?.error || saveError.message || 'Không thể lưu trận đấu.');
    } finally { setSaving(false); }
  };

  return <div className="session-modal-backdrop"><form className="match-editor" onSubmit={(event) => { event.preventDefault(); save(false); }}>
    <div className="session-editor-heading"><div><span className="session-eyebrow">{match ? 'EDIT MATCH' : 'NEW MATCH'}</span><h2>{match ? 'Chỉnh sửa trận đấu' : 'Ghi nhận trận đấu'}</h2><p>{session.Title || session.title} · {session.season || 'Chưa có niên khóa'}</p></div><button type="button" className="session-close-button" onClick={onClose}><X /></button></div>
    <div className="match-form-grid">
      <label>Tên / vòng đấu<input required value={draft.title} onChange={(event) => setField('title', event.target.value)} placeholder="Vòng 1" /></label>
      <label>Ngày thi đấu<input required type="date" value={draft.date} onChange={(event) => setField('date', event.target.value)} /></label>
    </div>

    <section className="match-form-section"><div className="match-section-heading"><div><span className="session-eyebrow">APPEARANCES</span><h3>Cầu thủ ra sân</h3></div><strong>{draft.appearances.length}/{seasonPlayers.length}</strong></div><div className="match-player-toolbar"><label className="session-search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm cầu thủ..." /></label><button type="button" className="match-inline-button" onClick={selectAll}>Chọn tất cả</button><button type="button" className="match-inline-button" onClick={clearAll}>Bỏ chọn tất cả</button></div><div className="match-player-picker">{visiblePlayers.map((player) => { const id = Number(player.player_id); return <label className={`match-player-option ${selectedIds.has(id) ? 'is-selected' : ''}`} key={id}><input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleAppearance(id)} /><span className="match-player-avatar">{playerImage(player) ? <img src={playerImage(player)} alt="" /> : <UserRound />}</span><span><strong>{player.name}</strong><small>{Array.isArray(player.position) ? player.position.join(' · ').toUpperCase() : ''}{player.seasonCard?.program?.name ? ` · ${player.seasonCard.program.name}` : ''}</small></span>{selectedIds.has(id) && <Check className="match-player-check" />}</label>; })}</div>{!visiblePlayers.length && <p className="match-empty-note">Không tìm thấy cầu thủ trong mùa giải.</p>}</section>

    <section className="match-form-section"><div className="match-section-heading"><div><span className="session-eyebrow">GOALS</span><h3>Bàn thắng</h3></div><strong>{draft.goals.length} bàn</strong></div><div className="match-goal-list">{draft.goals.map((goal, index) => <div className="match-goal-row" key={`${index}-${goal.scorer_id}`}><div className="match-goal-row-heading"><strong>Bàn #{index + 1}</strong><button type="button" className="match-delete-button" onClick={() => removeGoal(index)}><Trash2 /> Xóa</button></div><label>Người ghi bàn *<select required value={goal.scorer_id} onChange={(event) => updateGoal(index, 'scorer_id', event.target.value)}><option value="">Chọn cầu thủ</option>{draft.appearances.map((id) => <option key={id} value={id}>{playerName(seasonPlayers, id)}</option>)}</select></label><label>Người kiến tạo<select value={goal.assist_id ?? ''} onChange={(event) => updateGoal(index, 'assist_id', event.target.value)}><option value="">Không có</option>{draft.appearances.filter((id) => Number(id) !== Number(goal.scorer_id)).map((id) => <option key={id} value={id}>{playerName(seasonPlayers, id)}</option>)}</select></label></div>)}</div><button type="button" className="match-add-goal-button" onClick={addGoal}><Plus /> Thêm bàn thắng</button></section>

    <section className="match-form-section"><div className="match-section-heading"><div><span className="session-eyebrow">BEST OF MATCH</span><h3>Cầu thủ xuất sắc nhất trận</h3></div></div><select className="match-best-player-select" value={draft.best_player_id ?? ''} onChange={(event) => setField('best_player_id', event.target.value === '' ? null : Number(event.target.value))}><option value="">Không có</option>{draft.appearances.map((id) => <option key={id} value={id}>{playerName(seasonPlayers, id)}</option>)}</select></section>

    <section className="match-review"><div><span>Cầu thủ ra sân</span><strong>{draft.appearances.length}</strong></div><div><span>Bàn thắng</span><strong>{draft.goals.length}</strong></div><div><span>Best of Match</span><strong>{draft.best_player_id ? playerName(seasonPlayers, draft.best_player_id) : 'Không có'}</strong></div></section>
    {error && <p className="session-form-error">{error}</p>}
    <div className="session-editor-actions"><button type="button" className="session-secondary-button" onClick={onClose}>Hủy</button><button type="submit" className="session-secondary-button" disabled={saving}><Save /> {saving ? 'Đang lưu...' : match?.status === 'finalized' ? 'Lưu thay đổi' : 'Lưu nháp'}</button>{match?.status !== 'finalized' && <button type="button" className="session-primary-button" disabled={saving} onClick={() => save(true)}><Check /> Xác nhận kết quả</button>}</div>
  </form></div>;
}

function MatchCard({ match, seasonPlayers, onEdit, onFinalize, onDelete }) {
  const bestPlayer = match.best_player_id ? playerName(seasonPlayers, match.best_player_id) : '';
  return <article className="match-card"><div className="match-card-number">#{String(match.match_id).padStart(2, '0')}</div><div className="match-card-copy"><div className="match-card-title"><h3>{match.title}</h3><span className={`match-status ${match.status === 'finalized' ? 'is-finalized' : ''}`}>{match.status === 'finalized' ? 'Đã xác nhận' : 'Bản nháp'}</span></div><p><CalendarDays /> {match.date} <span>·</span> {(match.appearances || []).length} cầu thủ <span>·</span> {(match.goals || []).length} bàn{bestPlayer && <><span>·</span> Best: {bestPlayer}</>}</p></div><div className="match-card-actions">{match.status !== 'finalized' && <button type="button" className="match-finalize-button" onClick={() => onFinalize(match)}>Xác nhận kết quả</button>}<button type="button" title="Sửa" onClick={() => onEdit(match)}><Pencil /></button><button type="button" title="Xóa" onClick={() => onDelete(match)}><Trash2 /></button></div></article>;
}

export default function SeasonMatches({ session, seasonPlayers = [], onChanged }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingMatch, setEditingMatch] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setMatches(await getMatches(session.session_id)); setError(''); } catch (loadError) { setError(loadError.response?.data?.error || 'Không thể tải danh sách trận đấu.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [session.session_id]);

  const sync = async (result) => {
    const changedMatch = result?.match || result;
    if (changedMatch?.match_id) setMatches((current) => current.some((item) => item.match_id === changedMatch.match_id) ? current.map((item) => item.match_id === changedMatch.match_id ? changedMatch : item) : [changedMatch, ...current]);
    if (result?.session) await onChanged?.(result.session);
    else await onChanged?.();
  };
  const saveDraft = async (payload) => {
    const result = editingMatch ? await updateMatch(editingMatch.match_id, payload) : await createMatch(payload);
    await sync(result);
  };
  const finalize = async (payload) => {
    const saved = editingMatch ? await updateMatch(editingMatch.match_id, payload) : await createMatch(payload);
    const result = await finalizeMatch(saved.match_id);
    await sync(result);
  };
  const finalizeExisting = async (match) => {
    if (!window.confirm('Xác nhận kết quả trận đấu? Thống kê mùa giải sẽ được cập nhật tự động.')) return;
    try { await sync(await finalizeMatch(match.match_id)); } catch (finalizeError) { setError(finalizeError.response?.data?.error || 'Không thể xác nhận trận đấu.'); }
  };
  const remove = async (match) => {
    if (!window.confirm(`Xóa ${match.title}? Trận đấu sẽ bị xóa khỏi danh sách nhưng toàn bộ thống kê đã ghi nhận vẫn được giữ lại.`)) return;
    try { const result = await deleteMatch(match.match_id); setMatches((current) => current.filter((item) => item.match_id !== match.match_id)); if (result.session) await onChanged?.(result.session); else await onChanged?.(); } catch (deleteError) { setError(deleteError.response?.data?.error || 'Không thể xóa trận đấu.'); }
  };

  return <section className="session-detail-panel session-matches-panel"><div className="session-detail-panel-heading"><div><span className="session-eyebrow">SEASON MATCHES</span><h2>Trận đấu</h2><p className="season-ranking-subtitle">Quản lý kết quả và tự động cập nhật thống kê cầu thủ.</p></div><button type="button" className="session-primary-button" onClick={() => setEditingMatch(false)} disabled={!seasonPlayers.length}><Plus /> Ghi nhận trận đấu</button></div>{error && <p className="session-form-error">{error}</p>}{loading ? <div className="session-empty-state">Đang tải trận đấu...</div> : matches.length ? <div className="match-list">{matches.map((match) => <MatchCard key={match.match_id} match={match} seasonPlayers={seasonPlayers} onEdit={setEditingMatch} onFinalize={finalizeExisting} onDelete={remove} />)}</div> : <div className="session-empty-state match-empty-state"><ClipboardList /><h3>Chưa có trận đấu</h3><p>Ghi nhận trận đấu đầu tiên để tự động cập nhật thống kê mùa giải.</p>{seasonPlayers.length > 0 && <button type="button" className="session-primary-button" onClick={() => setEditingMatch(false)}><Plus /> Ghi nhận trận đấu</button>}</div>}{editingMatch !== null && <MatchEditor key={editingMatch?.match_id || 'new'} session={session} seasonPlayers={seasonPlayers} match={editingMatch || null} onClose={() => setEditingMatch(null)} onSaveDraft={saveDraft} onFinalize={finalize} />}</section>;
}
