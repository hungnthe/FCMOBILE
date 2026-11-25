import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Crown, History, Pencil, Plus, Save, Sparkles, Trash2, Trophy, UserRound, X } from 'lucide-react';
import { createPlayerCard, deletePlayerCard, getLegends, getRecords, recordImageUrl, setCurrentPlayerCard, updatePlayer, updatePlayerCard, uploadImageCard } from '../services/api';
import { supportsMatchResult } from '../services/seasonCapabilities';
import { AwardDetailModal } from './RankJourney';
import { getPlayerRecordStatus } from '../services/recordClassification';
import OvrEditor from './OvrEditor';
import PositionEditor from './PositionEditor';

const INDIVIDUAL_AWARD_DEFS = [
  { key: 'golden_ball', title: 'Quả bóng vàng', icon: '🏆' },
  { key: 'silver_ball', title: 'Quả bóng bạc', icon: '🥈' },
  { key: 'bronze_ball', title: 'Quả bóng đồng', icon: '🥉' },
  { key: 'top_scorer', title: 'Vua phá lưới', icon: '⚽' },
  { key: 'top_assist', title: 'Vua kiến tạo', icon: '🎯' },
  { key: 'best_transfer', title: 'Bản hợp đồng xuất sắc nhất', icon: '💛' },
  { key: 'best_goal', title: 'Bàn thắng đẹp nhất', icon: '🎬' }
];

export const RANK_CONFIG = {
  young_talent: { name: 'Tài năng trẻ', icon: '🌱', badgeClass: 'rank-badge-young_talent' },
  professional: { name: 'Chuyên nghiệp', icon: '⚔️', badgeClass: 'rank-badge-professional' },
  world_class: { name: 'World Class', icon: '🏆', badgeClass: 'rank-badge-world_class' },
  legend: { name: 'Huyền thoại', icon: '👑', badgeClass: 'rank-badge-legend' }
};

export function getRankMeta(code) {
  return RANK_CONFIG[code] || { name: code || 'Tài năng trẻ', icon: '🌱', badgeClass: 'rank-badge-young_talent' };
}

