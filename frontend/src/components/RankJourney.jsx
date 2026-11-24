import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  LockKeyhole,
  Medal,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  CheckCircle2,
  Circle,
  Target,
  Sparkles,
  Trophy,
  Calendar,
  Lock,
  Edit3,
  Award,
  Filter,
  ArrowRight,
  Check,
  ArrowUpDown,
  Clapperboard,
  Crown,
  X
} from 'lucide-react';
import api, { getPlayers, getLegends, getSessions, getRecords } from '../services/api';
import PlayerCardArtwork from './PlayerCardArtwork';

// Rank metadata definition
const RANK_META = {
  young_talent: {
    code: 'young_talent',
    name: 'Tài năng trẻ',
    order: 1,
    color: '#0284c7',
    badgeClass: 'rank-badge-young-talent',
    icon: Sparkles,
    desc: 'Giai đoạn khởi đầu · Ươm mầm tiềm năng và tích lũy số trận'
  },
  professional: {
    code: 'professional',
    name: 'Chuyên nghiệp',
    order: 2,
    color: '#6366f1',
    badgeClass: 'rank-badge-professional',
    icon: Target,
    desc: 'Trụ cột câu lạc bộ · Thi đấu thường xuyên với phong độ ổn định'
  },
  world_class: {
    code: 'world_class',
    name: 'World Class',
    order: 3,
    color: '#d97706',
    badgeClass: 'rank-badge-world-class',
    icon: Trophy,
    desc: 'Đẳng cấp thế giới · Những ngôi sao hàng đầu tạo đột biến trận đấu'
  },
  legend: {
    code: 'legend',
    name: 'Huyền thoại',
    order: 4,
    color: '#dc2626',
    badgeClass: 'rank-badge-legend',
    icon: Medal,
    desc: 'Đỉnh cao danh dự · Tượng đài bất tử ghi danh vào lịch sử câu lạc bộ'
  }
};

const normalize = (value) =>
  String(value || '')
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

const headers = (key) => ({ headers: { 'X-Rank-Admin-Key': key } });

const errorMessage = (err) =>
  err.response?.data?.error || 'Không thể kết nối máy chủ. Vui lòng thử lại.';

const formatDateTime = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(value);
  }
};

const publicAssetUrl = (value) => {
  if (!value) return '';
  const source = Array.isArray(value) ? value[0] : value;
  const str = String(source).trim();
  if (!str) return '';
  if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:')) {
    return str;
  }
  if (str.startsWith('public/')) {
    return `/${str.slice(7)}`;
  }
  return str.startsWith('/') ? str : `/${str}`;
};

/**
 * Resolves player card details from profile & raw player
 * Strict matching: uses current_card_id and currentCard object
 */
function resolveCardInfo(player, profile) {
  const merged = profile || player || {};
  const currentCard = merged.currentCard || null;
  const cards = merged.cards || [];

  // Exact card artwork from currentCard or base player image
  const imageCard = currentCard?.imageCard || merged.imageCard?.[0] || player?.imageCard?.[0] || '';

  // Season name
  const seasonName =
    currentCard?.program?.name ||
    (Array.isArray(merged.program) ? merged.program[0] : merged.program) ||
    (Array.isArray(player?.program) ? player?.program[0] : player?.program) ||
    '—';

  // OVR
  const ovr = currentCard?.ovr ?? merged.ovr ?? player?.ovr ?? '—';

  // Position
  const positions = currentCard?.position || merged.position || player?.position || [];
  const positionsText = Array.isArray(positions)
    ? positions.join(' · ').toUpperCase()
    : String(positions || '—').toUpperCase();

  // Active status
  const isActive = (merged.is_active ?? player?.is_active ?? true) !== false;

  // Stats
  const stats = merged.stats || player?.stats || {};

  return {
    cardId: merged.current_card_id || currentCard?.player_card_id || null,
    imageCard,
    seasonName,
    ovr,
    positionsText,
    isActive,
    stats,
    allCards: cards
  };
}

/**
 * Rank Badge Component
 */
function RankBadge({ code, name, size = 'normal', showIcon = true }) {
  const meta = RANK_META[code] || {
    name: name || code,
    badgeClass: 'rank-badge-default',
    icon: Medal
  };
  const Icon = meta.icon;

  return (
    <span className={`rank-badge ${meta.badgeClass} is-${size}`}>
      {showIcon && <Icon className="rank-badge-icon" aria-hidden="true" />}
      <span className="rank-badge-text">{name || meta.name}</span>
    </span>
  );
}

/**
 * Modal to add/edit missions for upcoming stages
 */
