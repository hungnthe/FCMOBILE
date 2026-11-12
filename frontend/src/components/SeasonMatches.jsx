import React, { useEffect, useMemo, useState } from 'react';
import {
  BellRing, CalendarDays, Check, ClipboardList, Pencil, Plus, Save, Search, Trash2, UserRound, X
} from 'lucide-react';
import { createMatch, deleteMatch, finalizeMatch, getMatches, updateMatch } from '../services/api';
import { supportsMatchResult } from '../services/seasonCapabilities';

const asset = (value) => value?.startsWith('public/') ? `/${value.slice('public/'.length)}` : value || '';
const playerImage = (player) => asset(player?.seasonCard?.imageCard || player?.currentCard?.imageCard || player?.imageCard?.[0]);
const isClubActive = (player) => player?.is_active !== false;
const today = () => new Date().toISOString().slice(0, 10);

function draftFromMatch(match, resultTrackingEnabled) {
  return {
    title: match?.title || '',
    date: match?.date || today(),
    appearances: (match?.appearances || []).map(Number),
    goals: (match?.goals || []).map((goal) => ({ scorer_id: Number(goal.scorer_id) || '', assist_id: goal.assist_id === null || goal.assist_id === undefined ? null : Number(goal.assist_id) })),
    best_player_id: match?.best_player_id === null || match?.best_player_id === undefined ? null : Number(match.best_player_id),
    opponentScore: resultTrackingEnabled && match?.score ? Number(match.score.against) : ''
  };
}

function playerName(players, playerId) {
  return players.find((player) => Number(player.player_id) === Number(playerId))?.name || `Player #${playerId}`;
}

function matchMilestonePreview(seasonPlayers, appearances, match) {
  if (match?.status === 'finalized') return [];
  return appearances.flatMap((playerId) => {
    const player = seasonPlayers.find((item) => Number(item.player_id) === Number(playerId));
    if (!isClubActive(player)) return [];
    const currentMatches = Number(player?.stats?.match) || 0;
    const milestone = currentMatches + 1;
    return milestone > 0 && milestone % 50 === 0
      ? [{ playerId: Number(playerId), playerName: player?.name || `Player #${playerId}`, milestone }]
      : [];
  });
}

