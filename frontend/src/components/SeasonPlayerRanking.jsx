import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Save, Trophy, UserRound } from 'lucide-react';
import { getSeasonPlayerList, MAX_SEASON_RANKING_PLAYERS } from '../services/seasonRanking';

const asset = (value) => value?.startsWith('public/') ? `/${value.slice(7)}` : value || '';
const cardImage = (entry) => asset(entry.playerCard?.imageCard || entry.player?.currentCard?.imageCard || entry.player?.imageCard?.[0]);
const metric = (entry, key) => entry.seasonStats?.[key] || 0;
const positionText = (entry) => {
  const positions = entry.playerCard?.position || entry.player.position || [];
  return (Array.isArray(positions) ? positions : [positions]).filter(Boolean).join(' · ').toUpperCase();
};

function RankingCard({ entry }) {
  const image = cardImage(entry);
  const positions = positionText(entry);
  return <article className={`season-ranking-top-card rank-${entry.rank}`}>
    <span className="season-ranking-medal">{entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}</span>
    <div className="season-ranking-card-image">{image ? <img src={image} alt="" /> : <UserRound />}</div>
    <strong>{entry.player.name}</strong>
    <small>{positions}{positions && ' · '}OVR {entry.playerCard?.ovr ?? entry.player.ovr ?? 0}</small>
    <b>Hạng {entry.rank}</b>
  </article>;
}