const emptyPlayer = {
  name: '', ovr: 75, number: 0, nation: null, program: [], position: [], Status_I_H_M: 'Matching',
  rank: '',
  stats: { goalAmounts: 0, assistAmounts: 0, match: 0, bestPlayerAmount: 0, sessionAmount: 0 },
  is_active: true, active: { HTH: [], lastWeekCup: 0 }, imageCard: [], metadata: { note: '', imageCard: [] }
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

function ovrImagesOf(card) {
  return card?.ovr_images ?? { [card?.ovr ?? emptyPlayer.ovr]: (Array.isArray(card?.imageCard) ? card.imageCard[0] : card?.imageCard) || '' };
}

function ovrProgramsOf(card) {
  const id = card?.program_id || card?.program?.program_id;
  return card?.ovr_programs ?? (id ? { [card.ovr]: id } : {});
}

function ovrPositionsOf(card) {
  const positions = Array.isArray(card?.position) ? card.position : card?.position ? [card.position] : [];
  return card?.ovr_positions ?? { [card?.ovr ?? emptyPlayer.ovr]: positions };
}

function setOvrPositions(setter, positions) {
  setter((current) => ({ ...current, ovr_positions: { ...current.ovr_positions, [current.ovr]: positions } }));
}

function setOvrProgram(setter, value) {
  setter((current) => {
    const ovr_programs = { ...current.ovr_programs };
    if (value) ovr_programs[current.ovr] = Number(value);
    else delete ovr_programs[current.ovr];
    return { ...current, ovr_programs };
  });
}

function toDraft(player) {
  const isExisting = Boolean(player?.player_id || player?.id);
  return {
    ...emptyPlayer, ...player,
    rank: player?.rank || (isExisting ? 'young_talent' : ''),
    ovr: player?.currentCard?.ovr ?? player?.ovr ?? emptyPlayer.ovr,
    ovr_options: player?.currentCard?.ovr_options ?? player?.ovr_options ?? [player?.currentCard?.ovr ?? player?.ovr ?? emptyPlayer.ovr],
    ovr_images: ovrImagesOf(player?.currentCard || player),
    ovr_programs: ovrProgramsOf(player?.currentCard || player),
    ovr_positions: ovrPositionsOf(player?.currentCard || player),
    is_active: player?.is_active !== false,
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

function NumberTile({ label, value, accent = '', onChange, placeholder, required = false }) {
  return <label className={`detail-stat-tile ${accent}`}><span>{label}</span><input type="number" min="0" step="1"
    value={value ?? ''} placeholder={placeholder} required={required} readOnly={!onChange}
    onChange={onChange && ((event) => onChange(event.target.value))} aria-label={`${label} tổng sự nghiệp`} /></label>;
}

function cardImage(card) { return publicAssetUrl(card?.imageCard || card?.imageCardUrl); }

export default function PlayerDetail({ player, nations = [], imageCards: imageCardOptions = [], sessions = [], programs = [], onBack, onSave, onNavigateToRecord, onCardsChanged, saving = false }) {
  const [draft, setDraft] = useState(() => toDraft(player));
  const [editedStats, setEditedStats] = useState({});
  const [availableImageCards, setAvailableImageCards] = useState(() => [...new Set([...(imageCardOptions || []), ...fallbackImageCards])]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const [cardEditor, setCardEditor] = useState(null);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardError, setCardError] = useState('');
  const isNew = !player?.player_id && !player?.id;
  const currentCard = player?.currentCard || player?.cards?.find((card) => Number(card.player_card_id) === Number(player.current_card_id)) || null;
  const cards = player?.cards || [];

  useEffect(() => {
    setDraft(toDraft(player));
    setEditedStats({});
  }, [player]);
  useEffect(() => {
    if (imageCardOptions.length) setAvailableImageCards((current) => [...new Set([...imageCardOptions, ...current])]);
  }, [imageCardOptions]);

  const setField = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setActive = (key, value) => setDraft((current) => ({ ...current, active: { ...current.active, [key]: value } }));
  const setHthValue = (index, value) => setDraft((current) => {
    const HTH = [...(current.active?.HTH || [])];
    HTH[index] = HTH[index] && typeof HTH[index] === 'object' ? { ...HTH[index], value } : value;
    return { ...current, active: { ...current.active, HTH } };
  });
  const addHthValue = () => setDraft((current) => ({ ...current, active: { ...current.active, HTH: [...(current.active?.HTH || []), ''] } }));
  const addImageCard = (source) => {
    if (!source) return;
    setDraft((current) => ({ ...current, imageCard: [...new Set([...(current.imageCard || []), source])], ovr_images: { ...current.ovr_images, [current.ovr]: source } }));
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
    if (isNew) {
      if (!draft.rank || !['young_talent', 'professional'].includes(draft.rank)) {
        alert('Vui lòng chọn bậc cầu thủ: Chỉ được phép chọn Chuyên nghiệp hoặc Tài năng trẻ.');
        return;
      }
    }
    const payload = {
      name: draft.name,
      nation: draft.nation,
      ...(isNew ? {
        rank: draft.rank,
        position: (draft.ovr_positions[draft.ovr] || []).map((item) => item.trim().toLowerCase()).filter(Boolean)
      } : {}),
      number: Number(draft.number) || 0,
      is_active: draft.is_active !== false,
      active: { ...draft.active, HTH: Array.isArray(draft.active?.HTH) ? draft.active.HTH.filter((value) => hthValueOf(value)) : [], lastWeekCup: Number(draft.active.lastWeekCup) || 0 },
      imageCard: imageCards,
      metadata: { ...draft.metadata, note: draft.metadata?.note || '', imageCard: Array.isArray(draft.metadata?.imageCard) ? draft.metadata.imageCard : [] }
    };
    if (isNew) payload.stats = draft.stats;
    if (isNew) payload.card = {
      program_id: Number(draft.ovr_programs[draft.ovr]) || undefined,
      ovr: Number(draft.ovr) || 0,
      ovr_options: draft.ovr_options.map(Number),
      ovr_images: draft.ovr_images,
      ovr_programs: draft.ovr_programs,
      ovr_positions: draft.ovr_positions,
      position: (draft.ovr_positions[draft.ovr] || []).map((item) => item.trim().toLowerCase()).filter(Boolean),
      Status_I_H_M: draft.Status_I_H_M,
      imageCard: draft.ovr_images[draft.ovr] || ''
    };
    if (!isNew) {
      const edits = {};
      for (const [key, value] of Object.entries(editedStats)) {
        if (value === '') continue;
        const previous = player.stats?.[key] ?? null;
        if (Number(value) !== previous) edits[key] = { previous, value: Number(value) };
      }
      if (Object.keys(edits).length) payload.careerStatEdits = edits;
      const ovrUpdate = { ovr: Number(draft.ovr), ovr_options: draft.ovr_options.map(Number), ovr_images: draft.ovr_images, ovr_programs: draft.ovr_programs, ovr_positions: draft.ovr_positions };
      if (currentCard) payload.card = ovrUpdate;
      else Object.assign(payload, ovrUpdate, { imageCard: draft.ovr_images[draft.ovr] ? [draft.ovr_images[draft.ovr]] : [] });
    }
    await onSave(payload);
  };

  const openCardEditor = (card = null) => {
    setCardError('');
    setCardEditor(card ? { ...card, ovr_options: card.ovr_options || [card.ovr], ovr_images: ovrImagesOf(card), ovr_programs: ovrProgramsOf(card), ovr_positions: ovrPositionsOf(card) } : { ovr: draft.ovr, ovr_options: [...draft.ovr_options], ovr_images: { ...draft.ovr_images }, ovr_programs: { ...draft.ovr_programs }, ovr_positions: { ...draft.ovr_positions }, Status_I_H_M: currentCard?.Status_I_H_M || 'Matching', set_current: true });
  };
  const saveCard = async (event) => {
    event.preventDefault();
    setCardSaving(true); setCardError('');
    try {
      const payload = { ...cardEditor, player_id: player.player_id, program_id: Number(cardEditor.ovr_programs[cardEditor.ovr]), ovr: Number(cardEditor.ovr), ovr_options: cardEditor.ovr_options.map(Number), position: (cardEditor.ovr_positions[cardEditor.ovr] || []).map((item) => item.trim().toLowerCase()).filter(Boolean), imageCard: cardEditor.ovr_images[cardEditor.ovr] || '' };
      if (cardEditor.player_card_id) await updatePlayerCard(cardEditor.player_card_id, payload); else await createPlayerCard(payload);
      const imageCardGallery = [...new Set([...imageCards, ...Object.values(cardEditor.ovr_images || {})].filter(Boolean))];
      if (imageCardGallery.some((image) => !imageCards.includes(image))) await updatePlayer(player.player_id, { imageCard: imageCardGallery });
      setCardEditor(null);
      await onCardsChanged?.();
    } catch (error) { setCardError(error.response?.data?.error || 'Không thể lưu phiên bản thẻ.'); } finally { setCardSaving(false); }
  };
  const makeCurrent = async (card) => { try { await setCurrentPlayerCard(card.player_card_id); await onCardsChanged?.(); } catch (error) { setCardError(error.response?.data?.error || 'Không thể đặt thẻ hiện tại.'); } };
  const removeCard = async (card) => { if (!window.confirm(`Xóa phiên bản thẻ của ${draft.name}?`)) return; try { await deletePlayerCard(card.player_card_id); await onCardsChanged?.(); } catch (error) { setCardError(error.response?.data?.error || 'Không thể xóa phiên bản thẻ.'); } };

  const imageCards = [...new Set([
    ...(Array.isArray(draft.imageCard) ? draft.imageCard : []),
    ...(Array.isArray(draft.metadata?.imageCard) ? draft.metadata.imageCard : []),
    ...Object.values(draft.ovr_images || {})
  ].filter(Boolean))];
  const image = publicAssetUrl(draft.ovr_images[draft.ovr] || '');
  const nationList = nations.length ? nations : fallbackNations;
  const selectedNationId = nationIdOf(draft.nation, nationList);
  const selectedNationName = nationNameOf(draft.nation, nationList);
  const selectedNation = nationList.find((nation) => Number(nation.nation_id) === Number(selectedNationId));
  const statusOptions = [...new Set([draft.Status_I_H_M, 'Matching', 'Icon', 'Hero'].filter((status) => status && !['gold', 'legend'].includes(String(status).toLowerCase())))];
  const seasonHistory = sessions.map((session) => {
    const playerMatch = (session.player_match || []).find((item) => (
      Number(item.player_id) === Number(player?.player_id)
      || String(item.objectId || '') === String(player?.objectId || '')
    ));
    return playerMatch ? { session, stats: playerMatch.stats || {} } : null;
  }).filter(Boolean);
  const showResults = seasonHistory.some(({ session }) => supportsMatchResult(session));
  const careerFields = [
    ['goalAmounts', 'BÀN THẮNG'], ['assistAmounts', 'KIẾN TẠO'], ['match', 'TRẬN ĐẤU'],
    ['bestPlayerAmount', 'MVP'], ['sessionAmount', 'MÙA GIẢI'],
    ...(player?.tracksDefensiveStats ? [['goalsAgainst', 'BÀN THUA'], ['cleanSheets', 'GIỮ SẠCH LƯỚI']] : []),
    ...(showResults ? [['wins', 'THẮNG'], ['draws', 'HÒA'], ['losses', 'THUA']] : [])
  ];

  const currentRankCode = draft.rank || player?.rank || (isNew ? '' : 'young_talent');
  const currentRankMeta = getRankMeta(currentRankCode);

  const [allRecords, setAllRecords] = useState([]);
  useEffect(() => {
    let mounted = true;
    getRecords().then((items) => {
      if (mounted && Array.isArray(items)) setAllRecords(items);
    }).catch((err) => {
      console.error('Không thể tải kỷ lục:', err);
    });
    return () => { mounted = false; };
  }, []);

  const handleRecordNavigate = (recordId) => {
    if (onNavigateToRecord) {
      onNavigateToRecord(recordId);
    } else {
      window.dispatchEvent(
        new CustomEvent('navigate-to-record', {
          detail: { recordId }
        })
      );
    }
  };

  const playerRecords = useMemo(() => {
    if (!player || isNew || !Array.isArray(allRecords) || allRecords.length === 0) return [];
    const list = [];
    allRecords.forEach((rec) => {
      const status = getPlayerRecordStatus(rec, player);
      if (status) {
        list.push({
          ...rec,
          ...status
        });
      }
    });
    return list;
  }, [allRecords, player, isNew]);

  const [legendsData, setLegendsData] = useState([]);
  const [awardModalOpen, setAwardModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    getLegends().then((data) => {
      if (mounted && Array.isArray(data?.legends)) setLegendsData(data.legends);
    }).catch((err) => {
      console.error('Không thể tải danh hiệu cá nhân:', err);
    });
    return () => { mounted = false; };
  }, []);

  const currentLegend = useMemo(() => {
    if (!player) return null;
    const targetId = Number(player.player_id);
    const targetName = String(player.name || '').trim().toLowerCase();
    return (legendsData || []).find((leg) => {
      const legId = Number(leg.player_id);
      const legName = String(leg.player?.name || '').trim().toLowerCase();
      return (targetId && legId === targetId) || (targetName && legName === targetName);
    }) || null;
  }, [legendsData, player]);

  const legendBreakdown = useMemo(() => {
    if (!currentLegend?.awards) return [];
    return INDIVIDUAL_AWARD_DEFS.map((def) => ({
      ...def,
      count: Number(currentLegend.awards[def.key] || 0)
    })).filter((item) => item.count > 0);
  }, [currentLegend]);

  return <div className="player-detail-page">
    <button className="detail-back-button" onClick={onBack}><ArrowLeft /> Quay lại danh sách</button>
    <form onSubmit={handleSubmit}>
      <div className="detail-heading"><div><span className="detail-eyebrow">{isNew ? 'TẠO CẦU THỦ MỚI' : 'CHI TIẾT CẦU THỦ'}</span><h1>{draft.name || 'Cầu thủ mới'}</h1></div><button className="detail-save-button" disabled={saving}><Save />{saving ? 'Đang lưu...' : isNew ? 'Tạo cầu thủ' : 'Lưu thay đổi'}</button></div>
      <div className="detail-layout">
        <section className="detail-profile-card">
          <div className="detail-player-image">{image ? <img src={image} alt={draft.name} /> : <UserRound />}</div>
          <div className="detail-nation-block">
            <span>QUỐC GIA</span>
            <div className="detail-nation-value">
              {selectedNation?.flag_url ? <img className="detail-nation-flag" src={selectedNation.flag_url} alt={selectedNationName} /> : <span className="detail-nation-flag-placeholder">—</span>}
              <strong>{selectedNationName || 'Chưa rõ'}</strong>
            </div>
          </div>
          <h2>{draft.name}</h2>
          <p>{selectedNationName || 'Chưa rõ'}</p>
          <div className="detail-badges-row">
            <span className="status-pill">{draft.Status_I_H_M}</span>
            {currentRankCode && (
              <span className={`detail-rank-badge ${currentRankMeta.badgeClass}`}>
                <span className="detail-rank-icon">{currentRankMeta.icon}</span>
                <span>{currentRankMeta.name}</span>
              </span>
            )}
          </div>
        </section>
        <section className="detail-panel detail-info-panel"><h2>Thông tin cầu thủ</h2><div className="detail-fields detail-information-grid">
          <div className="detail-form-column">
            <label>Tên cầu thủ<input required readOnly={!isNew} value={draft.name} onChange={(event) => setField('name', event.target.value)} /></label>
            {isNew && <label>Quốc gia<select required value={selectedNationId} onChange={(event) => setField('nation', event.target.value ? { nation_id: Number(event.target.value) } : null)}><option value="">-- Chọn quốc gia --</option>{nationList.map((nation) => <option key={nation.nation_id} value={nation.nation_id}>{nation.name}</option>)}</select></label>}
            
            {/* Rank Field: Mandatory on new player, only young_talent or professional */}
            {isNew ? (
              <label>Bậc khởi đầu <span style={{ color: '#dc2626' }}>*</span>
                <select
                  required
                  value={draft.rank || ''}
                  onChange={(event) => setField('rank', event.target.value)}
                >
                  <option value="">-- Chọn bậc cầu thủ (Bắt buộc) --</option>
                  <option value="young_talent">🌱 Tài năng trẻ</option>
                  <option value="professional">⚔️ Chuyên nghiệp</option>
                </select>
              </label>
            ) : (
              <label>Bậc hiện tại
                <div className={`detail-rank-pill-box ${currentRankMeta.badgeClass}`}>
                  <span className="detail-rank-icon">{currentRankMeta.icon}</span>
                  <strong>{currentRankMeta.name}</strong>
                </div>
              </label>
            )}

            <div className="detail-compact-fields">
              <label>Số áo<input type="number" min="0" value={draft.number} onChange={(event) => setField('number', event.target.value)} /></label>
              <label>Trạng thái CLB<select value={draft.is_active ? 'active' : 'inactive'} onChange={(event) => setField('is_active', event.target.value === 'active')}><option value="active">Active</option><option value="inactive">DeActive</option></select></label>
            </div>
            <label>Dạng thẻ<select disabled={!isNew} value={currentCard?.Status_I_H_M || draft.Status_I_H_M} onChange={(event) => setField('Status_I_H_M', event.target.value)}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <PositionEditor ovr={draft.ovr} positions={draft.ovr_positions[draft.ovr] || []} onChange={(positions) => setOvrPositions(setDraft, positions)} />
          </div>
          <div className="detail-form-column">
            <label>Chương trình (Program)<select required value={draft.ovr_programs[draft.ovr] || ''} onChange={(event) => setOvrProgram(setDraft, event.target.value)}><option value="">Chọn Program cho OVR {draft.ovr}</option>{programs.map((program) => <option key={program.program_id} value={program.program_id}>{program.display_name || program.name}</option>)}</select></label>
            <OvrEditor value={draft.ovr} options={draft.ovr_options} images={draft.ovr_images} ovrPrograms={draft.ovr_programs} ovrPositions={draft.ovr_positions} imageOptions={availableImageCards} onChange={(update) => setDraft((current) => ({ ...current, ...update }))} />
          </div>
        </div></section>
      </div>
      <section className="detail-panel detail-stats-panel">
        <div className="detail-section-heading"><div><span className="detail-eyebrow detail-section-eyebrow">THỐNG KÊ SỰ NGHIỆP</span></div>
          <span className="detail-hint">{isNew ? 'Tự động tổng hợp từ các mùa giải' : 'Sửa tổng tại đây rồi chọn "Lưu thay đổi". Các trận sau tiếp tục được cộng dồn.'}</span>
        </div>
        <div className={`detail-stats-grid ${showResults ? 'has-match-results' : ''}`}>
          <NumberTile label="OVR" value={draft.ovr} accent="is-red" />
          {careerFields.map(([key, label]) => <NumberTile key={key} label={label} value={editedStats[key] ?? draft.stats[key]}
            placeholder={['goalsAgainst', 'cleanSheets'].includes(key) && draft.stats.match ? '—' : '0'}
            required={!isNew && draft.stats[key] != null}
            onChange={isNew ? undefined : (value) => setEditedStats((current) => ({ ...current, [key]: value }))} />)}
        </div>
      </section>
      <div className="detail-honours-row">
        <section className="detail-panel detail-archive-panel">
          <div className="detail-archive-heading">
            <span className="detail-eyebrow detail-section-eyebrow">DANH HIỆU & ARCHIVE</span>
            <button type="button" className="archive-new-button" onClick={addHthValue}>+ Thêm</button>
          </div>
          <div className="detail-secondary-grid">
            <label>Mốc sao HTH (HTH values)
              <div className="archive-value-editor">
                {(draft.active?.HTH?.length ? draft.active.HTH : ['']).map((value, index) => (
                  <input key={index} className="archive-value-square archive-hth-square" maxLength="5" value={hthValueOf(value)} onChange={(event) => setHthValue(index, event.target.value)} />
                ))}
              </div>
            </label>
            <label>Cúp tuần (Last Week Cup)
              <div className="archive-single-value">
                <input className="archive-value-square archive-cup-square" type="number" min="0" value={draft.active?.lastWeekCup ?? 0} onChange={(event) => setActive('lastWeekCup', event.target.value)} />
              </div>
            </label>
          </div>
        </section>

        {!isNew && (
          <section className="detail-panel detail-personal-honours-panel">
            <div className="detail-archive-heading">
              <span className="detail-eyebrow detail-section-eyebrow">DANH HIỆU CÁ NHÂN</span>
            </div>

            <div className="detail-personal-honours-body">
              <div
                className={`detail-personal-honours-card ${currentLegend?.totalAwards > 0 ? 'is-clickable' : ''}`}
                onClick={() => currentLegend?.totalAwards > 0 && setAwardModalOpen(true)}
                role={currentLegend?.totalAwards > 0 ? 'button' : undefined}
                tabIndex={currentLegend?.totalAwards > 0 ? 0 : undefined}
              >
                <div className="legend-player-avatar">
                  {image ? <img src={image} alt={draft.name} /> : <UserRound />}
                </div>
                <div className="legend-card-copy">
                  <strong>{draft.name}</strong>
                  <span>
                    {currentCard?.program?.display_name || currentCard?.program?.name || draft.program?.[0] || 'Cầu thủ Ajax'} · OVR {draft.ovr || '—'}
                  </span>
                  <div className="legend-award-breakdown">
                    {legendBreakdown.length > 0 ? (
                      legendBreakdown.map(({ key, title, icon, count }) => (
                        <span key={key} title={title}>
                          <i>{icon}</i>{count} <small>{title}</small>
                        </span>
                      ))
                    ) : (
                      <span className="legend-award-empty">Chưa có danh hiệu cá nhân</span>
                    )}
                  </div>
                </div>
                <div className="legend-card-total">
                  <b className={currentLegend?.totalAwards > 0 ? 'has-awards' : 'no-awards'}>
                    {currentLegend?.totalAwards || 0}
                  </b>
                  <small>Danh hiệu</small>
                </div>
                {currentLegend?.totalAwards > 0 && <ChevronRight className="legend-card-chevron" />}
              </div>
            </div>
          </section>
        )}
      </div>
      {!isNew && (
        <section className="detail-panel player-records-panel">
          <div className="detail-section-heading">
            <div>
              <span className="detail-eyebrow detail-section-eyebrow">KỶ LỤC & DANH HIỆU CÁ NHÂN</span>
            </div>
            {playerRecords.length > 0 && (
              <span className="player-record-count-badge">{playerRecords.length} kỷ lục</span>
            )}
          </div>
          {playerRecords.length > 0 ? (
            <div className="player-records-grid">
              {playerRecords.map((record) => (
                <article
                  className={`player-record-tile is-clickable is-${record.type}`}
                  key={record.record_id}
                  title={`Nhấn để chuyển sang chi tiết kỷ lục: ${record.name}`}
                  onClick={() => handleRecordNavigate(record.record_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRecordNavigate(record.record_id);
                    }
                  }}
                >
                  {record.award_name && (
                    <div className="player-record-tab">
                      {record.award_name}
                    </div>
                  )}

                  <div className={`player-record-status-badge is-${record.type}`}>
                    {record.type === 'achieved' ? (
                      <>
                        <Sparkles className="player-record-status-icon text-amber-500 fill-amber-400" />
                        <span>{record.label || 'Đã giành được'}</span>
                      </>
                    ) : record.type === 'current' ? (
                      <>
                        <Crown className="player-record-status-icon text-amber-500 fill-amber-400" />
                        <span>{record.label || 'Đang nắm giữ'}</span>
                      </>
                    ) : (
                      <>
                        <History className="player-record-status-icon text-amber-700" />
                        <span>{record.label || 'Đã từng nắm giữ'}</span>
                      </>
                    )}
                  </div>

                  <div className="player-record-cover">
                    {record.image ? (
                      <img src={recordImageUrl(record.image)} alt={record.name} />
                    ) : (
                      <Trophy className="player-record-trophy-icon" />
                    )}
                  </div>

                  <div className="player-record-info">
                    <span className="player-record-name">{record.name}</span>
                    <button
                      type="button"
                      className="player-record-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecordNavigate(record.record_id);
                      }}
                      title="Chuyển sang chi tiết kỷ lục"
                    >
                      <span>Chi tiết kỷ lục</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="player-season-history-empty">Cầu thủ chưa nắm giữ kỷ lục hoặc danh hiệu cá nhân nào.</p>
          )}
        </section>
      )}
      <section className="detail-panel detail-image-panel"><div className="detail-image-heading"><h2>Kho ảnh thẻ</h2></div><div className="detail-image-actions"><label className="image-card-select"><span>Chọn ảnh cho OVR {draft.ovr}</span><select value="" onChange={(event) => addImageCard(event.target.value)}><option value="">-- Chọn ảnh thẻ --</option>{availableImageCards.map((source) => <option key={source} value={source}>{source.split('/').pop()}</option>)}</select></label><label className="archive-new-button image-upload-button">{uploadingImage ? 'Đang tải...' : 'Tải ảnh mới'}<input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingImage} /></label></div>{imageUploadError && <p className="image-upload-error">{imageUploadError}</p>}<div className="detail-image-cards">{imageCards.length ? imageCards.map((source, index) => <div className="detail-image-card-frame" key={`${source}-${index}`}><img src={publicAssetUrl(source)} alt={`${draft.name} card ${index + 1}`} /></div>) : <div className="detail-image-card-empty">Chưa có ảnh thẻ</div>}</div></section>
      {!isNew && <section className="detail-panel player-card-variants-panel"><div className="detail-section-heading"><div><span className="detail-eyebrow detail-section-eyebrow">PHIÊN BẢN THẺ</span></div><button type="button" className="session-primary-button" onClick={() => openCardEditor()}><Plus /> Thêm phiên bản thẻ</button></div>{cardError && <p className="image-upload-error">{cardError}</p>}{cards.length ? <div className="player-card-variants-grid">{cards.map((card) => <article className={`player-card-variant ${Number(card.player_card_id) === Number(player.current_card_id) ? 'is-current' : ''}`} key={card.player_card_id}><div className="player-card-variant-image">{cardImage(card) ? <img src={cardImage(card)} alt="" /> : <UserRound />}</div><div className="player-card-variant-copy"><strong>{card.program?.display_name || card.program?.name || `Program #${card.program_id}`}</strong><span>OVR {card.ovr} · {(card.position || []).join(', ').toUpperCase()}</span><small>Dạng thẻ: {card.Status_I_H_M || 'Matching'}</small></div><div className="player-card-variant-actions">{Number(card.player_card_id) !== Number(player.current_card_id) && <button type="button" onClick={() => makeCurrent(card)}>Dùng thẻ này</button>}<button type="button" title="Sửa" onClick={() => openCardEditor(card)}><Pencil /></button>{Number(card.player_card_id) !== Number(player.current_card_id) && <button type="button" title="Xóa" onClick={() => removeCard(card)}><Trash2 /></button>}</div></article>)}</div> : <p className="player-season-history-empty">Chưa có phiên bản thẻ.</p>}</section>}
      {!isNew && <section className="detail-panel player-season-history"><div className="detail-section-heading"><div><span className="detail-eyebrow detail-section-eyebrow">LỊCH SỬ MÙA GIẢI</span></div></div>{seasonHistory.length ? <div className="player-season-history-list">{seasonHistory.map(({ session, stats }) => <div className={`player-season-history-row ${supportsMatchResult(session) ? 'has-match-results' : ''}`} key={session.session_id}><div><strong>{session.Title || session.title || `Mùa giải ${session.session_id}`}</strong><span>{session.season || 'Chưa có niên khóa'}</span></div><strong>{stats.matches || 0} trận</strong><strong>{stats.goals || 0} bàn</strong><strong>{stats.assists || 0} kiến tạo</strong><strong>{stats.bestPlayer || 0} MVP</strong>{supportsMatchResult(session) && <><strong>{stats.wins || 0} W</strong><strong>{stats.draws || 0} D</strong><strong>{stats.losses || 0} L</strong></>}<strong>{seasonHthValue(player, session)} danh hiệu</strong></div>)}</div> : <p className="player-season-history-empty">Cầu thủ chưa được đăng ký ở mùa giải nào.</p>}</section>}
    </form>
    {cardEditor && <div className="session-modal-backdrop"><form className="player-card-editor" onSubmit={saveCard}><div className="session-editor-heading"><div><span className="session-eyebrow">PHIÊN BẢN THẺ</span><h2>{cardEditor.player_card_id ? 'Sửa phiên bản thẻ' : 'Thêm phiên bản thẻ'}</h2></div><button type="button" className="session-close-button" onClick={() => setCardEditor(null)}><X /></button></div><div className="program-form-grid"><label>Chương trình (Program)<select required value={cardEditor.ovr_programs[cardEditor.ovr] || ''} onChange={(event) => setOvrProgram(setCardEditor, event.target.value)}><option value="">Chọn Program cho OVR {cardEditor.ovr}</option>{programs.map((program) => <option key={program.program_id} value={program.program_id}>{program.display_name || program.name}</option>)}</select></label><OvrEditor value={cardEditor.ovr} options={cardEditor.ovr_options} images={cardEditor.ovr_images} ovrPrograms={cardEditor.ovr_programs} ovrPositions={cardEditor.ovr_positions} imageOptions={availableImageCards} onChange={(update) => setCardEditor((current) => ({ ...current, ...update }))} /><label>Dạng thẻ<select value={cardEditor.Status_I_H_M || 'Matching'} onChange={(event) => setCardEditor((current) => ({ ...current, Status_I_H_M: event.target.value }))}><option>Matching</option><option>Icon</option><option>Hero</option></select></label><PositionEditor ovr={cardEditor.ovr} positions={cardEditor.ovr_positions[cardEditor.ovr] || []} onChange={(positions) => setOvrPositions(setCardEditor, positions)} /></div>{cardError && <p className="image-upload-error">{cardError}</p>}<div className="session-editor-actions"><button type="button" className="session-secondary-button" onClick={() => setCardEditor(null)}>Hủy</button><button className="session-primary-button" disabled={cardSaving}><Save /> {cardSaving ? 'Đang lưu...' : 'Lưu thẻ'}</button></div></form></div>}
    {awardModalOpen && currentLegend && (
      <AwardDetailModal
        awardModal={{ playerLegend: currentLegend }}
        sessions={sessions}
        onClose={() => setAwardModalOpen(false)}
      />
    )}
  </div>;
}
