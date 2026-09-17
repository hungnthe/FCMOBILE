import React, { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, Plus, Save, Trash2, UserRound, X, Check } from 'lucide-react';
import { createPlayerCard, deletePlayerCard, setCurrentPlayerCard, updatePlayerCard, uploadImageCard } from '../services/api';

const emptyPlayer = {
  name: '', ovr: 75, number: 0, nation: null, program: [], position: [], Status_I_H_M: 'Matching',
  stats: { goalAmounts: 0, assistAmounts: 0, match: 0, bestPlayerAmount: 0, sessionAmount: 0 },
  active: { HTH: [], lastWeekCup: 0 }, imageCard: [], metadata: { note: '', imageCard: [] }
};

const fallbackNations = [
  { nation_id: 1, name: 'Pháp', code: 'FR', flag_url: 'https://flagcdn.com/w160/fr.png' },
  { nation_id: 2, name: 'Hàn Quốc', code: 'KR', flag_url: 'https://flagcdn.com/w160/kr.png' },
  { nation_id: 4, name: 'Slovakia', code: 'SK', flag_url: 'https://flagcdn.com/w160/sk.png' },
  { nation_id: 5, name: 'Đức', code: 'DE', flag_url: 'https://flagcdn.com/w160/de.png' }
];

const fallbackImageCards = [
  'public/ImageCard/Bale_256_fc_25_download.png', 'public/ImageCard/Castagne_256_fc_25_download.png',
  'public/ImageCard/Ham_k_256_fc_25_download.png', 'public/ImageCard/Hincapi_256_fc_25_download.png',
  'public/ImageCard/mbappe-card.png', 'public/ImageCard/Rice_256_fc_25_download.png',
  'public/ImageCard/Saliba_256_fc_25_download.png', 'public/ImageCard/Schmeichel_256_fc_25_download.png',
  'public/ImageCard/Schweinsteiger_256_fc_25_download (3).png', 'public/ImageCard/Son_256_fc_25_download.png',
  'public/ImageCard/Tah_256_fc_25_download.png'
];

function toDraft(player) {
  return {
    ...emptyPlayer, ...player,
    program: Array.isArray(player?.program) ? player.program : player?.program ? [player.program] : [],
    position: Array.isArray(player?.position) ? player.position : player?.position ? [player.position] : [],
    stats: { ...emptyPlayer.stats, ...(player?.stats || {}) },
    active: { ...emptyPlayer.active, ...(player?.active || {}) },
    metadata: { ...emptyPlayer.metadata, ...(player?.metadata || {}) }
  };
}

function publicAssetUrl(value) {
  if (!value) return '';
  return value.startsWith('public/') ? `/${value.slice('public/'.length)}` : value;
}

function nationIdOf(value, nations = []) {
  if (value && typeof value === 'object') return value.nation_id || value.id || '';
  return nations.find((nation) => String(nation.name).toLowerCase() === String(value || '').toLowerCase())?.nation_id || '';
}

function nationNameOf(value, nations = []) {
  if (value && typeof value === 'object') return nations.find((nation) => Number(nation.nation_id) === Number(value.nation_id))?.name || value.name || `Nation #${value.nation_id}`;
  return value || '';
}

function hthValueOf(value) {
  return value && typeof value === 'object' ? value.value || '' : value || '';
}

function seasonHthValue(player, session) {
  const seasonEntry = (player?.active?.HTH || []).find((entry) => (
    entry && typeof entry === 'object' && Number(entry.session_id) === Number(session.session_id)
  ));
  return hthValueOf(seasonEntry) || String(session.Archive || '').trim() || '—';
}

function NumberTile({ label, value, accent = '' }) {
  return <label className={`detail-stat-tile ${accent}`}><span>{label}</span><input type="number" min="0" value={value ?? 0} readOnly aria-label={`${label} tổng sự nghiệp`} /></label>;
}

function cardImage(card) { return publicAssetUrl(card?.imageCard || card?.imageCardUrl); }