function MissionEditor({ item, stage, statNames, adminKey, onClose, onSaved }) {
  const [missions, setMissions] = useState(() =>
    stage.missions.map(({ complete, progress, ...m }) => m)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const change = (index, patch) =>
    setMissions((list) =>
      list.map((m, i) => (i === index ? { ...m, ...patch } : m))
    );

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const result = await api.put(
        `/rank-journey/players/${item.player.player_id}/stages/${stage.code}/missions`,
        { missions },
        headers(adminKey)
      );
      onSaved(result.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="session-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section
        className="rank-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rank-editor-title"
      >
        <div className="rank-modal-heading">
          <div>
            <span className="session-eyebrow">MISSION EDITOR</span>
            <h2 id="rank-editor-title">Nhiệm vụ lên {stage.name}</h2>
            <p>Cầu thủ: <strong>{item.player.name}</strong></p>
          </div>
          <button
            type="button"
            className="session-close-button"
            onClick={onClose}
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <form onSubmit={save}>
          <div className="rank-editor-list">
            {missions.map((m, i) => (
              <article className="rank-mission-editor" key={m.id || `new-${i}`}>
                <div className="rank-editor-title">
                  <strong>Nhiệm vụ {i + 1}</strong>
                  <button
                    type="button"
                    aria-label={`Xóa nhiệm vụ ${i + 1}`}
                    onClick={() =>
                      setMissions((list) => list.filter((_, n) => n !== i))
                    }
                  >
                    <Trash2 />
                  </button>
                </div>

                <label>
                  Tên nhiệm vụ
                  <input
                    value={m.name}
                    maxLength={200}
                    required
                    placeholder="Ví dụ: Thi đấu 15 trận cho câu lạc bộ"
                    onChange={(e) => change(i, { name: e.target.value })}
                  />
                </label>

                <label>
                  Mô tả chi tiết (tùy chọn)
                  <textarea
                    value={m.description || ''}
                    maxLength={1000}
                    rows={2}
                    placeholder="Chi tiết yêu cầu hoặc ghi chú..."
                    onChange={(e) => change(i, { description: e.target.value })}
                  />
                </label>

                <label>
                  Loại xác nhận
                  <select
                    value={m.type}
                    onChange={(e) =>
                      change(i, {
                        type: e.target.value,
                        stat: m.stat || 'match',
                        scope: m.scope || 'career',
                        target: m.target || 1
                      })
                    }
                  >
                    <option value="manual">Quản trị viên xác nhận thủ công</option>
                    <option value="stat">Tự tính tự động từ thống kê</option>
                  </select>
                </label>

                {m.type === 'stat' && (
                  <div className="rank-editor-fields">
                    <label>
                      Chỉ số
                      <select
                        value={m.stat || 'match'}
                        onChange={(e) => change(i, { stat: e.target.value })}
                      >
                        {Object.entries(statNames).map(([key, name]) => (
                          <option value={key} key={key}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Phạm vi
                      <select
                        value={m.scope || 'career'}
                        onChange={(e) => change(i, { scope: e.target.value })}
                      >
                        <option value="career">Toàn bộ sự nghiệp</option>
                        <option value="stage">Tính từ đầu chặng này</option>
                      </select>
                    </label>
                    <label>
                      Chỉ tiêu
                      <input
                        type="number"
                        min="1"
                        step="1"
                        required
                        value={m.target || 1}
                        onChange={(e) => change(i, { target: e.target.value })}
                      />
                    </label>
                  </div>
                )}
              </article>
            ))}
          </div>

          <button
            type="button"
            className="session-secondary-button rank-add-mission-btn"
            onClick={() =>
              setMissions((list) => [
                ...list,
                { name: '', description: '', type: 'manual' }
              ])
            }
          >
            <Plus /> Thêm nhiệm vụ
          </button>

          <p className="rank-hint">
            Lưu ý: Nhiệm vụ là tùy chọn. Quản trị viên có thể trao bậc cho cầu thủ bất cứ khi nào thấy xứng đáng.
          </p>

          {error && (
            <p className="record-error" role="alert">
              {error}
            </p>
          )}

          <div className="rank-modal-actions">
            <button
              type="button"
              className="session-secondary-button"
              onClick={onClose}
              disabled={saving}
            >
              Hủy
            </button>
            <button className="session-primary-button" disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu nhiệm vụ'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * 4-Stage Compact Roadmap
 */
function Roadmap({ stages = [], currentRankCode }) {
  const stageSteps = [
    { code: 'young_talent', order: 1, label: 'Tài năng trẻ' },
    { code: 'professional', order: 2, label: 'Chuyên nghiệp' },
    { code: 'world_class', order: 3, label: 'World Class' },
    { code: 'legend', order: 4, label: 'Huyền thoại' }
  ];

  return (
    <div className="rank-roadmap" role="region" aria-label="Lộ trình thăng hạng">
      <div className="rank-roadmap-track" aria-hidden="true" />
      <div className="rank-roadmap-steps">
        {stageSteps.map((step) => {
          const stageData = stages.find((s) => s.code === step.code);
          const state = stageData?.state || (step.code === currentRankCode ? 'current' : 'locked');
          const isAchieved = state === 'achieved';
          const isCurrent = state === 'current';
          const isNext = state === 'next';

          let stateLabel = 'Chưa mở';
          let StateIcon = Lock;
          if (isAchieved) {
            stateLabel = 'Đã đạt';
            StateIcon = Check;
          } else if (isCurrent) {
            stateLabel = 'Bậc hiện tại';
            StateIcon = Sparkles;
          } else if (isNext) {
            stateLabel = 'Bậc tiếp theo';
            StateIcon = Target;
          }

          return (
            <div
              key={step.code}
              className={`rank-roadmap-step is-${state}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <div className="rank-roadmap-node">
                <span className="rank-roadmap-order">{step.order}</span>
                <StateIcon className="rank-roadmap-icon" aria-hidden="true" />
              </div>
              <div className="rank-roadmap-info">
                <strong className="rank-roadmap-title">{step.label}</strong>
                <span className="rank-roadmap-state-tag">{stateLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const HOF_AWARD_DEFS = [
  { key: 'golden_ball', title: 'Quả bóng vàng', icon: '🥇' },
  { key: 'silver_ball', title: 'Quả bóng bạc', icon: '🥈' },
  { key: 'bronze_ball', title: 'Quả bóng đồng', icon: '🥉' },
  { key: 'top_scorer', title: 'Vua phá lưới', icon: '⚽' },
  { key: 'top_assist', title: 'Vua kiến tạo', icon: '🎯' },
  { key: 'best_transfer', title: 'Bản HĐ xuất sắc', icon: '🤝' },
  { key: 'best_goal', title: 'Bàn thắng đẹp nhất', icon: '🎬' }
];

/**
 * Modal showing honour history ("Lịch sử vinh danh") with season cover images attached
 */
export function AwardDetailModal({ awardModal, sessions = [], onClose }) {
  if (!awardModal) return null;
  const { playerLegend, selectedKey: initialKey = 'ALL', award: directAward, history: directHistory } = awardModal;

  // Derive all history for this player
  const allHistory = useMemo(() => {
    if (playerLegend?.history && playerLegend.history.length > 0) {
      return playerLegend.history;
    }
    if (directHistory && directHistory.length > 0) {
      return directHistory;
    }
    return [];
  }, [playerLegend, directHistory]);

  const [filterKey, setFilterKey] = useState(() => {
    if (initialKey) return initialKey;
    if (directAward?.key) return directAward.key;
    return 'ALL';
  });

  const [activeVideo, setActiveVideo] = useState(null);

  const sessionMap = useMemo(() => {
    return new Map((sessions || []).map((s) => [Number(s.session_id), s]));
  }, [sessions]);

  // Available filter tabs based on player's awards
  const availableFilters = useMemo(() => {
    const keys = Array.from(new Set(allHistory.map((h) => h.key)));
    return keys
      .map((k) => HOF_AWARD_DEFS.find((d) => d.key === k))
      .filter(Boolean)
      .map((def) => ({
        ...def,
        count: allHistory.filter((h) => h.key === def.key).length
      }));
  }, [allHistory]);

  // Filtered list
  const displayedHistory = useMemo(() => {
    if (filterKey === 'ALL') return allHistory;
    return allHistory.filter((h) => h.key === filterKey);
  }, [allHistory, filterKey]);

  return (
    <div
      className="session-modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="legend-detail-modal rank-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rank-award-modal-title"
      >
        <div className="rank-history-modal-header">
          <div className="legend-section-heading">
            <div>
              <span className="session-eyebrow">HONOUR ROLL</span>
              <h3 id="rank-award-modal-title">Lịch sử vinh danh</h3>
              {playerLegend?.player?.name && (
                <p className="rank-history-player-subtitle">
                  {playerLegend.player.name} · {allHistory.length} danh hiệu cá nhân
                </p>
              )}
            </div>
            <strong>{displayedHistory.length}</strong>
          </div>
          <button
            type="button"
            className="session-close-button rank-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="legend-detail-history rank-history-detail-section">

          {/* Quick Filter Tabs if player has more than 1 category */}
          {availableFilters.length > 1 && (
            <div className="rank-award-filter-tabs" role="tablist" aria-label="Bộ lọc danh hiệu">
              <button
                type="button"
                className={`rank-award-filter-btn ${filterKey === 'ALL' ? 'is-active' : ''}`}
                onClick={() => setFilterKey('ALL')}
              >
                <span>Tất cả</span>
                <span className="rank-award-filter-count">({allHistory.length})</span>
              </button>
              {availableFilters.map((def) => (
                <button
                  key={def.key}
                  type="button"
                  className={`rank-award-filter-btn ${filterKey === def.key ? 'is-active' : ''}`}
                  onClick={() => setFilterKey(def.key)}
                >
                  <span>{def.icon}</span>
                  <span>{def.title}</span>
                  <span className="rank-award-filter-count">({def.count})</span>
                </button>
              ))}
            </div>
          )}

          {/* List of honour items with season cover thumbnail attached */}
          <div className="rank-history-items-list">
            {displayedHistory.length > 0 ? (
              displayedHistory.map((item, idx) => {
                const matchedSession = sessionMap.get(Number(item.session_id));
                const rawImg =
                  item.session_image ||
                  matchedSession?.image ||
                  matchedSession?.awardImage ||
                  '';
                const imgUrl = publicAssetUrl(rawImg);
                const sessionTitle =
                  item.session_title ||
                  matchedSession?.Title ||
                  matchedSession?.title ||
                  `Mùa giải ${item.session_id}`;
                const awardDef = HOF_AWARD_DEFS.find((a) => a.key === item.key);
                const videoUrl = publicAssetUrl(item.video);

                return (
                  <article
                    className="legend-history-item rank-history-row"
                    key={`${item.session_id}-${item.key}-${idx}`}
                  >
                    {/* Ảnh mùa giải đi kèm */}
                    <div className="legend-history-thumb-wrap">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={sessionTitle}
                          className="legend-history-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <div className="legend-history-thumb-fallback">
                          <span>S{item.session_id}</span>
                        </div>
                      )}
                    </div>

                    {/* Icon danh hiệu */}
                    <span className="legend-history-icon" title={item.title}>
                      {awardDef?.icon || '🏆'}
                    </span>

                    {/* Tên danh hiệu & Tên mùa giải */}
                    <div className="legend-history-copy">
                      <strong>{item.title}</strong>
                      <span>
                        {sessionTitle} · {item.season || '—'}
                      </span>
                    </div>

                    {/* Nút Video nếu có */}
                    {item.video && (
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="legend-video-link"
                        onClick={(e) => {
                          if (videoUrl.endsWith('.mp4') || videoUrl.endsWith('.webm')) {
                            e.preventDefault();
                            setActiveVideo(activeVideo === videoUrl ? null : videoUrl);
                          }
                        }}
                      >
                        <Clapperboard className="w-3.5 h-3.5" /> Video
                      </a>
                    )}
                  </article>
                );
              })
            ) : (
              <div className="legend-empty-state">
                Chưa có danh hiệu phù hợp trong mục này.
              </div>
            )}
          </div>

          {/* Video player preview if toggled */}
          {activeVideo && (
            <div className="legend-video-block">
              <div className="legend-video-block-heading">
                <span className="session-eyebrow">BEST GOAL · BÀN THẮNG ĐẸP NHẤT</span>
                <button
                  type="button"
                  className="rank-video-close-btn"
                  onClick={() => setActiveVideo(null)}
                >
                  Đóng video
                </button>
              </div>
              <video
                controls
                autoPlay
                preload="metadata"
                src={activeVideo}
                className="rank-modal-video"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * Animated Legend Stairway Banner
 * For World Class -> Legend transition: inspiring visual stairway into legendary glory
 */
function LegendStairwayBanner() {
  return (
    <div className="rank-stairway-banner" aria-label="Hành trình bước lên bậc Huyền thoại">
      {/* Background Animated Atmosphere: Red Velvet Glow & Drifting Smoke (Optimized GPU Layers) */}
      <div className="rank-stairway-bg" />
      <div className="rank-stairway-smoke rank-smoke-layer-1" />
      <div className="rank-stairway-smoke rank-smoke-layer-2" />
      <div className="rank-stairway-light-beam" />

      {/* Left Quotes Column (2 quotes, scaled up) */}
      <div className="rank-stairway-quotes-col left">
        <p className="rank-stairway-quote">
          “Bạn đang nỗ lực đúng hướng”
        </p>
        <p className="rank-stairway-quote">
          “Mọi nỗ lực của bạn sẽ được đền đáp xứng đáng”
        </p>
      </div>

      {/* Center Staircase Illustration (Grand & Imposing) */}
      <div className="rank-stairway-center">
        <svg
          className="rank-stairway-svg"
          viewBox="0 0 600 330"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <radialGradient id="summitGlow" cx="50%" cy="30%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="25%" stopColor="#fef08a" stopOpacity="0.9" />
              <stop offset="55%" stopColor="#f59e0b" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#b91529" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="beamGradient" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.55" />
              <stop offset="60%" stopColor="#fbbf24" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="runnerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="40%" stopColor="#dc2626" />
              <stop offset="80%" stopColor="#991b1b" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
            <linearGradient id="goldEdge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="20%" stopColor="#fbbf24" />
              <stop offset="50%" stopColor="#fffbeb" />
              <stop offset="80%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <linearGradient id="treadGradient" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.08" />
            </linearGradient>
            <linearGradient id="riserGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0a0f1d" />
            </linearGradient>
            <radialGradient id="smokeCloud" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e2e8f0" stopOpacity="0.35" />
              <stop offset="50%" stopColor="#cbd5e1" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#94a3b8" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Radiating Light Beam from Portal */}
          <polygon points="300,32 170,330 430,330" fill="url(#beamGradient)" className="rank-svg-beam" />

          {/* Portal Glow Halo at the Summit */}
          <circle cx="300" cy="42" r="68" fill="url(#summitGlow)" className="rank-svg-portal" />

          {/* Summit Crown & Sparkles (Enlarged) */}
          <g className="rank-svg-crown-wrap">
            <circle cx="300" cy="40" r="22" fill="#fbbf24" opacity="0.45" />
            <path
              d="M285 52 L281 33 L291 39 L300 24 L309 39 L319 33 L315 52 Z"
              fill="#fbbf24"
              stroke="#fffbeb"
              strokeWidth="1.2"
            />
            <circle cx="300" cy="24" r="2.2" fill="#fff" />
            <circle cx="281" cy="33" r="1.8" fill="#fff" />
            <circle cx="319" cy="33" r="1.8" fill="#fff" />
            <circle cx="291" cy="39" r="1.4" fill="#fef08a" />
            <circle cx="309" cy="39" r="1.4" fill="#fef08a" />
          </g>

          {/* Billowing Smoke Puffs Behind/Flanking Stairs */}
          <ellipse cx="160" cy="280" rx="110" ry="45" fill="url(#smokeCloud)" className="rank-svg-smoke-cloud c1" />
          <ellipse cx="440" cy="270" rx="115" ry="48" fill="url(#smokeCloud)" className="rank-svg-smoke-cloud c2" />
          <ellipse cx="210" cy="190" rx="80" ry="34" fill="url(#smokeCloud)" className="rank-svg-smoke-cloud c3" />
          <ellipse cx="390" cy="195" rx="85" ry="36" fill="url(#smokeCloud)" className="rank-svg-smoke-cloud c4" />

          {/* 7 Grand Perspective Steps (Scaled & Widened) */}
          {/* Step 7 (Top) */}
          <g className="rank-stair-step step-7">
            <polygon points="266,66 334,66 339,76 261,76" fill="url(#riserGradient)" />
            <polygon points="263,64 337,64 334,66 266,66" fill="url(#treadGradient)" />
            <line x1="261" y1="76" x2="339" y2="76" stroke="url(#goldEdge)" strokeWidth="1.6" />
            <polygon points="286,64 314,64 317,76 283,76" fill="url(#runnerGradient)" />
          </g>

          {/* Step 6 */}
          <g className="rank-stair-step step-6">
            <polygon points="255,80 345,80 352,93 248,93" fill="url(#riserGradient)" />
            <polygon points="251,77 349,77 345,80 255,80" fill="url(#treadGradient)" />
            <line x1="248" y1="93" x2="352" y2="93" stroke="url(#goldEdge)" strokeWidth="1.8" />
            <polygon points="280,77 320,77 324,93 276,93" fill="url(#runnerGradient)" />
          </g>

          {/* Step 5 */}
          <g className="rank-stair-step step-5">
            <polygon points="240,99 360,99 369,116 231,116" fill="url(#riserGradient)" />
            <polygon points="236,95 364,95 360,99 240,99" fill="url(#treadGradient)" />
            <line x1="231" y1="116" x2="369" y2="116" stroke="url(#goldEdge)" strokeWidth="2.2" />
            <polygon points="274,95 326,95 331,116 269,116" fill="url(#runnerGradient)" />
          </g>

          {/* Step 4 */}
          <g className="rank-stair-step step-4">
            <polygon points="221,124 379,124 391,146 209,146" fill="url(#riserGradient)" />
            <polygon points="216,119 384,119 379,124 221,124" fill="url(#treadGradient)" />
            <line x1="209" y1="146" x2="391" y2="146" stroke="url(#goldEdge)" strokeWidth="2.5" />
            <polygon points="266,119 334,119 341,146 259,146" fill="url(#runnerGradient)" />
          </g>

          {/* Step 3 */}
          <g className="rank-stair-step step-3">
            <polygon points="196,156 404,156 420,184 180,184" fill="url(#riserGradient)" />
            <polygon points="190,150 410,150 404,156 196,156" fill="url(#treadGradient)" />
            <line x1="180" y1="184" x2="420" y2="184" stroke="url(#goldEdge)" strokeWidth="2.8" />
            <polygon points="256,150 344,150 353,184 247,184" fill="url(#runnerGradient)" />
          </g>

          {/* Step 2 */}
          <g className="rank-stair-step step-2">
            <polygon points="164,198 436,198 456,233 144,233" fill="url(#riserGradient)" />
            <polygon points="156,190 444,190 436,198 164,198" fill="url(#treadGradient)" />
            <line x1="144" y1="233" x2="456" y2="233" stroke="url(#goldEdge)" strokeWidth="3.2" />
            <polygon points="244,190 356,190 367,233 233,233" fill="url(#runnerGradient)" />
          </g>

          {/* Step 1 (Grand Base Step) with Base Drop Shadow */}
          <ellipse cx="300" cy="302" rx="215" ry="16" fill="#000000" opacity="0.65" />
          <g className="rank-stair-step step-1">
            <polygon points="124,250 476,250 502,295 98,295" fill="url(#riserGradient)" />
            <polygon points="114,240 486,240 476,250 124,250" fill="url(#treadGradient)" />
            <line x1="98" y1="295" x2="502" y2="295" stroke="url(#goldEdge)" strokeWidth="3.8" />
            <polygon points="228,240 372,240 386,295 214,295" fill="url(#runnerGradient)" />
          </g>

          {/* Atmospheric Mist Drift across step base */}
          <ellipse cx="200" cy="290" rx="120" ry="30" fill="url(#smokeCloud)" className="rank-svg-smoke-cloud c5" />
          <ellipse cx="400" cy="285" rx="125" ry="32" fill="url(#smokeCloud)" className="rank-svg-smoke-cloud c6" />

          {/* Floating Stardust Particles */}
          <circle cx="280" cy="130" r="2" fill="#fef08a" className="rank-svg-sparkle s1" />
          <circle cx="330" cy="100" r="2.2" fill="#ffffff" className="rank-svg-sparkle s2" />
          <circle cx="260" cy="180" r="1.8" fill="#fbbf24" className="rank-svg-sparkle s3" />
          <circle cx="340" cy="170" r="2.1" fill="#fef08a" className="rank-svg-sparkle s4" />
          <circle cx="300" cy="80" r="2.6" fill="#ffffff" className="rank-svg-sparkle s5" />
          <circle cx="240" cy="230" r="2" fill="#fef08a" className="rank-svg-sparkle s6" />
          <circle cx="360" cy="220" r="2.3" fill="#ffffff" className="rank-svg-sparkle s7" />
        </svg>
      </div>

      {/* Right Quote Column (1 quote, scaled up) */}
      <div className="rank-stairway-quotes-col right">
        <p className="rank-stairway-quote">
          “Hãy viết tiếp giấc mơ trở thành huyền thoại”
        </p>
      </div>
    </div>
  );
}

/**
 * Detailed Player Journey View
 */
function PlayerJourneyDetail({
  item,
  profile,
  ranks,
  statNames,
  adminKey,
  needAdmin,
  onBack,
  onChange,
  legendsData,
  sessionsData,
  recordsData = [],
  onNavigateToRecord
}) {
  const [editor, setEditor] = useState(null);
  const [awardModal, setAwardModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expandedAchieved, setExpandedAchieved] = useState(false);

  const cardInfo = useMemo(() => resolveCardInfo(item.player, profile), [item.player, profile]);

  const run = async (task) => {
    if (!adminKey) {
      needAdmin();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await task();
      onChange(response.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const nextStage = item.stages.find((s) => s.code === item.next?.code);
  const isLegend = !item.next || item.current.code === 'legend';
  const isPromotingToLegend = nextStage?.code === 'legend';

  // Achieved stages (excluding current and future)
  const achievedStages = item.stages.filter((s) => s.state === 'achieved');

  const promote = () => {
    if (!adminKey) {
      needAdmin();
      return;
    }
    const missionCount = nextStage?.missions.length || 0;
    const completedCount = nextStage?.completed || 0;
    const missionStatus = isPromotingToLegend
      ? 'Chặng Huyền thoại không áp dụng nhiệm vụ.'
      : missionCount
      ? `Nhiệm vụ: ${completedCount}/${missionCount} hoàn thành.`
      : 'Chặng này chưa thiết lập nhiệm vụ.';

    const confirmed = window.confirm(
      `Xác nhận trao bậc cho ${item.player.name}?\n\n` +
      `Bậc hiện tại: ${item.current.name}\n` +
      `Bậc mới: ${nextStage.name}\n` +
      `${missionStatus}\n\n` +
      `Lưu ý: Bậc đã trao không thể hạ lại.`
    );
    if (!confirmed) return;

    run(() =>
      api.post(
        `/rank-journey/players/${item.player.player_id}/promotions`,
        { target: nextStage.code },
        headers(adminKey)
      )
    );
  };

  // Determine if defensive position: GK, CB, LB, RB, CDM, LWB, RWB
  const rawPositions = Array.isArray(item.player.position)
    ? item.player.position
    : [item.player.position];
  const positionsUpper = rawPositions.map((p) => String(p || '').toUpperCase());
  const isDefensive = positionsUpper.some((p) =>
    ['GK', 'CB', 'LB', 'RB', 'CDM', 'LWB', 'RWB'].includes(p)
  );

  // Stats entries for compact stat bar
  const statEntries = [];
  if (cardInfo.stats.match !== undefined && cardInfo.stats.match !== null) {
    statEntries.push({ label: 'Trận', value: cardInfo.stats.match });
  }
  if (cardInfo.stats.goalAmounts !== undefined && cardInfo.stats.goalAmounts !== null) {
    statEntries.push({ label: 'Bàn thắng', value: cardInfo.stats.goalAmounts });
  }
  if (cardInfo.stats.assistAmounts !== undefined && cardInfo.stats.assistAmounts !== null) {
    statEntries.push({ label: 'Kiến tạo', value: cardInfo.stats.assistAmounts });
  }
  if (cardInfo.stats.bestPlayerAmount !== undefined && cardInfo.stats.bestPlayerAmount !== null) {
    statEntries.push({ label: 'MVP', value: cardInfo.stats.bestPlayerAmount });
  }
  if (isDefensive) {
    statEntries.push({ label: 'Bàn thua', value: cardInfo.stats.goalsAgainst ?? 0 });
    statEntries.push({ label: 'Giữ sạch lưới', value: cardInfo.stats.cleanSheets ?? 0 });
    statEntries.push({ label: 'WINS', value: cardInfo.stats.wins ?? 0 });
    statEntries.push({ label: 'DRAWS', value: cardInfo.stats.draws ?? 0 });
    statEntries.push({ label: 'LOSSES', value: cardInfo.stats.losses ?? 0 });
  }

  // Trophies, Archive HTH, Last Week Cup & Ngôi đền huyền thoại (Hall of Fame)
  const playerActive = item.player?.active || profile?.active || {};
  const lastWeekCup = Number(playerActive.lastWeekCup) || 0;
  const rawHth = Array.isArray(playerActive.HTH) ? playerActive.HTH : [];
  const hthValues = rawHth
    .map((entry) => (typeof entry === 'object' ? entry?.value : entry))
    .filter(Boolean);

  const legendInfo = useMemo(() => {
    if (!legendsData?.legends) return null;
    return (
      legendsData.legends.find(
        (l) => String(l.player_id) === String(item.player.player_id)
      ) || null
    );
  }, [legendsData, item.player.player_id]);

  const hofAwards = useMemo(() => {
    if (!legendInfo?.awards) return [];
    return HOF_AWARD_DEFS.filter((def) => Number(legendInfo.awards[def.key]) > 0).map(
      (def) => ({
        ...def,
        count: Number(legendInfo.awards[def.key])
      })
    );
  }, [legendInfo]);

  const totalHofCount = legendInfo?.totalAwards || 0;
  const playerRecords = useMemo(() => {
    if (!Array.isArray(recordsData) || recordsData.length === 0) return [];
    const playerId = Number(item.player?.player_id);
    const playerNameNorm = normalize(item.player?.name || '');
    const match = (pid, pname) => {
      if (pid && playerId && Number(pid) === playerId) return true;
      if (pname && playerNameNorm && normalize(pname) === playerNameNorm) return true;
      return false;
    };

    const list = [];
    recordsData.forEach((rec) => {
      const isPrimary = match(rec.player_id, rec.player);
      const isCo = Array.isArray(rec.co_players) && rec.co_players.some((co) => match(co.player_id, co.player));
      const isCurrent = isPrimary || isCo;
      if (isCurrent) {
        list.push({
          record_id: rec.record_id,
          title: rec.award_name || rec.name,
          name: rec.name,
          type: 'current',
          is_co_holder: isCo && !isPrimary,
          has_co_holders: (rec.co_players?.length || 0) > 0
        });
      } else {
        const history = Array.isArray(rec.player_history) ? rec.player_history : [];
        const wasPast = history.some((h) => match(h.player_id, h.player));
        if (wasPast) {
          list.push({
            record_id: rec.record_id,
            title: rec.award_name || rec.name,
            name: rec.name,
            type: 'past'
          });
        }
      }
    });
    return list;
  }, [recordsData, item.player]);

  const totalHonorsCount =
    (lastWeekCup > 0 ? 1 : 0) +
    (hthValues.length > 0 ? hthValues.length : 0) +
    totalHofCount;

  return (
    <div className="rank-detail-view">
      {/* Back button */}
      <div className="rank-detail-top-nav">
        <button
          type="button"
          className="rank-back-button"
          onClick={onBack}
          aria-label="Quay lại danh sách hành trình"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Danh sách hành trình</span>
        </button>
      </div>

      {/* Hero Player Identity Section */}
      <section className="rank-player-identity-card" aria-label="Thông tin cầu thủ">
        <div className="rank-identity-artwork-col">
          <PlayerCardArtwork
            src={cardInfo.imageCard}
            playerName={item.player.name}
            seasonName={cardInfo.seasonName}
            height={270}
            priority={true}
            className="rank-detail-card-artwork"
          />
        </div>

        <div className="rank-identity-info-col">
          <div className="rank-identity-header">
            <div>
              <span className="session-eyebrow">HÀNH TRÌNH THĂNG HẠNG</span>
              <h2 className="rank-identity-name">{item.player.name}</h2>
              <div className="rank-identity-sub">
                <span className="rank-identity-season">
                  Mùa thẻ: <strong>{cardInfo.seasonName}</strong>
                </span>
                <span className="rank-meta-divider">•</span>
                <span className={`rank-identity-status ${cardInfo.isActive ? 'is-active' : 'is-inactive'}`}>
                  {cardInfo.isActive ? 'Active' : 'DeActive'}
                </span>
              </div>
            </div>

            <div className="rank-identity-badge-wrap">
              <span className="rank-badge-caption">BẬC HIỆN TẠI</span>
              <RankBadge code={item.current.code} name={item.current.name} size="large" />
            </div>
          </div>

          <div className="rank-identity-attributes">
            <div className="rank-attr-box">
              <span className="rank-attr-label">OVR</span>
              <strong className="rank-attr-value">{cardInfo.ovr}</strong>
            </div>
            <div className="rank-attr-box">
              <span className="rank-attr-label">VỊ TRÍ</span>
              <strong className="rank-attr-value">{cardInfo.positionsText}</strong>
            </div>
            <div className="rank-attr-box">
              <span className="rank-attr-label">SỐ MÙA GIẢI</span>
              <strong className="rank-attr-value">{cardInfo.stats.sessionAmount || 0}</strong>
            </div>
          </div>

          {/* Compact Stat Bar (only real data) */}
          {statEntries.length > 0 && (
            <div className="rank-identity-stats-row">
              <span className="rank-stats-heading">Thống kê sự nghiệp:</span>
              <div className="rank-stats-pills">
                {statEntries.map((stat) => (
                  <div key={stat.label} className="rank-stat-pill">
                    <span className="rank-stat-pill-label">{stat.label}</span>
                    <strong className="rank-stat-pill-val">{stat.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Trophy & Honors Showcase (Filling the spacious white space) */}
        <div className="rank-identity-trophy-col">
          <div className="rank-trophy-card">
            <div className="rank-trophy-card-header">
              <div className="rank-trophy-card-title">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>DANH HIỆU & THÀNH TÍCH</span>
              </div>
              <span className="rank-trophy-total-badge">
                {totalHonorsCount} Danh hiệu
              </span>
            </div>

            {/* Section 1: Danh hiệu tập thể */}
            <div className="rank-trophy-group">
              <span className="rank-trophy-group-label">DANH HIỆU TẬP THỂ</span>
              <div className="rank-trophy-items">
                {lastWeekCup > 0 && (
                  <div className="rank-trophy-chip cup" title="Cúp Tuần - Last Week Cup">
                    <span className="rank-trophy-chip-icon">🏆</span>
                    <span className="rank-trophy-chip-text">
                      <strong>{lastWeekCup}</strong> Last Week Cup
                    </span>
                  </div>
                )}
                {hthValues.length > 0 && (
                  <div className="rank-hth-showcase-card">
                    <div className="rank-hth-showcase-title">
                      <Crown className="rank-hth-crown-icon" aria-hidden="true" />
                      <strong>{hthValues.length} HTH Archive</strong>
                      <span className="rank-hth-summary-label">Mốc sao đạt được:</span>
                    </div>
                    <div className="rank-hth-stars-grid">
                      {hthValues.map((val, idx) => (
                        <span
                          key={idx}
                          className={`rank-hth-pill ${
                            val.includes('30')
                              ? 'is-gold-30'
                              : val.includes('20')
                              ? 'is-green-20'
                              : 'is-blue-10'
                          }`}
                          title={`HTH Archive mốc ${val}`}
                        >
                          <span className="rank-hth-pill-star">★</span>
                          <strong>{val}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {lastWeekCup === 0 && hthValues.length === 0 && (
                  <span className="rank-trophy-empty-note">Chưa có danh hiệu tập thể</span>
                )}
              </div>
            </div>

            {/* Section 2: Danh hiệu cá nhân */}
            <div className="rank-trophy-group">
              <div className="rank-trophy-group-header">
                <span className="rank-trophy-group-label">
                  DANH HIỆU CÁ NHÂN {totalHofCount > 0 ? `(${totalHofCount})` : ''}
                </span>
                {totalHofCount > 0 && (
                  <button
                    type="button"
                    className="rank-trophy-view-all-link"
                    onClick={() =>
                      setAwardModal({
                        playerLegend: legendInfo,
                        selectedKey: 'ALL'
                      })
                    }
                  >
                    Xem lịch sử vinh danh
                  </button>
                )}
              </div>
              <div className="rank-trophy-items">
                {hofAwards.length > 0 ? (
                  hofAwards.map((award) => (
                    <button
                      key={award.key}
                      type="button"
                      className="rank-trophy-chip hof is-clickable"
                      onClick={() => {
                        setAwardModal({
                          playerLegend: legendInfo,
                          selectedKey: award.key,
                          award
                        });
                      }}
                      title={`Nhấn để xem các mùa giải đạt ${award.title}`}
                    >
                      <span className="rank-trophy-chip-icon">{award.icon}</span>
                      <span className="rank-trophy-chip-text">
                        {award.title} <strong>×{award.count}</strong>
                      </span>
                    </button>
                  ))
                ) : (
                  <span className="rank-trophy-empty-note">
                    Chưa có danh hiệu cá nhân
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Horizontal Club Records Card */}
      {playerRecords.length > 0 && (
        <section className="rank-records-horizontal-card" aria-label="Kỷ lục câu lạc bộ">
          <div className="rank-records-horizontal-header">
            <div className="rank-records-horizontal-title-wrap">
              <span className="session-eyebrow">THE RECORDS</span>
              <div className="rank-records-horizontal-title">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3>Kỷ lục câu lạc bộ</h3>
                <span className="rank-records-count-chip">{playerRecords.length} kỷ lục</span>
              </div>
            </div>
          </div>
          <div className="rank-records-horizontal-items">
            {playerRecords.map((rec) => (
              <button
                key={rec.record_id}
                type="button"
                className={`rank-record-pill ${rec.type === 'current' ? 'is-current' : 'is-past'} is-clickable`}
                onClick={() => {
                  if (onNavigateToRecord) {
                    onNavigateToRecord(rec.record_id);
                  } else {
                    window.dispatchEvent(
                      new CustomEvent('navigate-to-record', {
                        detail: { recordId: rec.record_id }
                      })
                    );
                  }
                }}
                title={`Nhấn để chuyển đến kỷ lục: ${rec.name}`}
              >
                <span className="rank-record-pill-icon">
                  {rec.type === 'current' ? (
                    <Crown className="w-3.5 h-3.5 fill-amber-400 text-amber-500" aria-hidden="true" />
                  ) : (
                    '⏳'
                  )}
                </span>
                <span className="rank-record-pill-text">
                  <span className="rank-record-pill-prefix">
                    {rec.type === 'current'
                      ? rec.is_co_holder || rec.has_co_holders
                        ? 'Đồng nắm giữ kỷ lục : '
                        : 'Đang nắm giữ kỷ lục : '
                      : 'Đã từng nắm giữ : '}
                  </span>
                  <strong className="rank-record-pill-name">{rec.title}</strong>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 4-Stage Compact Roadmap */}
      <section className="rank-roadmap-section" aria-label="Lộ trình 4 bậc">
        <div className="rank-section-title-row">
          <h3>Lộ trình thăng hạng</h3>
          <span className="rank-section-subtitle">
            Tài năng trẻ → Chuyên nghiệp → World Class → Huyền thoại
          </span>
        </div>
        <Roadmap stages={item.stages} currentRankCode={item.current.code} />
      </section>

      {error && (
        <div className="record-error rank-error-banner" role="alert">
          {error}
        </div>
      )}

      {/* Next Stage - Primary Focus */}
      <section className="rank-next-stage-panel" aria-label="Chặng tiếp theo">
        {!cardInfo.isActive ? (
          <div className="rank-deactive-lock-card">
            <div className="rank-deactive-lock-icon">
              <Lock className="w-9 h-9" />
            </div>
            <div className="rank-deactive-lock-text">
              <h3>Hành trình đang tạm khóa</h3>
              <p>cầu thủ này hiện ko còn thi đấu cho câu lạc bộ</p>
            </div>
          </div>
        ) : isLegend ? (
          <div className="rank-legend-complete-card">
            <div className="rank-legend-trophy-icon">
              <Trophy className="w-10 h-10 text-amber-500" />
            </div>
            <div>
              <h3>Đã hoàn tất hành trình thăng hạng</h3>
              <p>
                <strong>{item.player.name}</strong> đã đạt bậc cao nhất{' '}
                <span className="text-red-600 font-bold">Huyền thoại</span>. Cột mốc phát triển cao nhất đã được ghi nhận vào lịch sử câu lạc bộ.
              </p>
            </div>
          </div>
        ) : nextStage ? (
          <div>
            <div className="rank-next-stage-header">
              <div>
                <span className="session-eyebrow">CHẶNG TIẾP THEO</span>
                <div className="rank-next-stage-title-wrap">
                  <h3 className="rank-next-stage-name">Bậc: {nextStage.name}</h3>
                  <RankBadge code={nextStage.code} name={nextStage.name} size="normal" />
                </div>
                <p className="rank-next-stage-desc">
                  {isPromotingToLegend
                    ? 'Chặng bước vào đỉnh cao Huyền thoại câu lạc bộ Ajax.'
                    : nextStage.missions.length
                    ? nextStage.complete
                      ? 'Đã hoàn thành toàn bộ nhiệm vụ của chặng.'
                      : `Đã hoàn thành ${nextStage.completed}/${nextStage.missions.length} nhiệm vụ.`
                    : 'Chưa thiết lập nhiệm vụ cho chặng này.'}
                </p>
              </div>

              {!isPromotingToLegend && (
                <div className="rank-next-stage-actions">
                  <button
                    type="button"
                    className="session-secondary-button rank-btn-sm"
                    onClick={() => (adminKey ? setEditor(nextStage) : needAdmin())}
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>{nextStage.missions.length ? 'Chỉnh sửa nhiệm vụ' : 'Thiết lập nhiệm vụ'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Missions List or Legend Stairway Banner */}
            {isPromotingToLegend ? (
              <LegendStairwayBanner />
            ) : nextStage.missions.length === 0 ? (
              <div className="rank-empty-missions-box">
                <Target className="w-8 h-8 opacity-40" />
                <p>
                  Chặng này chưa được cấu hình nhiệm vụ. Bạn có thể thiết lập nhiệm vụ để theo dõi mốc tiến độ hoặc quản trị viên có thể trao bậc trực tiếp.
                </p>
                <button
                  type="button"
                  className="session-secondary-button"
                  onClick={() => (adminKey ? setEditor(nextStage) : needAdmin())}
                >
                  <Plus className="w-4 h-4" /> Thiết lập nhiệm vụ
                </button>
              </div>
            ) : (
              <div className="rank-missions-grid">
                {nextStage.missions.map((mission, idx) => (
                  <article
                    className={`rank-mission-card ${mission.complete ? 'is-complete' : ''}`}
                    key={mission.id || idx}
                  >
                    <div className="rank-mission-status-icon">
                      {mission.complete ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-300" />
                      )}
                    </div>

                    <div className="rank-mission-body">
                      <div className="rank-mission-header">
                        <strong className="rank-mission-name">{mission.name}</strong>
                        <span className={`rank-mission-type-badge ${mission.type}`}>
                          {mission.type === 'stat' ? 'Thống kê' : 'Quản trị'}
                        </span>
                      </div>

                      {mission.description && (
                        <p className="rank-mission-desc">{mission.description}</p>
                      )}

                      <div className="rank-mission-meta">
                        {mission.type === 'stat' ? (
                          <div className="rank-stat-progress-wrap">
                            <span className="rank-stat-progress-label">
                              {statNames[mission.stat] || mission.stat} ({mission.scope === 'stage' ? 'Từ đầu chặng' : 'Toàn sự nghiệp'}):{' '}
                              <strong>{mission.progress ?? 0} / {mission.target}</strong>
                            </span>
                            <div className="rank-progress-bar-bg" aria-hidden="true">
                              <div
                                className="rank-progress-bar-fill"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(((mission.progress || 0) / (mission.target || 1)) * 100)
                                  )}%`
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="rank-manual-status">
                            <span className={mission.confirmed ? 'text-emerald-700 font-semibold' : 'text-slate-500'}>
                              {mission.confirmed ? 'Đã được quản trị viên xác nhận' : 'Chờ quản trị viên xác nhận'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {mission.type === 'manual' && (
                      <div className="rank-mission-action">
                        <button
                          type="button"
                          className="session-secondary-button rank-btn-sm"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              api.put(
                                `/rank-journey/players/${item.player.player_id}/stages/${nextStage.code}/missions/${mission.id}/confirmation`,
                                { confirmed: !mission.confirmed },
                                headers(adminKey)
                              )
                            )
                          }
                        >
                          {mission.confirmed ? 'Bỏ xác nhận' : 'Xác nhận'}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}

            {/* Promotion Action Footer */}
            <div className="rank-promote-footer">
              <div className="rank-promote-note">
                <strong>{isPromotingToLegend ? 'Trao bậc Huyền thoại' : 'Trao bậc cho chặng tiếp theo'}</strong>
                <p>
                  {isPromotingToLegend
                    ? adminKey
                      ? 'Bạn có thể trao bậc trực tiếp để vinh danh cầu thủ bước vào Ngôi đền huyền thoại Ajax.'
                      : 'Mở quyền Quản trị để thực hiện trao bậc Huyền thoại.'
                    : adminKey
                    ? 'Bạn có thể trao bậc ngay khi thấy cầu thủ xứng đáng; nhiệm vụ là tùy chọn và không bắt buộc.'
                    : 'Mở quyền Quản trị để thực hiện trao bậc; nhiệm vụ là tùy chọn.'}
                </p>
              </div>
              <button
                type="button"
                className="session-primary-button rank-promote-btn"
                disabled={busy}
                onClick={promote}
              >
                Trao bậc {nextStage.name}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Collapsible Achieved Stages Section */}
      {achievedStages.length > 0 && (
        <section className="rank-collapsible-section" aria-label="Các chặng đã đạt">
          <button
            type="button"
            className="rank-accordion-trigger"
            onClick={() => setExpandedAchieved((val) => !val)}
            aria-expanded={expandedAchieved}
          >
            <div className="rank-accordion-title">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Các chặng đã hoàn thành ({achievedStages.length})</span>
            </div>
            {expandedAchieved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {expandedAchieved && (
            <div className="rank-accordion-body">
              <div className="rank-achieved-stages-list">
                {achievedStages.map((stage) => (
                  <div key={stage.code} className="rank-achieved-stage-card">
                    <div className="rank-achieved-stage-heading">
                      <div>
                        <h4>{stage.name}</h4>
                        <span className="rank-stage-achieved-tag">Đã trao</span>
                      </div>
                      <RankBadge code={stage.code} name={stage.name} size="small" />
                    </div>

                    {stage.missions?.length > 0 ? (
                      <ul className="rank-achieved-missions-list">
                        {stage.missions.map((m) => (
                          <li key={m.id || m.name}>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>{m.name}</span>
                            {m.type === 'stat' && (
                              <small>
                                ({statNames[m.stat] || m.stat}: {m.progress ?? '—'}/{m.target})
                              </small>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="rank-hint">Chặng này không có nhiệm vụ khi trao bậc.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Rank History Section */}
      <section className="rank-history-card" aria-label="Lịch sử trao bậc">
        <div className="rank-history-heading">
          <div>
            <span className="session-eyebrow">HONOUR ROLL</span>
            <h3>Lịch sử trao bậc</h3>
          </div>
          <span className="rank-history-count">{item.history.length} lần trao bậc</span>
        </div>

        {item.history.length > 0 ? (
          <div className="rank-timeline-history">
            {item.history.map((record) => {
              const fromName = ranks.find((r) => r.code === record.from)?.name || record.from;
              const toName = ranks.find((r) => r.code === record.to)?.name || record.to;

              return (
                <div key={record.id} className="rank-history-entry">
                  <div className="rank-history-entry-header">
                    <div className="rank-history-badges">
                      <RankBadge code={record.from} name={fromName} size="small" />
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <RankBadge code={record.to} name={toName} size="small" />
                    </div>
                    <div className="rank-history-meta">
                      <span className="rank-history-time">{formatDateTime(record.awarded_at)}</span>
                      <span className="rank-history-by">bởi {record.awarded_by || 'Quản trị viên'}</span>
                    </div>
                  </div>

                  {record.missions?.length > 0 && (
                    <div className="rank-history-missions-summary">
                      <strong>Nhiệm vụ tại thời điểm trao:</strong>
                      <ul>
                        {record.missions.map((m) => (
                          <li key={m.id || m.name}>
                            <span>{m.name}</span>
                            <small>
                              {m.type === 'stat'
                                ? `(${statNames[m.stat] || m.stat}: ${m.progress ?? 0}/${m.target} · ${m.complete ? 'Đã đạt' : 'Chưa đạt'})`
                                : m.complete
                                ? 'Đã xác nhận'
                                : 'Chưa xác nhận'}
                            </small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rank-history-empty">
            <Calendar className="w-8 h-8 opacity-40 mb-2" />
            <p>Chưa có lịch sử trao bậc cho cầu thủ này.</p>
          </div>
        )}
      </section>

      {/* Editor Modal */}
      {editor && (
        <MissionEditor
          item={item}
          stage={editor}
          statNames={statNames}
          adminKey={adminKey}
          onClose={() => setEditor(null)}
          onSaved={(value) => {
            onChange(value);
            setEditor(null);
          }}
        />
      )}

      {/* Award Detail Modal */}
      {awardModal && (
        <AwardDetailModal
          awardModal={awardModal}
          sessions={sessionsData}
          onClose={() => setAwardModal(null)}
        />
      )}
    </div>
  );
}

/**
 * Single Player Card within the Grid
 */
function PlayerJourneyCardItem({ item, profile, onSelect }) {
  const cardInfo = resolveCardInfo(item.player, profile);
  const nextStage = item.stages.find((s) => s.code === item.next?.code);
  const isLegend = !item.next || item.current.code === 'legend';

  const missionCount = nextStage?.missions?.length || 0;
  const completedCount = nextStage?.completed || 0;
  const isAllMissionsDone = missionCount > 0 && nextStage?.complete;

  return (
    <article
      className="rank-card-item"
      onClick={() => onSelect(item.player.player_id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.player.player_id);
        }
      }}
      aria-label={`Xem hành trình của ${item.player.name}`}
    >
      {/* Top Row: Card Artwork + Identity */}
      <div className="rank-card-top">
        <div className="rank-card-artwork-col">
          <PlayerCardArtwork
            src={cardInfo.imageCard}
            playerName={item.player.name}
            seasonName={cardInfo.seasonName}
            height={160}
            className="rank-list-artwork"
          />
        </div>

        <div className="rank-card-meta-col">
          <div className="rank-card-title-group">
            <h4 className="rank-card-player-name" title={item.player.name}>
              {item.player.name}
            </h4>
            <div className="rank-card-season-tag" title={`Mùa thẻ: ${cardInfo.seasonName}`}>
              {cardInfo.seasonName}
            </div>
          </div>

          <div className="rank-card-specs">
            <div className="rank-spec-pill ovr">
              <small>OVR</small>
              <strong>{cardInfo.ovr}</strong>
            </div>
            <div className="rank-spec-pill pos">
              <span>{cardInfo.positionsText}</span>
            </div>
            <div className={`rank-spec-pill status ${cardInfo.isActive ? 'active' : 'inactive'}`}>
              <span>{cardInfo.isActive ? 'Active' : 'DeActive'}</span>
            </div>
          </div>

          <div className="rank-card-current-badge-wrap">
            <RankBadge
              code={item.current.code}
              name={item.current.name}
              size="small"
            />
          </div>
        </div>
      </div>

      {/* Footer Row: View CTA */}
      <div className="rank-card-footer">
        <span className="rank-view-link">
          <span>Xem hành trình</span>
          <ChevronRight className="w-4 h-4" />
        </span>
      </div>
    </article>
  );
}

/**
 * Main Rank Journey Component (List & Navigation Container)
 */
export default function RankJourney({ profiles = [], onNavigateToRecord }) {
  const [data, setData] = useState(null);
  const [extraProfiles, setExtraProfiles] = useState([]);
  const [legendsData, setLegendsData] = useState(null);
  const [sessionsData, setSessionsData] = useState([]);
  const [recordsData, setRecordsData] = useState([]);
  const [error, setError] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);

  // Filters & Search
  const [query, setQuery] = useState('');
  const [filterRank, setFilterRank] = useState('ALL');
  const [filterActive, setFilterActive] = useState('ALL');
  const [rankOrder, setRankOrder] = useState('desc'); // 'desc': Legend -> Young Talent | 'asc': Young Talent -> Legend

  // Admin Auth state
  const [adminKey, setAdminKey] = useState('');
  const [loginModal, setLoginModal] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [checking, setChecking] = useState(false);

  // Fetch Rank Journey data & Legends awards & Sessions
  useEffect(() => {
    let active = true;
    api
      .get('/rank-journey')
      .then((res) => {
        if (active) setData(res.data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });

    getLegends()
      .then((res) => {
        if (active) setLegendsData(res);
      })
      .catch(() => {});

    getSessions()
      .then((res) => {
        if (active && Array.isArray(res)) setSessionsData(res);
      })
      .catch(() => {});

    getRecords()
      .then((res) => {
        if (active && Array.isArray(res)) setRecordsData(res);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // If profiles prop was not loaded yet, fetch /api/players to guarantee card resolution
  useEffect(() => {
    if (!profiles || profiles.length === 0) {
      getPlayers()
        .then((res) => setExtraProfiles(res))
        .catch(() => {});
    }
  }, [profiles]);

  // Combine profiles map
  const activeProfiles = useMemo(
    () => (profiles && profiles.length > 0 ? profiles : extraProfiles),
    [profiles, extraProfiles]
  );

  const profileById = useMemo(
    () => new Map(activeProfiles.map((p) => [String(p.player_id), p])),
    [activeProfiles]
  );

  // Filtered player list
  const filteredItems = useMemo(() => {
    if (!data?.players) return [];

    return data.players.filter((item) => {
      const profile = profileById.get(String(item.player.player_id)) || item.player;
      const cardInfo = resolveCardInfo(item.player, profile);

      // Search match: player name or season name
      const q = normalize(query);
      const matchesQuery =
        !q ||
        normalize(item.player.name).includes(q) ||
        normalize(cardInfo.seasonName).includes(q);

      // Rank filter
      const matchesRank =
        filterRank === 'ALL' || item.current.code === filterRank;

      // Active status filter
      const matchesActive =
        filterActive === 'ALL' ||
        (filterActive === 'ACTIVE' && cardInfo.isActive) ||
        (filterActive === 'INACTIVE' && !cardInfo.isActive);

      return matchesQuery && matchesRank && matchesActive;
    });
  }, [data, query, filterRank, filterActive, profileById]);

  // Group filtered players by the 4 ranks
  const groupedByRank = useMemo(() => {
    const groups = {
      legend: [],
      world_class: [],
      professional: [],
      young_talent: []
    };

    filteredItems.forEach((item) => {
      const code = item.current?.code || 'young_talent';
      if (groups[code]) {
        groups[code].push(item);
      } else {
        groups.young_talent.push(item);
      }
    });

    return groups;
  }, [filteredItems]);

  // The 4 rank codes in display order
  const displayRankCodes = useMemo(() => {
    const codes = ['legend', 'world_class', 'professional', 'young_talent'];
    return rankOrder === 'asc' ? [...codes].reverse() : codes;
  }, [rankOrder]);

  // Selected player item for detail view
  const selectedItem = useMemo(() => {
    if (!selectedPlayerId || !data?.players) return null;
    return (
      data.players.find(
        (x) => String(x.player.player_id) === String(selectedPlayerId)
      ) || null
    );
  }, [data, selectedPlayerId]);

  // Update item in state on promotion / mission edit
  const replaceItem = (value) => {
    setData((d) => ({
      ...d,
      players: d.players.map((x) =>
        x.player.player_id === value.player.player_id ? value : x
      )
    }));
  };

  // Admin login check
  const handleUnlock = async (e) => {
    e.preventDefault();
    setChecking(true);
    setLoginError('');
    try {
      await api.post('/rank-journey/admin/check', {}, headers(password));
      setAdminKey(password);
      setPassword('');
      setLoginModal(false);
    } catch (err) {
      setLoginError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  };

  if (error) {
    return (
      <div className="rank-empty-state" role="alert">
        <p>{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Đang tải hành trình thăng hạng...</p>
      </div>
    );
  }

  return (
    <div className="rank-page">
      {/* Top Hero Banner */}
      <section className="rank-hero">
        <img
          className="rank-hero-image"
          src="/RankImages/rank-journey-banner.png"
          alt="Hành trình thăng hạng - Ajax Football Club"
        />
      </section>

      {/* Admin Status & Unlock Bar */}
      <div className="rank-admin-bar">
        <span className={`rank-admin-status-text ${adminKey ? 'is-authorized' : ''}`}>
          {adminKey ? 'Đã mở quyền quản trị (Có thể trao bậc & chỉnh sửa)' : 'Chế độ xem hành trình'}
        </span>
        <button
          type="button"
          className="rank-admin-btn"
          onClick={() => (adminKey ? setAdminKey('') : setLoginModal(true))}
        >
          <LockKeyhole className="w-3.5 h-3.5" />
          <span>{adminKey ? 'Khóa quản trị' : 'Quản trị'}</span>
        </button>
      </div>

      {/* Page Routing: Detail View or Directory List View */}
      {selectedItem ? (
        <PlayerJourneyDetail
          item={selectedItem}
          profile={profileById.get(String(selectedItem.player.player_id))}
          ranks={data.ranks}
          statNames={data.stats}
          adminKey={adminKey}
          needAdmin={() => setLoginModal(true)}
          onBack={() => setSelectedPlayerId(null)}
          onChange={replaceItem}
          legendsData={legendsData}
          sessionsData={sessionsData}
          recordsData={recordsData}
          onNavigateToRecord={onNavigateToRecord}
        />
      ) : (
        <section className="rank-directory-section" aria-label="Danh sách hành trình cầu thủ">
          {/* Section Header */}
          <div className="rank-directory-heading">
            <div>
              <span className="session-eyebrow">THE JOURNEY</span>
              <h2>Hành trình cầu thủ theo 4 bậc</h2>
            </div>
            <span className="rank-total-count">
              <strong>{filteredItems.length}</strong> / {data.players?.length || 0} cầu thủ
            </span>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="rank-toolbar">
            <label className="rank-search-field">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm theo tên cầu thủ hoặc mùa thẻ..."
                aria-label="Tìm kiếm cầu thủ hoặc mùa thẻ"
              />
            </label>

            <div className="rank-filter-fields">
              <label className="rank-select-field">
                <span className="rank-select-label">BẬC:</span>
                <select
                  value={filterRank}
                  onChange={(e) => setFilterRank(e.target.value)}
                  aria-label="Lọc theo bậc"
                >
                  <option value="ALL">Tất cả các bậc (4 bậc)</option>
                  {data.ranks.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="rank-select-field">
                <span className="rank-select-label">TRẠNG THÁI:</span>
                <select
                  value={filterActive}
                  onChange={(e) => setFilterActive(e.target.value)}
                  aria-label="Lọc theo trạng thái"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="ACTIVE">Đang thi đấu (Active)</option>
                  <option value="INACTIVE">Tạm nghỉ (DeActive)</option>
                </select>
              </label>

              <button
                type="button"
                className="rank-order-toggle-btn"
                onClick={() => setRankOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}
                title="Đổi thứ tự hiển thị bậc (Đỉnh cao / Khởi đầu)"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>{rankOrder === 'desc' ? 'Huyền thoại → Tài năng trẻ' : 'Tài năng trẻ → Huyền thoại'}</span>
              </button>
            </div>
          </div>

          {/* Quick Rank Navigation Pills */}
          <div className="rank-quick-tabs" role="tablist" aria-label="Bộ lọc nhanh 4 bậc">
            <button
              type="button"
              className={`rank-tab-btn ${filterRank === 'ALL' ? 'is-active' : ''}`}
              onClick={() => setFilterRank('ALL')}
            >
              <span>Tất cả</span>
              <span className="rank-tab-count">{filteredItems.length}</span>
            </button>
            {displayRankCodes.map((code) => {
              const meta = RANK_META[code];
              const count = groupedByRank[code]?.length || 0;
              const Icon = meta.icon;
              return (
                <button
                  key={code}
                  type="button"
                  className={`rank-tab-btn is-${code} ${filterRank === code ? 'is-active' : ''}`}
                  onClick={() => setFilterRank(filterRank === code ? 'ALL' : code)}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{meta.name}</span>
                  <span className="rank-tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* 4 Distinct Rank Tier Sections */}
          <div className="rank-tiers-container">
            {displayRankCodes
              .filter((code) => filterRank === 'ALL' || filterRank === code)
              .map((rankCode) => {
                const meta = RANK_META[rankCode];
                const Icon = meta.icon;
                const playersInThisRank = groupedByRank[rankCode] || [];

                return (
                  <section
                    key={rankCode}
                    className={`rank-tier-section is-${rankCode}`}
                    aria-label={`Bậc ${meta.name}`}
                  >
                    {/* Rank Tier Section Header */}
                    <div className="rank-tier-header">
                      <div className="rank-tier-header-left">
                        <div className={`rank-tier-icon-wrap is-${rankCode}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="rank-tier-title-row">
                            <h3 className="rank-tier-title">{meta.name}</h3>
                            <span className="rank-tier-order-tag">BẬC {meta.order}</span>
                            <span className="rank-tier-count-tag">
                              <strong>{playersInThisRank.length}</strong> cầu thủ
                            </span>
                          </div>
                          <p className="rank-tier-desc">{meta.desc}</p>
                        </div>
                      </div>
                    </div>

                    {/* Grid of Players in this Rank */}
                    {playersInThisRank.length > 0 ? (
                      <div className="rank-cards-grid">
                        {playersInThisRank.map((item) => (
                          <PlayerJourneyCardItem
                            key={item.player.player_id}
                            item={item}
                            profile={profileById.get(String(item.player.player_id))}
                            onSelect={setSelectedPlayerId}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="rank-tier-empty">
                        <Icon className="w-7 h-7 opacity-30 mb-1" />
                        <p>
                          {query
                            ? `Không tìm thấy cầu thủ ở bậc ${meta.name} phù hợp với từ khóa "${query}".`
                            : `Hiện tại chưa có cầu thủ nào ở bậc ${meta.name}.`}
                        </p>
                      </div>
                    )}
                  </section>
                );
              })}
          </div>
        </section>
      )}

      {/* Admin Unlock Modal */}
      {loginModal && (
        <div
          className="session-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setPassword('');
              setLoginModal(false);
              setLoginError('');
            }
          }}
        >
          <section
            className="rank-login"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rank-login-title"
          >
            <ShieldCheck className="w-8 h-8 text-red-600 mb-2" />
            <h2 id="rank-login-title">Quyền quản trị hành trình</h2>
            <p>Nhập mật khẩu quản trị hành trình đã cấu hình trên máy chủ để trao bậc và quản lý nhiệm vụ.</p>

            <form onSubmit={handleUnlock}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
                placeholder="Mật khẩu quản trị..."
                aria-label="Mật khẩu quản trị"
              />
              {loginError && (
                <p className="record-error" role="alert">
                  {loginError}
                </p>
              )}
              <div className="rank-modal-actions">
                <button
                  type="button"
                  className="session-secondary-button"
                  onClick={() => {
                    setPassword('');
                    setLoginModal(false);
                    setLoginError('');
                  }}
                  disabled={checking}
                >
                  Hủy
                </button>
                <button className="session-primary-button" disabled={checking}>
                  {checking ? 'Đang kiểm tra...' : 'Mở quyền'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