function MatchEditor({ session, seasonPlayers, match, onClose, onSaveDraft, onFinalize }) {
  const resultTrackingEnabled = supportsMatchResult(session);
  const [draft, setDraft] = useState(() => draftFromMatch(match, resultTrackingEnabled));
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const activeSeasonPlayers = useMemo(() => seasonPlayers.filter(isClubActive), [seasonPlayers]);
  const activePlayerIds = useMemo(() => new Set(activeSeasonPlayers.map((player) => Number(player.player_id))), [activeSeasonPlayers]);
  const activeAppearanceIds = draft.appearances.filter((id) => activePlayerIds.has(Number(id)));

  const visiblePlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeSeasonPlayers.filter((player) => !query || String(player.name || '').toLowerCase().includes(query));
  }, [search, activeSeasonPlayers]);
  const selectedIds = new Set(draft.appearances);
  const milestonePreview = matchMilestonePreview(seasonPlayers, draft.appearances, match);

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

  const selectAll = () => setField('appearances', activeSeasonPlayers.map((player) => Number(player.player_id)));
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

  const payload = {
    session_id: Number(session.session_id),
    title: draft.title,
    date: draft.date,
    appearances: draft.appearances,
    goals: draft.goals,
    best_player_id: draft.best_player_id,
    status: match?.status || 'draft',
    ...(resultTrackingEnabled && draft.opponentScore !== '' ? { score: { against: Number(draft.opponentScore) } } : {})
  };
  const save = async (finalize = false) => {
    setError('');
    if (!draft.date) {
      setError('Vui lòng nhập ngày thi đấu.');
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
      <label>Tên / vòng đấu (không bắt buộc)<input value={draft.title} onChange={(event) => setField('title', event.target.value)} placeholder="Vòng 1" /></label>
      <label>Ngày thi đấu<input required type="date" value={draft.date} onChange={(event) => setField('date', event.target.value)} /></label>
    </div>

    <section className="match-form-section"><div className="match-section-heading"><div><span className="session-eyebrow">APPEARANCES</span><h3>Cầu thủ ra sân</h3></div><strong>{activeAppearanceIds.length}/{activeSeasonPlayers.length}</strong></div><div className="match-player-toolbar"><label className="session-search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm cầu thủ..." /></label><button type="button" className="match-inline-button" onClick={selectAll}>Chọn tất cả</button><button type="button" className="match-inline-button" onClick={clearAll}>Bỏ chọn tất cả</button></div><div className="match-player-picker">{visiblePlayers.map((player) => { const id = Number(player.player_id); return <label className={`match-player-option ${selectedIds.has(id) ? 'is-selected' : ''}`} key={id}><input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleAppearance(id)} /><span className="match-player-avatar">{playerImage(player) ? <img src={playerImage(player)} alt="" /> : <UserRound />}</span><span><strong>{player.name}</strong><small>{Array.isArray(player.position) ? player.position.join(' · ').toUpperCase() : ''}{player.seasonCard?.program?.name ? ` · ${player.seasonCard.program.name}` : ''}</small></span>{selectedIds.has(id) && <Check className="match-player-check" />}</label>; })}</div>{!visiblePlayers.length && <p className="match-empty-note">{activeSeasonPlayers.length ? 'Không tìm thấy cầu thủ đang Active.' : 'Không có cầu thủ đang Active trong mùa giải này.'}</p>}</section>

    <section className="match-form-section"><div className="match-section-heading"><div><span className="session-eyebrow">GOALS</span><h3>Bàn thắng</h3></div><strong>{draft.goals.length} bàn</strong></div><div className="match-goal-list">{draft.goals.map((goal, index) => { const inactiveGoalIds = [goal.scorer_id, goal.assist_id].filter((id) => id !== null && id !== undefined && !activePlayerIds.has(Number(id))); const goalPlayerIds = [...new Set([...activeAppearanceIds, ...inactiveGoalIds.map(Number)])]; return <div className="match-goal-row" key={`${index}-${goal.scorer_id}`}><div className="match-goal-row-heading"><strong>Bàn #{index + 1}</strong><button type="button" className="match-delete-button" onClick={() => removeGoal(index)}><Trash2 /> Xóa</button></div><label>Người ghi bàn *<select required value={goal.scorer_id} onChange={(event) => updateGoal(index, 'scorer_id', event.target.value)}><option value="">Chọn cầu thủ</option>{goalPlayerIds.map((id) => <option key={id} value={id}>{playerName(seasonPlayers, id)}{!activePlayerIds.has(id) ? ' · DeActive' : ''}</option>)}</select></label><label>Người kiến tạo<select value={goal.assist_id ?? ''} onChange={(event) => updateGoal(index, 'assist_id', event.target.value)}><option value="">Không có</option>{goalPlayerIds.filter((id) => Number(id) !== Number(goal.scorer_id)).map((id) => <option key={id} value={id}>{playerName(seasonPlayers, id)}{!activePlayerIds.has(id) ? ' · DeActive' : ''}</option>)}</select></label></div>; })}</div><button type="button" className="match-add-goal-button" onClick={addGoal}><Plus /> Thêm bàn thắng</button></section>

    {resultTrackingEnabled && <section className="match-form-section"><div className="match-section-heading"><div><span className="session-eyebrow">MATCH RESULT</span><h3>Tỷ số đối thủ</h3></div><strong>{draft.goals.length} - {draft.opponentScore === '' ? '—' : draft.opponentScore}</strong></div><label className="match-score-field">Số bàn đối thủ<input type="number" min="0" step="1" required={Boolean(match?.status === 'finalized')} value={draft.opponentScore} onChange={(event) => setField('opponentScore', event.target.value)} placeholder="Nhập số bàn" /></label><p className="match-score-note">Bàn đội mình được tính tự động từ danh sách Bàn thắng. Kết quả WIN/DRAW/LOSS sẽ do hệ thống xác định khi xác nhận.</p></section>}

    <section className="match-form-section"><div className="match-section-heading"><div><span className="session-eyebrow">BEST OF MATCH</span><h3>Cầu thủ xuất sắc nhất trận</h3></div></div><select className="match-best-player-select" value={draft.best_player_id ?? ''} onChange={(event) => setField('best_player_id', event.target.value === '' ? null : Number(event.target.value))}><option value="">Không có</option>{activeAppearanceIds.map((id) => <option key={id} value={id}>{playerName(seasonPlayers, id)}</option>)}{draft.best_player_id !== null && draft.best_player_id !== undefined && !activePlayerIds.has(Number(draft.best_player_id)) && <option value={draft.best_player_id}>{playerName(seasonPlayers, draft.best_player_id)} · DeActive</option>}</select></section>

    <section className="match-review"><div><span>Cầu thủ ra sân</span><strong>{draft.appearances.length}</strong></div><div><span>Bàn thắng</span><strong>{draft.goals.length}</strong></div><div><span>Best of Match</span><strong>{draft.best_player_id ? playerName(seasonPlayers, draft.best_player_id) : 'Không có'}</strong></div></section>
    {milestonePreview.length > 0 && <section className="match-milestone-notice" role="status"><div className="match-milestone-notice-heading"><BellRing /><div><span>CỘT MỐC SỐ TRẬN</span><strong>Được vinh danh ngay khi xác nhận trận đấu</strong></div></div><div className="match-milestone-notice-list">{milestonePreview.map((item) => <p key={item.playerId}><b>{item.playerName}</b> sẽ chạm mốc <strong>{item.milestone} trận</strong>.</p>)}</div></section>}
    {error && <p className="session-form-error">{error}</p>}
    <div className="session-editor-actions"><button type="button" className="session-secondary-button" onClick={onClose}>Hủy</button><button type="submit" className="session-secondary-button" disabled={saving}><Save /> {saving ? 'Đang lưu...' : match?.status === 'finalized' ? 'Lưu thay đổi' : 'Lưu nháp'}</button>{match?.status !== 'finalized' && <button type="button" className="session-primary-button" disabled={saving} onClick={() => save(true)}><Check /> Xác nhận kết quả</button>}</div>
  </form></div>;
}

function MatchCard({ match, seasonPlayers, onEdit, onFinalize, onDelete, actionsDisabled = false }) {
  const bestPlayer = match.best_player_id ? playerName(seasonPlayers, match.best_player_id) : '';
  const scoreLabel = match.score && Number.isInteger(Number(match.score.for)) && Number.isInteger(Number(match.score.against)) ? `${match.score.for} - ${match.score.against}` : '';
  return <article className="match-card"><div className="match-card-number">#{String(match.match_id).padStart(2, '0')}</div><div className="match-card-copy"><div className="match-card-title"><h3>{match.title || 'Trận đấu'}</h3><span className={`match-status ${match.status === 'finalized' ? 'is-finalized' : ''}`}>{match.status === 'finalized' ? 'Đã xác nhận' : 'Bản nháp'}</span>{scoreLabel && <span className={`match-result-badge ${match.result === 'LOSS' ? 'is-loss' : match.result === 'DRAW' ? 'is-draw' : ''}`}>{scoreLabel} · {match.result}</span>}</div><p><CalendarDays /> {match.date} <span>·</span> {(match.appearances || []).length} cầu thủ <span>·</span> {(match.goals || []).length} bàn{bestPlayer && <><span>·</span> Best: {bestPlayer}</>}</p></div><div className="match-card-actions">{match.status !== 'finalized' && <button type="button" className="match-finalize-button" disabled={actionsDisabled} onClick={() => onFinalize(match)}>Xác nhận kết quả</button>}<button type="button" title="Sửa" disabled={actionsDisabled} onClick={() => onEdit(match)}><Pencil /></button><button type="button" title="Xóa" disabled={actionsDisabled} onClick={() => onDelete(match)}><Trash2 /></button></div></article>;
}

export default function SeasonMatches({ session, seasonPlayers = [], onChanged }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingMatch, setEditingMatch] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState(null);

  const load = async () => {
    setLoading(true);
    try { setMatches(await getMatches(session.session_id)); setError(''); } catch (loadError) { setError(loadError.response?.data?.error || 'Không thể tải danh sách trận đấu.'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [session.session_id]);

  const sync = async (result) => {
    const changedMatch = result?.match || result;
    if (changedMatch?.match_id) setMatches((current) => current.some((item) => item.match_id === changedMatch.match_id) ? current.map((item) => item.match_id === changedMatch.match_id ? changedMatch : item) : [changedMatch, ...current]);
    if (result?.session) await onChanged?.(result);
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
  const removeAll = async () => {
    const matchesToDelete = [...matches];
    if (!matchesToDelete.length || deleteProgress) return;
    const finalizedCount = matchesToDelete.filter((match) => match.status === 'finalized').length;
    const confirmation = `Xóa tất cả ${matchesToDelete.length} trận đấu trong mùa giải này?${finalizedCount ? `\n\nThống kê đã ghi nhận từ ${finalizedCount} trận đã xác nhận sẽ được giữ lại.` : ''}`;
    if (!window.confirm(confirmation)) return;

    setError('');
    setDeleteProgress({ completed: 0, total: matchesToDelete.length });
    let latestSession = null;
    let completed = 0;
    try {
      for (const match of matchesToDelete) {
        const result = await deleteMatch(match.match_id);
        setMatches((current) => current.filter((item) => item.match_id !== match.match_id));
        if (result.session) latestSession = result.session;
        completed += 1;
        setDeleteProgress({ completed, total: matchesToDelete.length });
      }
      if (latestSession) await onChanged?.(latestSession);
      else await onChanged?.();
    } catch (deleteError) {
      await load();
      if (latestSession) await onChanged?.(latestSession);
      else await onChanged?.();
      const reason = deleteError.response?.data?.error || deleteError.message || 'Không thể xóa trận đấu.';
      setError(completed ? `Đã xóa ${completed}/${matchesToDelete.length} trận. ${reason}` : reason);
    } finally {
      setDeleteProgress(null);
    }
  };

  const activePlayerCount = seasonPlayers.filter(isClubActive).length;
  return <section className="session-detail-panel session-matches-panel"><div className="session-detail-panel-heading"><div><span className="session-eyebrow">SEASON MATCHES</span><h2>Trận đấu</h2><p className="season-ranking-subtitle">Quản lý kết quả và tự động cập nhật thống kê cầu thủ.</p></div><div className="session-detail-panel-heading-actions"><button type="button" className="session-secondary-button match-delete-all-button" onClick={removeAll} disabled={!matches.length || loading || Boolean(deleteProgress)}><Trash2 /> {deleteProgress ? `Đang xóa ${deleteProgress.completed}/${deleteProgress.total}...` : 'Xóa tất cả trận đấu'}</button><button type="button" className="session-primary-button" onClick={() => setEditingMatch(false)} disabled={!activePlayerCount || Boolean(deleteProgress)}><Plus /> Ghi nhận trận đấu</button></div></div>{error && <p className="session-form-error">{error}</p>}{loading ? <div className="session-empty-state">Đang tải trận đấu...</div> : matches.length ? <div className="match-list">{matches.map((match) => <MatchCard key={match.match_id} match={match} seasonPlayers={seasonPlayers} onEdit={setEditingMatch} onFinalize={finalizeExisting} onDelete={remove} actionsDisabled={Boolean(deleteProgress)} />)}</div> : <div className="session-empty-state match-empty-state"><ClipboardList /><h3>Chưa có trận đấu</h3><p>Ghi nhận trận đấu đầu tiên để tự động cập nhật thống kê mùa giải.</p>{activePlayerCount > 0 && <button type="button" className="session-primary-button" onClick={() => setEditingMatch(false)} disabled={Boolean(deleteProgress)}><Plus /> Ghi nhận trận đấu</button>}</div>}{editingMatch !== null && <MatchEditor key={editingMatch?.match_id || 'new'} session={session} seasonPlayers={seasonPlayers} match={editingMatch || null} onClose={() => setEditingMatch(null)} onSaveDraft={saveDraft} onFinalize={finalize} />}</section>;
}