export default function SeasonPlayerRanking({ session, players = [], onSave, onPublish }) {
  const playerCards = useMemo(() => players.flatMap((player) => player.cards || []), [players]);
  const resolvedPlayers = useMemo(() => getSeasonPlayerList(session, players, playerCards), [session, players, playerCards]);
  const eligiblePlayers = useMemo(() => resolvedPlayers.filter((entry) => metric(entry, 'matches') > 0), [resolvedPlayers]);
  const savedOrder = useMemo(() => (Array.isArray(session?.player_ranking) ? session.player_ranking : [])
    .map(Number)
    .filter((id, index, list) => list.indexOf(id) === index)
    .slice(0, MAX_SEASON_RANKING_PLAYERS), [session?.player_ranking]);
  const [draftOrder, setDraftOrder] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const eligibleIds = new Set(eligiblePlayers.map((entry) => Number(entry.player.player_id)));
    setDraftOrder(savedOrder.filter((id) => eligibleIds.has(id)));
  }, [eligiblePlayers, savedOrder]);

  const orderedPlayers = useMemo(() => {
    const byId = new Map(eligiblePlayers.map((entry) => [Number(entry.player.player_id), entry]));
    return draftOrder.map((id) => byId.get(Number(id))).filter(Boolean).map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [draftOrder, eligiblePlayers]);

  const isDirty = draftOrder.join(',') !== savedOrder.join(',');
  const canSave = draftOrder.length === MAX_SEASON_RANKING_PLAYERS;
  const selectedIds = new Set(draftOrder);
  const togglePlayer = (playerId) => setDraftOrder((current) => {
    const id = Number(playerId);
    if (current.includes(id)) return current.filter((item) => item !== id);
    if (current.length >= MAX_SEASON_RANKING_PLAYERS) return current;
    return [...current, id];
  });
  const move = (index, direction) => setDraftOrder((current) => {
    const target = index + direction;
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const save = async () => {
    if (!onSave || !isDirty) return;
    setSaving(true);
    try { await onSave(draftOrder); } finally { setSaving(false); }
  };
  const published = session.player_ranking_published !== false;
  const publish = async () => { if (onPublish) await onPublish(true); };

  return <section className="session-detail-panel season-ranking-panel">
    <div className="session-detail-panel-heading">
      <div><span className="session-eyebrow">SEASON LEADERBOARD</span><h2>Bảng xếp hạng cầu thủ</h2><p className="season-ranking-subtitle">Chọn 14 cầu thủ đã thi đấu trong mùa giải để tự xếp hạng</p></div>
      <div className="season-ranking-heading-actions"><span className={`season-publication-status ${published ? 'is-published' : ''}`}>{published ? 'Đã công bố' : 'Chưa công bố'}</span><span>{draftOrder.length}/{MAX_SEASON_RANKING_PLAYERS} cầu thủ</span><button type="button" className="session-primary-button" disabled={!isDirty || !canSave || saving} onClick={save}><Save /> {saving ? 'Đang lưu...' : 'Lưu thứ hạng'}</button>{!published && <button type="button" className="session-primary-button" disabled={!canSave || isDirty || saving} onClick={publish}>Công bố bảng xếp hạng</button>}</div>
    </div>
    {!eligiblePlayers.length ? <div className="season-ranking-empty"><Trophy /><h3>Chưa có cầu thủ thi đấu</h3><p>Danh sách xếp hạng sẽ lấy từ các cầu thủ đã thi đấu trong mùa giải.</p></div> : <>
      <div className="season-ranking-selection"><div className="season-ranking-selection-heading"><div><strong>Chọn cầu thủ xếp hạng</strong><p>Chỉ những cầu thủ có số trận trong mùa giải mới được chọn.</p></div><b>{draftOrder.length}/{MAX_SEASON_RANKING_PLAYERS}</b></div><div className="season-ranking-selection-list">{eligiblePlayers.map((entry) => { const id = Number(entry.player.player_id); const image = cardImage(entry); const selected = selectedIds.has(id); return <label className={`season-ranking-selection-row${selected ? ' is-selected' : ''}`} key={id}><input type="checkbox" checked={selected} disabled={!selected && draftOrder.length >= MAX_SEASON_RANKING_PLAYERS} onChange={() => togglePlayer(id)} /><span className="season-ranking-avatar">{image ? <img src={image} alt="" /> : <UserRound />}</span><span><strong>{entry.player.name}</strong><small>{metric(entry, 'matches')} trận{positionText(entry) && ` · ${positionText(entry)}`}</small></span></label>; })}</div></div>
      {orderedPlayers.length ? <><p className="season-ranking-help">Dùng nút mũi tên để tự sắp xếp thứ hạng. Thứ tự được lưu riêng trong mùa giải.</p><div className="season-ranking-top-three">{orderedPlayers.slice(0, 3).map((entry) => <RankingCard entry={entry} key={entry.player.player_id} />)}</div><div className="season-ranking-table-wrap"><table className="season-ranking-table"><thead><tr><th>#</th><th>Cầu thủ</th><th>Đổi hạng</th></tr></thead><tbody>{orderedPlayers.map((entry, index) => { const image = cardImage(entry); const positions = positionText(entry); return <tr key={entry.player.player_id}><td><span className="season-ranking-rank">{entry.rank}</span></td><td><div className="season-ranking-player"><span className="season-ranking-avatar">{image ? <img src={image} alt="" /> : <UserRound />}</span><span><strong>{entry.player.name}</strong><small>{entry.playerCard?.program?.name || entry.playerCard?.program?.display_name || ''}{positions && ` · ${positions}`} {entry.playerCard?.ovr ? `· OVR ${entry.playerCard.ovr}` : ''}</small></span></div></td><td><div className="season-ranking-move-actions"><button type="button" aria-label={`Đưa ${entry.player.name} lên một hạng`} title="Lên một hạng" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></button><button type="button" aria-label={`Đưa ${entry.player.name} xuống một hạng`} title="Xuống một hạng" disabled={index === orderedPlayers.length - 1} onClick={() => move(index, 1)}><ArrowDown /></button></div></td></tr>; })}</tbody></table></div></> : <div className="season-ranking-empty"><Trophy /><h3>Chưa chọn cầu thủ xếp hạng</h3><p>Hãy chọn đủ 14 cầu thủ ở danh sách trên.</p></div>}
    </>}
  </section>;
}