export default function PlayerDetail({ player, nations = [], imageCards: imageCardOptions = [], sessions = [], programs = [], onBack, onSave, onCardsChanged, saving = false }) {
  const [draft, setDraft] = useState(() => toDraft(player));
  const [availableImageCards, setAvailableImageCards] = useState(() => [...new Set([...(imageCardOptions || []), ...fallbackImageCards])]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [cardEditor, setCardEditor] = useState(null);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState('');
  const isNew = !player?.player_id && !player?.id;
  const currentCard = player?.currentCard || player?.cards?.find((card) => Number(card.player_card_id) === Number(player.current_card_id)) || null;
  const cards = player?.cards || [];

  useEffect(() => setDraft(toDraft(player)), [player]);
  useEffect(() => {
    if (imageCardOptions.length) setAvailableImageCards((current) => [...new Set([...imageCardOptions, ...current])]);
  }, [imageCardOptions]);

  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setStat = (key, value) => setDraft((current) => ({ ...current, stats: { ...current.stats, [key]: value } }));
  const setActive = (key, value) => setDraft((current) => ({ ...current, active: { ...current.active, [key]: value } }));
  const setPositionValue = (index, value) => setDraft((current) => {
    const position = [...(current.position || [])];
    position[index] = value;
    return { ...current, position };
  });
  const addPositionValue = () => setDraft((current) => ({ ...current, position: [...(current.position || []), ''] }));
  const setHthValue = (index, value) => setDraft((current) => {
    const HTH = [...(current.active?.HTH || [])];
    HTH[index] = HTH[index] && typeof HTH[index] === 'object' ? { ...HTH[index], value } : value;
    return { ...current, active: { ...current.active, HTH } };
  });
  const addHthValue = () => setDraft((current) => ({ ...current, active: { ...current.active, HTH: [...(current.active?.HTH || []), ''] } }));
  const addImageCard = (source) => {
    if (!source) return;
    setDraft((current) => ({ ...current, imageCard: [...new Set([...(current.imageCard || []), source])] }));
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    setImageUploadError('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const result = await uploadImageCard(formData);
      addImageCard(result.path);
      setAvailableImageCards((current) => [...new Set([...current, result.path])]);
    } catch (error) {
      setImageUploadError(error.response?.data?.error || 'Không thể thêm ảnh mới.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      name: draft.name,
      nation: draft.nation,
      ...(isNew ? { position: String(Array.isArray(draft.position) ? draft.position.join(',') : draft.position || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) } : {}),
      number: Number(draft.number) || 0,
      stats: Object.fromEntries(Object.entries(draft.stats).map(([key, value]) => [key, Number(value) || 0])),
      active: { ...draft.active, HTH: Array.isArray(draft.active?.HTH) ? draft.active.HTH.filter((value) => hthValueOf(value)) : [], lastWeekCup: Number(draft.active.lastWeekCup) || 0 },
      metadata: { ...draft.metadata, note: draft.metadata?.note || '', imageCard: Array.isArray(draft.metadata?.imageCard) ? draft.metadata.imageCard : [] }
    };
    if (isNew) payload.card = {
      program_id: Number(draft.program_id) || undefined,
      program: Array.isArray(draft.program) ? draft.program[0] : draft.program,
      ovr: Number(draft.ovr) || 0,
      position: String(Array.isArray(draft.position) ? draft.position.join(',') : draft.position || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean),
      Status_I_H_M: draft.Status_I_H_M,
      imageCard: imageCards[0] || ''
    };
    await onSave(payload);
  };

  const openCardEditor = (card = null) => {
    setCardError('');
    setCardEditor(card ? { ...card, position: card.position || [] } : { program_id: programs[0]?.program_id || '', ovr: currentCard?.ovr || draft.ovr || 0, position: currentCard?.position || draft.position || [], Status_I_H_M: currentCard?.Status_I_H_M || 'Matching', imageCard: currentCard?.imageCard || '', set_current: true });
  };
  const saveCard = async (event) => {
    event.preventDefault();
    setCardSaving(true); setCardError('');
    try {
      const payload = { ...cardEditor, player_id: player.player_id, program_id: Number(cardEditor.program_id), ovr: Number(cardEditor.ovr) || 0, position: (cardEditor.position || []).filter(Boolean).map((item) => String(item).toLowerCase()), imageCard: cardEditor.imageCard || '' };
      if (cardEditor.player_card_id) await updatePlayerCard(cardEditor.player_card_id, payload); else await createPlayerCard(payload);
      setCardEditor(null);
      await onCardsChanged?.();
    } catch (error) { setCardError(error.response?.data?.error || 'Không thể lưu phiên bản thẻ.'); } finally { setCardSaving(false); }
  };
  const makeCurrent = async (card) => { try { await setCurrentPlayerCard(card.player_card_id); await onCardsChanged?.(); } catch (error) { setCardError(error.response?.data?.error || 'Không thể đặt thẻ hiện tại.'); } };
  const removeCard = async (card) => { if (!window.confirm(`Xóa phiên bản thẻ của ${draft.name}?`)) return; try { await deletePlayerCard(card.player_card_id); await onCardsChanged?.(); } catch (error) { setCardError(error.response?.data?.error || 'Không thể xóa phiên bản thẻ.'); } };

  const imageCards = (Array.isArray(draft.imageCard) && draft.imageCard.length ? draft.imageCard : draft.metadata?.imageCard || []).filter(Boolean);
  const image = cardImage(currentCard) || publicAssetUrl(imageCards[0] || draft.metadata?.imageCard?.[0] || draft.metadata?.image);
  const nationList = nations.length ? nations : fallbackNations;
  const selectedNationId = nationIdOf(draft.nation, nationList);
  const selectedNationName = nationNameOf(draft.nation, nationList);
  const selectedNation = nationList.find((nation) => Number(nation.nation_id) === Number(selectedNationId));
  const programValue = Array.isArray(draft.program) ? draft.program.join(', ') : draft.program || '';
  const statusOptions = [...new Set([draft.Status_I_H_M, 'Matching', 'Icon', 'Hero'].filter((status) => status && !['gold', 'legend'].includes(String(status).toLowerCase())))];
  const seasonHistory = sessions.map((session) => {
    const playerMatch = (session.player_match || []).find((item) => (
      Number(item.player_id) === Number(player?.player_id)
      || String(item.objectId || '') === String(player?.objectId || '')
    ));
    return playerMatch ? { session, stats: playerMatch.stats || {} } : null;
  }).filter(Boolean);

  return <div className="player-detail-page">
    <button className="detail-back-button" onClick={onBack}><ArrowLeft /> Back to players</button>
    <form onSubmit={handleSubmit}>
      <div className="detail-heading"><div><span className="detail-eyebrow">{isNew ? 'CREATE PLAYER' : 'PLAYER DETAIL'}</span><h1>{draft.name || 'New player'}</h1></div><button className="detail-save-button" disabled={saving}><Save />{saving ? 'Saving...' : isNew ? 'Create player' : 'Save changes'}</button></div>
      <div className="detail-layout">
        <section className="detail-profile-card"><div className="detail-player-image">{image ? <img src={image} alt={draft.name} /> : <UserRound />}</div><div className="detail-nation-block"><span>Nation</span><div className="detail-nation-value">{selectedNation?.flag_url ? <img className="detail-nation-flag" src={selectedNation.flag_url} alt={selectedNationName} /> : <span className="detail-nation-flag-placeholder">—</span>}<strong>{selectedNationName || 'Unknown nation'}</strong></div></div><h2>{draft.name}</h2><p>{selectedNationName || 'Unknown nation'}</p><span className="status-pill">{draft.Status_I_H_M}</span></section>
        <section className="detail-panel"><h2>Player information</h2><div className="detail-fields">
          <label>Name<input required readOnly={!isNew} value={draft.name} onChange={(event) => setField('name', event.target.value)} /></label>
          {isNew && <label>Nation<select required value={selectedNationId} onChange={(event) => setField('nation', event.target.value ? { nation_id: Number(event.target.value) } : null)}><option value="">Select nation</option>{nationList.map((nation) => <option key={nation.nation_id} value={nation.nation_id}>{nation.name}</option>)}</select></label>}
          <label>Program{isNew ? <select required value={draft.program_id || ''} onChange={(event) => { const selected = programs.find((program) => Number(program.program_id) === Number(event.target.value)); setDraft((current) => ({ ...current, program_id: event.target.value, program: selected ? [selected.name] : [] })); }}><option value="">Select program</option>{programs.map((program) => <option key={program.program_id} value={program.program_id}>{program.display_name || program.name}</option>)}</select> : <input readOnly value={currentCard?.program?.name || programValue} />}</label>
          <label>Position<div className="position-editor">{(draft.position?.length ? draft.position : ['']).map((value, index) => <input key={index} required={isNew && index === 0} className="position-square" readOnly={!isNew} maxLength="5" value={isNew ? value : (currentCard?.position?.[index] || '')} onChange={(event) => setPositionValue(index, event.target.value)} />)}{isNew && <button type="button" className="position-add-button" onClick={addPositionValue}>+ Add</button>}</div></label>
          <label>OVR<input readOnly={!isNew} type="number" min="0" value={currentCard?.ovr ?? draft.ovr} onChange={(event) => setField('ovr', event.target.value)} /></label>
          <label>Number<input type="number" min="0" value={draft.number} onChange={(event) => setField('number', event.target.value)} /></label>
          <label>Status<select disabled={!isNew} value={currentCard?.Status_I_H_M || draft.Status_I_H_M} onChange={(event) => setField('Status_I_H_M', event.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
        </div></section>
      </div>
      <section className="detail-panel detail-stats-panel"><div className="detail-section-heading"><div><span className="detail-eyebrow detail-section-eyebrow">CAREER STATS</span><h2>Thống kê sự nghiệp</h2></div><span className="detail-hint">Tự động tổng hợp từ các mùa giải</span></div><div className="detail-stats-grid"><NumberTile label="OVR" value={currentCard?.ovr ?? draft.ovr} accent="is-red" /><NumberTile label="GOALS" value={draft.stats.goalAmounts} /><NumberTile label="ASSISTS" value={draft.stats.assistAmounts} /><NumberTile label="MATCHES" value={draft.stats.match} /><NumberTile label="BEST PLAYER" value={draft.stats.bestPlayerAmount} /><NumberTile label="SESSION" value={draft.stats.sessionAmount} /></div></section>
      <section className="detail-panel detail-archive-panel"><div className="detail-archive-heading"><span className="detail-eyebrow detail-section-eyebrow">ARCHIVE</span><button type="button" className="archive-new-button" onClick={addHthValue}>New</button></div><div className="detail-secondary-grid"><label>HTH values<div className="archive-value-editor">{(draft.active?.HTH?.length ? draft.active.HTH : ['']).map((value, index) => <input key={index} className="archive-value-square archive-hth-square" maxLength="5" value={hthValueOf(value)} onChange={(event) => setHthValue(index, event.target.value)} />)}</div></label><label>Last Week Cup<div className="archive-single-value"><input className="archive-value-square archive-cup-square" type="number" min="0" value={draft.active?.lastWeekCup ?? 0} onChange={(event) => setActive('lastWeekCup', event.target.value)} /></div></label></div></section>
      <section className="detail-panel detail-image-panel"><div className="detail-image-heading"><h2>Image cards</h2></div><div className="detail-image-actions"><label className="image-card-select"><span>Chọn ảnh trong public/ImageCard</span><select value="" onChange={(event) => addImageCard(event.target.value)}><option value="">Select image card</option>{availableImageCards.map((source) => <option key={source} value={source}>{source.split('/').pop()}</option>)}</select></label><label className="archive-new-button image-upload-button">{uploadingImage ? 'Uploading...' : 'Lấy mới'}<input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} /></label></div>{imageUploadError && <p className="image-upload-error">{imageUploadError}</p>}<div className="detail-image-cards">{imageCards.length ? imageCards.map((source, index) => <div className="detail-image-card-frame" key={`${source}-${index}`}><img src={publicAssetUrl(source)} alt={`${draft.name} card ${index + 1}`} /></div>) : <div className="detail-image-card-empty">No image card</div>}</div></section>
      {!isNew && <section className="detail-panel player-card-variants-panel"><div className="detail-section-heading"><div><span className="detail-eyebrow detail-section-eyebrow">PLAYER CARDS</span><h2>Các phiên bản thẻ</h2></div><button type="button" className="session-primary-button" onClick={() => openCardEditor()}><Plus /> Thêm phiên bản thẻ</button></div>{cardError && <p className="image-upload-error">{cardError}</p>}{cards.length ? <div className="player-card-variants-grid">{cards.map((card) => <article className={`player-card-variant ${Number(card.player_card_id) === Number(player.current_card_id) ? 'is-current' : ''}`} key={card.player_card_id}><div className="player-card-variant-image">{cardImage(card) ? <img src={cardImage(card)} alt="" /> : <UserRound />}</div><div className="player-card-variant-copy"><strong>{card.program?.display_name || card.program?.name || `Program #${card.program_id}`}</strong><span>OVR {card.ovr} · {(card.position || []).join(', ').toUpperCase()}</span><small>Dạng thẻ: {card.Status_I_H_M || 'Matching'}</small></div><div className="player-card-variant-actions">{Number(card.player_card_id) !== Number(player.current_card_id) && <button type="button" onClick={() => makeCurrent(card)}>Dùng thẻ này</button>}<button type="button" title="Sửa" onClick={() => openCardEditor(card)}><Pencil /></button>{Number(card.player_card_id) !== Number(player.current_card_id) && <button type="button" title="Xóa" onClick={() => removeCard(card)}><Trash2 /></button>}</div></article>)}</div> : <p className="player-season-history-empty">Chưa có phiên bản thẻ.</p>}</section>}
      {!isNew && <section className="detail-panel player-season-history"><div className="detail-section-heading"><div><span className="detail-eyebrow detail-section-eyebrow">SEASON HISTORY</span><h2>Lịch sử mùa giải</h2></div></div>{seasonHistory.length ? <div className="player-season-history-list">{seasonHistory.map(({ session, stats }) => <div className="player-season-history-row" key={session.session_id}><div><strong>{session.Title || session.title || `Mùa giải ${session.session_id}`}</strong><span>{session.season || 'Chưa có niên khóa'}</span></div><strong>{stats.matches || 0} trận</strong><strong>{stats.goals || 0} bàn</strong><strong>{stats.assists || 0} kiến tạo</strong><strong>{stats.bestPlayer || 0} MVP</strong><strong>{seasonHthValue(player, session)} danh hiệu</strong></div>)}</div> : <p className="player-season-history-empty">Cầu thủ chưa được đăng ký ở mùa giải nào.</p>}</section>}
    </form>
    {cardEditor && <div className="session-modal-backdrop"><form className="player-card-editor" onSubmit={saveCard}><div className="session-editor-heading"><div><span className="session-eyebrow">PLAYER CARD</span><h2>{cardEditor.player_card_id ? 'Sửa phiên bản thẻ' : 'Thêm phiên bản thẻ'}</h2></div><button type="button" className="session-close-button" onClick={() => setCardEditor(null)}><X /></button></div><div className="program-form-grid"><label>Program<select required value={cardEditor.program_id || ''} onChange={(event) => setCardEditor((current) => ({ ...current, program_id: event.target.value }))}><option value="">Chọn program</option>{programs.map((program) => <option key={program.program_id} value={program.program_id}>{program.display_name || program.name}</option>)}</select></label><label>OVR<input required type="number" min="0" value={cardEditor.ovr ?? 0} onChange={(event) => setCardEditor((current) => ({ ...current, ovr: event.target.value }))} /></label><label>Trạng thái<select value={cardEditor.Status_I_H_M || 'Matching'} onChange={(event) => setCardEditor((current) => ({ ...current, Status_I_H_M: event.target.value }))}><option>Matching</option><option>Icon</option><option>Hero</option></select></label><label>Vị trí<div className="position-editor">{(cardEditor.position?.length ? cardEditor.position : ['']).map((value, index) => <input className="position-square" maxLength="5" key={index} value={value} onChange={(event) => setCardEditor((current) => { const position = [...(current.position || [''])]; position[index] = event.target.value; return { ...current, position }; })} />)}<button type="button" className="position-add-button" onClick={() => setCardEditor((current) => ({ ...current, position: [...(current.position || []), ''] }))}>+ Add</button></div></label><label className="program-form-wide">Ảnh card<select value={cardEditor.imageCard || ''} onChange={(event) => setCardEditor((current) => ({ ...current, imageCard: event.target.value }))}><option value="">Chọn ảnh trong public/ImageCard</option>{availableImageCards.map((source) => <option key={source} value={source}>{source.split('/').pop()}</option>)}</select></label></div>{cardError && <p className="image-upload-error">{cardError}</p>}<div className="session-editor-actions"><button type="button" className="session-secondary-button" onClick={() => setCardEditor(null)}>Hủy</button><button className="session-primary-button" disabled={cardSaving}><Save /> {cardSaving ? 'Đang lưu...' : 'Lưu card'}</button></div></form></div>}
  </div>;
}
