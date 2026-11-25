import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Filter,
  Flame,
  Globe,
  HelpCircle,
  Landmark,
  Layers,
  Search,
  Shield,
  Sparkles,
  Swords,
  Target,
  TrendingUp,
  Trophy,
  UserCheck,
  UserMinus,
  Users
} from 'lucide-react';
import { getRecords, recordImageUrl } from '../services/api';
import { getPlayerRecordStatus, isBreakableRecord } from '../services/recordClassification';
import { getRankMeta, RANK_CONFIG } from './PlayerDetail';

const POSITION_GROUPS = {
  FW: { id: 'FW', name: 'Tiền đạo', color: '#e11d48', bg: '#ffe4e6', pos: ['st', 'cf', 'lw', 'rw'] },
  MF: { id: 'MF', name: 'Tiền vệ', color: '#2563eb', bg: '#dbeafe', pos: ['cam', 'cm', 'cdm', 'lm', 'rm'] },
  DF: { id: 'DF', name: 'Hậu vệ', color: '#16a34a', bg: '#dcfce7', pos: ['cb', 'lb', 'rb', 'lwb', 'rwb'] },
  GK: { id: 'GK', name: 'Thủ môn', color: '#d97706', bg: '#fef3c7', pos: ['gk'] }
};

export function getPositionGroup(positions) {
  const posArr = Array.isArray(positions)
    ? positions.map((p) => String(p).toLowerCase().trim())
    : [String(positions || '').toLowerCase().trim()];

  if (posArr.some((p) => POSITION_GROUPS.FW.pos.includes(p))) return 'FW';
  if (posArr.some((p) => POSITION_GROUPS.MF.pos.includes(p))) return 'MF';
  if (posArr.some((p) => POSITION_GROUPS.DF.pos.includes(p))) return 'DF';
  if (posArr.some((p) => POSITION_GROUPS.GK.pos.includes(p))) return 'GK';
  return 'MF';
}

export function resolveNationInfo(playerNation, nations = []) {
  if (!playerNation) return { name: 'Không rõ', flag: '' };

  if (typeof playerNation === 'object') {
    const nid = Number(playerNation.nation_id);
    const found = nations.find((n) => Number(n.nation_id) === nid);
    if (found) {
      return { name: found.name || `Quốc gia #${nid}`, flag: found.flag_url || '' };
    }
    if (playerNation.name) {
      return { name: playerNation.name, flag: playerNation.flag_url || '' };
    }
    return { name: nid ? `Quốc gia #${nid}` : 'Không rõ', flag: '' };
  }

  const str = String(playerNation).trim();
  const found = nations.find(
    (n) => String(n.name).toLowerCase() === str.toLowerCase() || String(n.nation_id) === str
  );
  if (found) {
    return { name: found.name, flag: found.flag_url || '' };
  }
  return { name: str || 'Không rõ', flag: '' };
}

function resolvePlayerImage(player) {
  if (!player) return '';
  const ovr = player.ovr;
  if (player.ovr_images && ovr && player.ovr_images[ovr]) {
    const img = String(player.ovr_images[ovr]);
    return img.startsWith('public/') ? `/${img.slice('public/'.length)}` : img;
  }
  const fallback = player.imageCard?.[0] || player.metadata?.imageCard?.[0] || player.image || '';
  const fallbackStr = String(fallback);
  return fallbackStr.startsWith('public/') ? `/${fallbackStr.slice('public/'.length)}` : fallbackStr;
}

export default function PlayerStatsAnalytics({ players = [], nations = [], onSelectPlayer, onNavigateToRecord }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'positions' | 'nations' | 'records' | 'compare'
  const [records, setRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);

  // Filters for table
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('ovr');
  const [sortOrder, setSortOrder] = useState('desc');

  // Head-to-Head comparison selection
  const [comparePlayerAId, setComparePlayerAId] = useState('');
  const [comparePlayerBId, setComparePlayerBId] = useState('');

  useEffect(() => {
    let active = true;
    getRecords()
      .then((data) => {
        if (active) setRecords(data || []);
      })
      .catch((err) => console.warn('Không thể tải kỷ lục trong phân tích', err))
      .finally(() => {
        if (active) setLoadingRecords(false);
      });
    return () => { active = false; };
  }, []);

  // Set default comparison players
  useEffect(() => {
    if (players.length >= 2 && (!comparePlayerAId || !comparePlayerBId)) {
      setComparePlayerAId(String(players[0].player_id));
      setComparePlayerBId(String(players[1].player_id));
    }
  }, [players, comparePlayerAId, comparePlayerBId]);

  // Enriched players with calculated metrics (purely in-memory, read-only)
  const enrichedPlayers = useMemo(() => {
    return players.map((p) => {
      const stats = p.stats || {};
      const goals = Number(stats.goalAmounts || 0);
      const assists = Number(stats.assistAmounts || 0);
      const matches = Number(stats.match || 0);
      const mvp = Number(stats.bestPlayerAmount || 0);
      const seasons = Number(stats.sessionAmount || 0);
      const wins = Number(stats.wins || 0);
      const draws = Number(stats.draws || 0);
      const losses = Number(stats.losses || 0);
      const goalsAgainst = stats.goalsAgainst != null ? Number(stats.goalsAgainst) : null;
      const cleanSheets = stats.cleanSheets != null ? Number(stats.cleanSheets) : null;

      const totalResultGames = wins + draws + losses;
      const winRate = totalResultGames > 0 ? (wins / totalResultGames) * 100 : null;
      const gaTotal = goals + assists;
      const gaPerMatch = matches > 0 ? (gaTotal / matches).toFixed(2) : '0.00';
      const goalsPerMatch = matches > 0 ? (goals / matches).toFixed(2) : '0.00';
      const assistsPerMatch = matches > 0 ? (assists / matches).toFixed(2) : '0.00';
      const mvpRate = matches > 0 ? ((mvp / matches) * 100).toFixed(1) : '0.0';

      const group = getPositionGroup(p.position);
      const rankCode = p.rank || 'young_talent';
      const rankMeta = getRankMeta(rankCode);
      const nationInfo = resolveNationInfo(p.nation, nations);

      // Honours & records count
      const playerRecordEntries = records
        .map((rec) => {
          const status = getPlayerRecordStatus(rec, p);
          return status ? { record: rec, ...status } : null;
        })
        .filter(Boolean);

      const currentRecordsCount = playerRecordEntries.filter((r) => r.type === 'current').length;
      const achievedRecordsCount = playerRecordEntries.filter((r) => r.type === 'achieved').length;
      const pastRecordsCount = playerRecordEntries.filter((r) => r.type === 'past').length;
      const totalHonours = currentRecordsCount + achievedRecordsCount;

      return {
        ...p,
        calculated: {
          goals,
          assists,
          matches,
          mvp,
          seasons,
          wins,
          draws,
          losses,
          goalsAgainst,
          cleanSheets,
          winRate,
          gaTotal,
          gaPerMatch,
          goalsPerMatch,
          assistsPerMatch,
          mvpRate,
          group,
          rankCode,
          rankMeta,
          nationName: nationInfo.name,
          nationFlag: nationInfo.flag,
          currentRecordsCount,
          achievedRecordsCount,
          pastRecordsCount,
          totalHonours,
          playerRecordEntries
        }
      };
    });
  }, [players, records, nations]);

  // Overall Club KPIs
  const clubKPIs = useMemo(() => {
    const total = enrichedPlayers.length;
    if (total === 0) return null;

    const activeCount = enrichedPlayers.filter((p) => p.is_active !== false).length;
    const deactiveCount = total - activeCount;

    const ovrs = enrichedPlayers.map((p) => Number(p.ovr || 0)).filter((v) => v > 0);
    const avgOvr = ovrs.length ? (ovrs.reduce((a, b) => a + b, 0) / ovrs.length).toFixed(1) : '0';
    const maxOvr = ovrs.length ? Math.max(...ovrs) : 0;
    const minOvr = ovrs.length ? Math.min(...ovrs) : 0;
    const topOvrPlayer = enrichedPlayers.find((p) => Number(p.ovr) === maxOvr);

    const totalGoals = enrichedPlayers.reduce((sum, p) => sum + p.calculated.goals, 0);
    const totalAssists = enrichedPlayers.reduce((sum, p) => sum + p.calculated.assists, 0);
    const totalMatches = enrichedPlayers.reduce((sum, p) => sum + p.calculated.matches, 0);
    const totalMvp = enrichedPlayers.reduce((sum, p) => sum + p.calculated.mvp, 0);

    const topScorer = [...enrichedPlayers].sort((a, b) => b.calculated.goals - a.calculated.goals)[0];
    const topPlaymaker = [...enrichedPlayers].sort((a, b) => b.calculated.assists - a.calculated.assists)[0];
    const mostAppearance = [...enrichedPlayers].sort((a, b) => b.calculated.matches - a.calculated.matches)[0];

    // Win Rate Calculation across players
    const playersWithWinRate = enrichedPlayers.filter((p) => p.calculated.winRate !== null);
    const avgWinRate = playersWithWinRate.length
      ? (playersWithWinRate.reduce((acc, p) => acc + p.calculated.winRate, 0) / playersWithWinRate.length).toFixed(1)
      : null;

    return {
      total,
      activeCount,
      deactiveCount,
      avgOvr,
      maxOvr,
      minOvr,
      topOvrPlayer,
      totalGoals,
      totalAssists,
      totalMatches,
      totalMvp,
      topScorer,
      topPlaymaker,
      mostAppearance,
      avgWinRate
    };
  }, [enrichedPlayers]);

  // Position Groups Breakdown
  const positionAnalysis = useMemo(() => {
    return Object.values(POSITION_GROUPS).map((group) => {
      const groupPlayers = enrichedPlayers.filter((p) => p.calculated.group === group.id);
      const count = groupPlayers.length;
      if (count === 0) {
        return { group, count: 0, avgOvr: 0, goals: 0, assists: 0, matches: 0, topPlayer: null, players: [] };
      }

      const avgOvr = (groupPlayers.reduce((s, p) => s + Number(p.ovr || 0), 0) / count).toFixed(1);
      const goals = groupPlayers.reduce((s, p) => s + p.calculated.goals, 0);
      const assists = groupPlayers.reduce((s, p) => s + p.calculated.assists, 0);
      const matches = groupPlayers.reduce((s, p) => s + p.calculated.matches, 0);
      const topPlayer = [...groupPlayers].sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0) || b.calculated.goals - a.calculated.goals)[0];

      return {
        group,
        count,
        avgOvr,
        goals,
        assists,
        matches,
        topPlayer,
        players: groupPlayers.sort((a, b) => (Number(b.ovr) || 0) - (Number(a.ovr) || 0))
      };
    });
  }, [enrichedPlayers]);

  // Nations Distribution
  const nationsAnalysis = useMemo(() => {
    const map = {};
    enrichedPlayers.forEach((p) => {
      const nationName = p.calculated?.nationName || 'Không rõ';
      const nationFlag = p.calculated?.nationFlag || null;
      if (!map[nationName]) {
        map[nationName] = {
          nation: nationName,
          flag: nationFlag,
          players: [],
          totalGoals: 0,
          totalAssists: 0,
          totalMatches: 0
        };
      }
      map[nationName].players.push(p);
      map[nationName].totalGoals += p.calculated.goals;
      map[nationName].totalAssists += p.calculated.assists;
      map[nationName].totalMatches += p.calculated.matches;
    });

    return Object.values(map)
      .map((item) => {
        const count = item.players.length;
        const avgOvr = count > 0 ? (item.players.reduce((s, p) => s + Number(p.ovr || 0), 0) / count).toFixed(1) : '0';
        const topScorer = [...item.players].sort((a, b) => b.calculated.goals - a.calculated.goals)[0];
        const highestOvr = [...item.players].sort((a, b) => Number(b.ovr || 0) - Number(a.ovr || 0))[0];
        return {
          ...item,
          count,
          avgOvr,
          topScorer,
          highestOvr
        };
      })
      .sort((a, b) => b.count - a.count || b.totalGoals - a.totalGoals);
  }, [enrichedPlayers]);

  // Records & Rank Correlation
  const recordsAnalysis = useMemo(() => {
    const mostHonoursPlayers = [...enrichedPlayers]
      .filter((p) => p.calculated.totalHonours > 0 || p.calculated.pastRecordsCount > 0)
      .sort((a, b) => b.calculated.totalHonours - a.calculated.totalHonours || b.calculated.currentRecordsCount - a.calculated.currentRecordsCount);

    const rankTiers = Object.entries(RANK_CONFIG).map(([code, meta]) => {
      const tierPlayers = enrichedPlayers.filter((p) => p.calculated.rankCode === code);
      const count = tierPlayers.length;
      const avgOvr = count > 0 ? (tierPlayers.reduce((s, p) => s + Number(p.ovr || 0), 0) / count).toFixed(1) : 0;
      const totalGoals = tierPlayers.reduce((s, p) => s + p.calculated.goals, 0);
      const totalAssists = tierPlayers.reduce((s, p) => s + p.calculated.assists, 0);
      return {
        code,
        meta,
        count,
        avgOvr,
        totalGoals,
        totalAssists,
        players: tierPlayers
      };
    });

    return {
      mostHonoursPlayers,
      rankTiers
    };
  }, [enrichedPlayers]);

  // Filtered & Sorted Players Table
  const filteredTablePlayers = useMemo(() => {
    let list = [...enrichedPlayers];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.calculated?.nationName && p.calculated.nationName.toLowerCase().includes(q))
      );
    }

    if (posFilter !== 'all') {
      list = list.filter((p) => p.calculated.group === posFilter);
    }

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      list = list.filter((p) => (p.is_active !== false) === isActive);
    }

    list.sort((a, b) => {
      let valA, valB;
      switch (sortBy) {
        case 'name':
          valA = a.name;
          valB = b.name;
          return sortOrder === 'asc' ? valA.localeCompare(valB, 'vi') : valB.localeCompare(valA, 'vi');
        case 'ovr':
          valA = Number(a.ovr || 0);
          valB = Number(b.ovr || 0);
          break;
        case 'goals':
          valA = a.calculated.goals;
          valB = b.calculated.goals;
          break;
        case 'assists':
          valA = a.calculated.assists;
          valB = b.calculated.assists;
          break;
        case 'ga':
          valA = a.calculated.gaTotal;
          valB = b.calculated.gaTotal;
          break;
        case 'matches':
          valA = a.calculated.matches;
          valB = b.calculated.matches;
          break;
        case 'mvp':
          valA = a.calculated.mvp;
          valB = b.calculated.mvp;
          break;
        case 'winrate':
          valA = a.calculated.winRate != null ? a.calculated.winRate : -1;
          valB = b.calculated.winRate != null ? b.calculated.winRate : -1;
          break;
        case 'honours':
          valA = a.calculated.totalHonours;
          valB = b.calculated.totalHonours;
          break;
        default:
          valA = Number(a.ovr || 0);
          valB = Number(b.ovr || 0);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [enrichedPlayers, search, posFilter, statusFilter, sortBy, sortOrder]);

  // Head-to-Head Comparison
  const playerA = useMemo(() => enrichedPlayers.find((p) => String(p.player_id) === String(comparePlayerAId)), [enrichedPlayers, comparePlayerAId]);
  const playerB = useMemo(() => enrichedPlayers.find((p) => String(p.player_id) === String(comparePlayerBId)), [enrichedPlayers, comparePlayerBId]);

  if (players.length === 0) {
    return (
      <div className="analytics-page">
        <div className="analytics-empty-state">
          <BarChart2 size={48} className="analytics-empty-icon" />
          <h2>Đang tải dữ liệu số liệu cầu thủ...</h2>
          <p>Hệ thống đang đồng bộ danh sách cầu thủ và số liệu thi đấu.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-page">
      {/* Header Banner */}
      <section className="analytics-hero">
        <div className="analytics-hero-copy">
          <span className="session-eyebrow">S T A T I S T I C S &nbsp; & &nbsp; A N A L Y T I C S</span>
          <h1>Thống kê & Phân tích chuyên sâu</h1>
          <p>
            Bảng điều khiển số liệu toàn diện câu lạc bộ Ajax — Khai phá chỉ số, phân bổ vị trí, quốc gia và kỷ lục cá nhân.
          </p>
        </div>

        {/* Global KPI Cards */}
        {clubKPIs && (
          <div className="analytics-kpi-grid">
            <div className="analytics-kpi-card">
              <div className="analytics-kpi-icon is-red"><Users size={20} /></div>
              <div className="analytics-kpi-content">
                <span className="analytics-kpi-label">Quy mô đội hình</span>
                <strong className="analytics-kpi-value">{clubKPIs.total} <small>cầu thủ</small></strong>
                <span className="analytics-kpi-sub">
                  <span className="text-emerald-600 font-bold">{clubKPIs.activeCount} Active</span> · {clubKPIs.deactiveCount} DeActive
                </span>
              </div>
            </div>

            <div className="analytics-kpi-card">
              <div className="analytics-kpi-icon is-amber"><Award size={20} /></div>
              <div className="analytics-kpi-content">
                <span className="analytics-kpi-label">Điểm OVR trung bình</span>
                <strong className="analytics-kpi-value">{clubKPIs.avgOvr}</strong>
                <span className="analytics-kpi-sub">
                  Cao nhất: <strong>{clubKPIs.maxOvr}</strong> ({clubKPIs.topOvrPlayer?.name || '—'})
                </span>
              </div>
            </div>

            <div className="analytics-kpi-card">
              <div className="analytics-kpi-icon is-rose"><Target size={20} /></div>
              <div className="analytics-kpi-content">
                <span className="analytics-kpi-label">Tổng bàn thắng & KT</span>
                <strong className="analytics-kpi-value">{clubKPIs.totalGoals} <small>bàn</small></strong>
                <span className="analytics-kpi-sub">
                  {clubKPIs.totalAssists} kiến tạo · {clubKPIs.topScorer ? `${clubKPIs.topScorer.name} (${clubKPIs.topScorer.calculated?.goals || 0}⚽)` : '—'}
                </span>
              </div>
            </div>

            <div className="analytics-kpi-card">
              <div className="analytics-kpi-icon is-blue"><Activity size={20} /></div>
              <div className="analytics-kpi-content">
                <span className="analytics-kpi-label">Tổng trận đấu & Tỷ lệ thắng</span>
                <strong className="analytics-kpi-value">{clubKPIs.totalMatches} <small>trận</small></strong>
                <span className="analytics-kpi-sub">
                  {clubKPIs.avgWinRate ? `Win rate TB: ${clubKPIs.avgWinRate}%` : `${clubKPIs.totalMvp} danh hiệu MVP`}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Analytics Tab Switcher */}
      <div className="analytics-tab-bar">
        <button
          type="button"
          className={`analytics-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart2 size={16} />
          <span>Tổng quan & Bảng vàng</span>
        </button>

        <button
          type="button"
          className={`analytics-tab-btn ${activeTab === 'positions' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('positions')}
        >
          <Layers size={16} />
          <span>Phân tích theo Vị trí</span>
        </button>

        <button
          type="button"
          className={`analytics-tab-btn ${activeTab === 'nations' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('nations')}
        >
          <Globe size={16} />
          <span>Bản đồ Quốc gia</span>
        </button>

        <button
          type="button"
          className={`analytics-tab-btn ${activeTab === 'records' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <Trophy size={16} />
          <span>Kỷ lục & Thăng hạng</span>
        </button>

        <button
          type="button"
          className={`analytics-tab-btn ${activeTab === 'compare' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('compare')}
        >
          <Swords size={16} />
          <span>So sánh đối đầu 1v1</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: TỔNG QUAN & BẢNG VÀNG CÁ NHÂN                                     */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="analytics-tab-content">
          {/* Top Leaderboards 4-grid */}
          <div className="analytics-section-heading">
            <div>
              <span className="session-eyebrow">H A L L &nbsp; O F &nbsp; L E A D E R S</span>
              <h2>Bảng vàng thành tích cá nhân</h2>
              <p>Top cầu thủ dẫn đầu các chỉ số quan trọng nhất trong lịch sử câu lạc bộ.</p>
            </div>
          </div>

          <div className="analytics-leaderboard-grid">
            {/* Top Scorers */}
            <div className="analytics-leaderboard-card">
              <div className="analytics-lb-header">
                <div className="analytics-lb-title">
                  <Target size={18} className="text-rose-600" />
                  <strong>Top Chân sút vĩ đại</strong>
                </div>
                <small>Bàn thắng</small>
              </div>
              <div className="analytics-lb-list">
                {[...enrichedPlayers]
                  .sort((a, b) => b.calculated.goals - a.calculated.goals)
                  .slice(0, 5)
                  .map((p, idx) => (
                    <div
                      key={p.player_id}
                      className="analytics-lb-row is-clickable"
                      onClick={() => onSelectPlayer && onSelectPlayer(p)}
                      title="Xem chi tiết cầu thủ"
                    >
                      <span className={`analytics-lb-rank is-rank-${idx + 1}`}>{idx + 1}</span>
                      <img src={resolvePlayerImage(p) || '/RankImages/young_talent.png'} alt="" className="analytics-lb-avatar" />
                      <div className="analytics-lb-name-col">
                        <strong>{p.name}</strong>
                        <small>{p.position?.[0] || '—'} · OVR {p.ovr}</small>
                      </div>
                      <div className="analytics-lb-stat-col">
                        <strong className="text-rose-600">{p.calculated.goals}</strong>
                        <small>{p.calculated.goalsPerMatch} / trận</small>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Top Assists */}
            <div className="analytics-leaderboard-card">
              <div className="analytics-lb-header">
                <div className="analytics-lb-title">
                  <Flame size={18} className="text-amber-600" />
                  <strong>Top Vua kiến tạo</strong>
                </div>
                <small>Kiến tạo</small>
              </div>
              <div className="analytics-lb-list">
                {[...enrichedPlayers]
                  .sort((a, b) => b.calculated.assists - a.calculated.assists)
                  .slice(0, 5)
                  .map((p, idx) => (
                    <div
                      key={p.player_id}
                      className="analytics-lb-row is-clickable"
                      onClick={() => onSelectPlayer && onSelectPlayer(p)}
                      title="Xem chi tiết cầu thủ"
                    >
                      <span className={`analytics-lb-rank is-rank-${idx + 1}`}>{idx + 1}</span>
                      <img src={resolvePlayerImage(p) || '/RankImages/young_talent.png'} alt="" className="analytics-lb-avatar" />
                      <div className="analytics-lb-name-col">
                        <strong>{p.name}</strong>
                        <small>{p.position?.[0] || '—'} · OVR {p.ovr}</small>
                      </div>
                      <div className="analytics-lb-stat-col">
                        <strong className="text-amber-600">{p.calculated.assists}</strong>
                        <small>{p.calculated.assistsPerMatch} / trận</small>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Top MVPs */}
            <div className="analytics-leaderboard-card">
              <div className="analytics-lb-header">
                <div className="analytics-lb-title">
                  <Trophy size={18} className="text-yellow-600" />
                  <strong>Cầu thủ xuất sắc (MVP)</strong>
                </div>
                <small>MVP trận</small>
              </div>
              <div className="analytics-lb-list">
                {[...enrichedPlayers]
                  .sort((a, b) => b.calculated.mvp - a.calculated.mvp)
                  .slice(0, 5)
                  .map((p, idx) => (
                    <div
                      key={p.player_id}
                      className="analytics-lb-row is-clickable"
                      onClick={() => onSelectPlayer && onSelectPlayer(p)}
                      title="Xem chi tiết cầu thủ"
                    >
                      <span className={`analytics-lb-rank is-rank-${idx + 1}`}>{idx + 1}</span>
                      <img src={resolvePlayerImage(p) || '/RankImages/young_talent.png'} alt="" className="analytics-lb-avatar" />
                      <div className="analytics-lb-name-col">
                        <strong>{p.name}</strong>
                        <small>{p.calculated.matches} trận đấu</small>
                      </div>
                      <div className="analytics-lb-stat-col">
                        <strong className="text-yellow-600">{p.calculated.mvp}</strong>
                        <small>{p.calculated.mvpRate}% MVP</small>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Top Defense / Clean Sheets */}
            <div className="analytics-leaderboard-card">
              <div className="analytics-lb-header">
                <div className="analytics-lb-title">
                  <Shield size={18} className="text-emerald-600" />
                  <strong>Lá chắn phòng ngự</strong>
                </div>
                <small>Giữ sạch lưới</small>
              </div>
              <div className="analytics-lb-list">
                {[...enrichedPlayers]
                  .filter((p) => p.calculated.cleanSheets != null || p.calculated.group === 'DF' || p.calculated.group === 'GK')
                  .sort((a, b) => (b.calculated.cleanSheets || 0) - (a.calculated.cleanSheets || 0))
                  .slice(0, 5)
                  .map((p, idx) => (
                    <div
                      key={p.player_id}
                      className="analytics-lb-row is-clickable"
                      onClick={() => onSelectPlayer && onSelectPlayer(p)}
                      title="Xem chi tiết cầu thủ"
                    >
                      <span className={`analytics-lb-rank is-rank-${idx + 1}`}>{idx + 1}</span>
                      <img src={resolvePlayerImage(p) || '/RankImages/young_talent.png'} alt="" className="analytics-lb-avatar" />
                      <div className="analytics-lb-name-col">
                        <strong>{p.name}</strong>
                        <small>{p.position?.[0] || 'DF'} · {p.calculated.matches} trận</small>
                      </div>
                      <div className="analytics-lb-stat-col">
                        <strong className="text-emerald-600">{p.calculated.cleanSheets ?? '—'}</strong>
                        <small>{p.calculated.goalsAgainst != null ? `${p.calculated.goalsAgainst} thua` : '—'}</small>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Full Interactive Players Table */}
          <section className="analytics-table-panel">
            <div className="analytics-table-toolbar">
              <div className="analytics-table-heading">
                <h3>Bảng chi tiết toàn bộ cầu thủ ({filteredTablePlayers.length})</h3>
                <p>Nhấn vào tiêu đề cột để sắp xếp, hoặc nhấn vào tên cầu thủ để chuyển tới trang chỉnh sửa.</p>
              </div>

              <div className="analytics-table-filters">
                {/* Search */}
                <div className="analytics-search-input">
                  <Search size={15} />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tìm theo tên hoặc quốc gia..."
                  />
                </div>

                {/* Position Group Filter */}
                <select
                  value={posFilter}
                  onChange={(e) => setPosFilter(e.target.value)}
                  className="analytics-select-filter"
                >
                  <option value="all">Tất cả vị trí</option>
                  <option value="FW">Tiền đạo (FW)</option>
                  <option value="MF">Tiền vệ (MF)</option>
                  <option value="DF">Hậu vệ (DF)</option>
                  <option value="GK">Thủ môn (GK)</option>
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="analytics-select-filter"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="active">Đang hoạt động</option>
                  <option value="deactive">Dự bị / DeActive</option>
                </select>
              </div>
            </div>

            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th onClick={() => { setSortBy('name'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }}>
                      Cầu thủ {sortBy === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th>Vị trí</th>
                    <th>Quốc gia</th>
                    <th onClick={() => { setSortBy('ovr'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }} className="text-center">
                      OVR {sortBy === 'ovr' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => { setSortBy('goals'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }} className="text-center">
                      Bàn thắng {sortBy === 'goals' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => { setSortBy('assists'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }} className="text-center">
                      Kiến tạo {sortBy === 'assists' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => { setSortBy('ga'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }} className="text-center">
                      G + A {sortBy === 'ga' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => { setSortBy('matches'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }} className="text-center">
                      Trận {sortBy === 'matches' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => { setSortBy('mvp'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }} className="text-center">
                      MVP {sortBy === 'mvp' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => { setSortBy('winrate'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }} className="text-center">
                      Win % {sortBy === 'winrate' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th onClick={() => { setSortBy('honours'); setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc')); }} className="text-center">
                      Kỷ lục {sortBy === 'honours' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                    </th>
                    <th>Bậc thăng hạng</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTablePlayers.map((p) => {
                    const groupMeta = POSITION_GROUPS[p.calculated.group] || POSITION_GROUPS.MF;
                    return (
                      <tr key={p.player_id}>
                        <td>
                          <div
                            className="analytics-player-cell is-clickable"
                            onClick={() => onSelectPlayer && onSelectPlayer(p)}
                            title="Mở chi tiết cầu thủ"
                          >
                            <img src={resolvePlayerImage(p) || '/RankImages/young_talent.png'} alt="" className="analytics-cell-avatar" />
                            <div>
                              <strong>{p.name}</strong>
                              <small className={p.is_active === false ? 'text-amber-600' : 'text-emerald-600'}>
                                {p.is_active === false ? 'DeActive' : 'Active'}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="analytics-pos-badge" style={{ color: groupMeta.color, background: groupMeta.bg }}>
                            {Array.isArray(p.position) ? p.position.join(' · ').toUpperCase() : p.position || '—'}
                          </span>
                        </td>
                        <td>
                          <span className="analytics-nation-tag">{p.calculated?.nationName || '—'}</span>
                        </td>
                        <td className="text-center">
                          <strong className="analytics-ovr-pill">{p.ovr || '—'}</strong>
                        </td>
                        <td className="text-center font-bold text-rose-600">
                          {p.calculated.goals}
                        </td>
                        <td className="text-center font-bold text-amber-600">
                          {p.calculated.assists}
                        </td>
                        <td className="text-center font-bold text-indigo-600">
                          {p.calculated.gaTotal}
                        </td>
                        <td className="text-center font-semibold text-slate-700">
                          {p.calculated.matches}
                        </td>
                        <td className="text-center text-yellow-600 font-bold">
                          {p.calculated.mvp}
                        </td>
                        <td className="text-center">
                          {p.calculated.winRate != null ? (
                            <span className={`analytics-winrate-tag ${p.calculated.winRate >= 60 ? 'is-high' : ''}`}>
                              {p.calculated.winRate.toFixed(0)}%
                            </span>
                          ) : '—'}
                        </td>
                        <td className="text-center">
                          {p.calculated.totalHonours > 0 ? (
                            <span className="analytics-honours-pill">
                              🏆 {p.calculated.totalHonours}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <span className={`analytics-rank-badge ${p.calculated.rankMeta.badgeClass}`}>
                            {p.calculated.rankMeta.icon} {p.calculated.rankMeta.name}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PHÂN TÍCH THEO VỊ TRÍ                                             */}
      {/* ========================================================================= */}
      {activeTab === 'positions' && (
        <div className="analytics-tab-content">
          <div className="analytics-section-heading">
            <div>
              <span className="session-eyebrow">P O S I T I O N &nbsp; M A T R I X</span>
              <h2>Phân tích hiệu suất theo Vị trí thi đấu</h2>
              <p>Đối chiếu sức mạnh, số lượng bàn thắng, kiến tạo và độ phủ sóng giữa các tuyến.</p>
            </div>
          </div>

          <div className="analytics-positions-grid">
            {positionAnalysis.map(({ group, count, avgOvr, goals, assists, matches, topPlayer, players: groupPlayers }) => (
              <div key={group.id} className="analytics-position-card" style={{ borderTopColor: group.color }}>
                <div className="analytics-pos-card-header">
                  <div className="analytics-pos-card-title">
                    <span className="analytics-pos-badge" style={{ color: group.color, background: group.bg }}>
                      {group.id}
                    </span>
                    <h3>{group.name}</h3>
                  </div>
                  <span className="analytics-pos-count">{count} cầu thủ</span>
                </div>

                <div className="analytics-pos-stats-row">
                  <div className="analytics-pos-stat-item">
                    <span>OVR TB</span>
                    <strong>{avgOvr}</strong>
                  </div>
                  <div className="analytics-pos-stat-item">
                    <span>Bàn thắng</span>
                    <strong className="text-rose-600">{goals}</strong>
                  </div>
                  <div className="analytics-pos-stat-item">
                    <span>Kiến tạo</span>
                    <strong className="text-amber-600">{assists}</strong>
                  </div>
                  <div className="analytics-pos-stat-item">
                    <span>Tổng trận</span>
                    <strong>{matches}</strong>
                  </div>
                </div>

                {topPlayer && (
                  <div className="analytics-pos-top-performer">
                    <span className="analytics-pos-top-label">Gương mặt tiêu biểu:</span>
                    <div
                      className="analytics-pos-top-box is-clickable"
                      onClick={() => onSelectPlayer && onSelectPlayer(topPlayer)}
                    >
                      <img src={resolvePlayerImage(topPlayer) || '/RankImages/young_talent.png'} alt="" />
                      <div>
                        <strong>{topPlayer.name}</strong>
                        <small>OVR {topPlayer.ovr} · {topPlayer.calculated.goals}⚽ · {topPlayer.calculated.assists}🅰️</small>
                      </div>
                    </div>
                  </div>
                )}

                <div className="analytics-pos-players-sublist">
                  <span className="analytics-pos-sublist-title">Danh sách trong tuyến ({groupPlayers.length}):</span>
                  <div className="analytics-pos-chip-list">
                    {groupPlayers.map((p) => (
                      <span
                        key={p.player_id}
                        className="analytics-pos-chip is-clickable"
                        onClick={() => onSelectPlayer && onSelectPlayer(p)}
                        title={`Xem chi tiết ${p.name}`}
                      >
                        {p.name} <small>({p.ovr})</small>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BẢN ĐỒ QUỐC GIA                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'nations' && (
        <div className="analytics-tab-content">
          <div className="analytics-section-heading">
            <div>
              <span className="session-eyebrow">G L O B A L &nbsp; P R E S E N C E</span>
              <h2>Bản đồ Quốc gia & Đại diện quốc tế</h2>
              <p>Đội hình câu lạc bộ Ajax hội tụ {nationsAnalysis.length} quốc gia trên toàn thế giới.</p>
            </div>
          </div>

          <div className="analytics-nations-grid">
            {nationsAnalysis.map((item) => (
              <div key={item.nation} className="analytics-nation-card">
                <div className="analytics-nation-card-header">
                  <div className="analytics-nation-name-box">
                    {item.flag ? (
                      <img src={item.flag} alt="" className="analytics-nation-flag-img" />
                    ) : (
                      <Globe size={22} className="text-slate-400" />
                    )}
                    <h3>{item.nation}</h3>
                  </div>
                  <span className="analytics-nation-count-badge">{item.count} cầu thủ</span>
                </div>

                <div className="analytics-nation-stats-row">
                  <div>
                    <span>OVR TB:</span>
                    <strong>{item.avgOvr}</strong>
                  </div>
                  <div>
                    <span>Tổng bàn:</span>
                    <strong className="text-rose-600">{item.totalGoals}</strong>
                  </div>
                  <div>
                    <span>Tổng trận:</span>
                    <strong>{item.totalMatches}</strong>
                  </div>
                </div>

                <div className="analytics-nation-highlights">
                  {item.highestOvr && (
                    <div className="analytics-nation-highlight-line">
                      <span>OVR cao nhất:</span>
                      <strong>{item.highestOvr.name} ({item.highestOvr.ovr})</strong>
                    </div>
                  )}
                  {item.topScorer && item.topScorer.calculated.goals > 0 && (
                    <div className="analytics-nation-highlight-line">
                      <span>Cầu thủ ghi bàn số 1:</span>
                      <strong>{item.topScorer.name} ({item.topScorer.calculated.goals}⚽)</strong>
                    </div>
                  )}
                </div>

                <div className="analytics-nation-player-tags">
                  {item.players.map((p) => (
                    <span
                      key={p.player_id}
                      className="analytics-nation-chip is-clickable"
                      onClick={() => onSelectPlayer && onSelectPlayer(p)}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: KỶ LỤC & TƯƠNG QUAN BẬC THĂNG HẠNG                                 */}
      {/* ========================================================================= */}
      {activeTab === 'records' && (
        <div className="analytics-tab-content">
          <div className="analytics-section-heading">
            <div>
              <span className="session-eyebrow">H O N O U R S &nbsp; & &nbsp; R A N K S</span>
              <h2>Kỷ lục, Danh hiệu & Tương quan Thăng hạng</h2>
              <p>Mối liên hệ giữa bậc phát triển, mức độ cống hiến và các danh hiệu bất tử.</p>
            </div>
          </div>

          {/* Rank Tiers Breakdown */}
          <div className="analytics-ranks-grid">
            {recordsAnalysis.rankTiers.map(({ code, meta, count, avgOvr, totalGoals, totalAssists, players: tierPlayers }) => (
              <div key={code} className="analytics-rank-tier-card">
                <div className="analytics-rank-tier-header">
                  <span className="analytics-rank-tier-icon">{meta.icon}</span>
                  <div>
                    <h4>{meta.name}</h4>
                    <small>{count} cầu thủ</small>
                  </div>
                  <strong className="analytics-rank-tier-ovr">TB {avgOvr}</strong>
                </div>

                <div className="analytics-rank-tier-body">
                  <div className="analytics-rank-tier-stats">
                    <span>Đóng góp: <strong>{totalGoals}</strong> bàn · <strong>{totalAssists}</strong> kiến tạo</span>
                  </div>
                  <div className="analytics-rank-tier-chips">
                    {tierPlayers.map((p) => (
                      <span
                        key={p.player_id}
                        className="analytics-rank-chip is-clickable"
                        onClick={() => onSelectPlayer && onSelectPlayer(p)}
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Top Most Decorated Players */}
          <div className="analytics-decorated-panel">
            <h3>Top Cầu thủ sở hữu nhiều Kỷ lục & Danh hiệu nhất</h3>
            <div className="analytics-decorated-grid">
              {recordsAnalysis.mostHonoursPlayers.map((p) => (
                <div key={p.player_id} className="analytics-decorated-card">
                  <div className="analytics-dec-header">
                    <img src={resolvePlayerImage(p) || '/RankImages/young_talent.png'} alt="" className="analytics-dec-avatar" />
                    <div>
                      <strong className="analytics-dec-name">{p.name}</strong>
                      <span className={`analytics-rank-badge ${p.calculated.rankMeta.badgeClass}`}>
                        {p.calculated.rankMeta.icon} {p.calculated.rankMeta.name}
                      </span>
                    </div>
                    <div className="analytics-dec-total-badge">
                      🏆 {p.calculated.totalHonours} danh hiệu
                    </div>
                  </div>

                  <div className="analytics-dec-list">
                    {p.calculated.playerRecordEntries.map(({ record, type, label }) => (
                      <div
                        key={record.record_id}
                        className={`analytics-dec-entry is-${type} is-clickable`}
                        onClick={() => onNavigateToRecord && onNavigateToRecord(record.record_id)}
                        title="Xem trong Ngôi đền huyền thoại"
                      >
                        <span className="analytics-dec-entry-badge">
                          {type === 'current' ? '👑 Đang giữ' : type === 'achieved' ? '✨ Đã đạt' : '⏳ Từng giữ'}
                        </span>
                        <span className="analytics-dec-entry-name">{record.name}</span>
                        {record.award_name && <small>({record.award_name})</small>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: SO SÁNH ĐỐI ĐẦU 1V1 (HEAD-TO-HEAD)                                 */}
      {/* ========================================================================= */}
      {activeTab === 'compare' && (
        <div className="analytics-tab-content">
          <div className="analytics-section-heading">
            <div>
              <span className="session-eyebrow">H E A D &nbsp; T O &nbsp; H E A D</span>
              <h2>So sánh đối đầu trực diện 1v1</h2>
              <p>Chọn 2 cầu thủ bất kỳ trong đội hình để cân đo từng chỉ số chi tiết.</p>
            </div>
          </div>

          {/* Comparison Selector Bar */}
          <div className="analytics-compare-selectors">
            <div className="analytics-compare-selector-box">
              <label htmlFor="compare-a-select">Cầu thủ A:</label>
              <select
                id="compare-a-select"
                value={comparePlayerAId}
                onChange={(e) => setComparePlayerAId(e.target.value)}
              >
                {enrichedPlayers.map((p) => (
                  <option key={p.player_id} value={p.player_id} disabled={String(p.player_id) === String(comparePlayerBId)}>
                    {p.name} (OVR {p.ovr} · {p.position?.[0] || '—'})
                  </option>
                ))}
              </select>
            </div>

            <div className="analytics-compare-vs-badge">
              <Swords size={20} />
              <span>VS</span>
            </div>

            <div className="analytics-compare-selector-box">
              <label htmlFor="compare-b-select">Cầu thủ B:</label>
              <select
                id="compare-b-select"
                value={comparePlayerBId}
                onChange={(e) => setComparePlayerBId(e.target.value)}
              >
                {enrichedPlayers.map((p) => (
                  <option key={p.player_id} value={p.player_id} disabled={String(p.player_id) === String(comparePlayerAId)}>
                    {p.name} (OVR {p.ovr} · {p.position?.[0] || '—'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {playerA && playerB ? (
            <div className="analytics-compare-arena">
              {/* Profile Cards Header */}
              <div className="analytics-compare-profiles">
                <div className="analytics-compare-card is-player-a">
                  <img src={resolvePlayerImage(playerA) || '/RankImages/young_talent.png'} alt="" className="analytics-compare-img" />
                  <h3>{playerA.name}</h3>
                  <div className="analytics-compare-meta">
                    {playerA.calculated?.nationFlag && (
                      <img src={playerA.calculated.nationFlag} alt="" className="analytics-compare-flag" />
                    )}
                    <span>{playerA.calculated?.nationName || '—'}</span>
                    <span>·</span>
                    <span>{Array.isArray(playerA.position) ? playerA.position.join(' · ').toUpperCase() : playerA.position || '—'}</span>
                  </div>
                  <strong className="analytics-compare-ovr-big">{playerA.ovr}</strong>
                  <span className={`analytics-rank-badge ${playerA.calculated.rankMeta.badgeClass}`}>
                    {playerA.calculated.rankMeta.icon} {playerA.calculated.rankMeta.name}
                  </span>
                </div>

                <div className="analytics-compare-card is-player-b">
                  <img src={resolvePlayerImage(playerB) || '/RankImages/young_talent.png'} alt="" className="analytics-compare-img" />
                  <h3>{playerB.name}</h3>
                  <div className="analytics-compare-meta">
                    {playerB.calculated?.nationFlag && (
                      <img src={playerB.calculated.nationFlag} alt="" className="analytics-compare-flag" />
                    )}
                    <span>{playerB.calculated?.nationName || '—'}</span>
                    <span>·</span>
                    <span>{Array.isArray(playerB.position) ? playerB.position.join(' · ').toUpperCase() : playerB.position || '—'}</span>
                  </div>
                  <strong className="analytics-compare-ovr-big">{playerB.ovr}</strong>
                  <span className={`analytics-rank-badge ${playerB.calculated.rankMeta.badgeClass}`}>
                    {playerB.calculated.rankMeta.icon} {playerB.calculated.rankMeta.name}
                  </span>
                </div>
              </div>

              {/* Comparative Metrics Bars */}
              <div className="analytics-compare-metrics-list">
                {[
                  { label: 'Điểm OVR', valA: Number(playerA.ovr || 0), valB: Number(playerB.ovr || 0) },
                  { label: 'Bàn thắng (Goals)', valA: playerA.calculated.goals, valB: playerB.calculated.goals },
                  { label: 'Kiến tạo (Assists)', valA: playerA.calculated.assists, valB: playerB.calculated.assists },
                  { label: 'Tổng G + A', valA: playerA.calculated.gaTotal, valB: playerB.calculated.gaTotal },
                  { label: 'Số trận đấu', valA: playerA.calculated.matches, valB: playerB.calculated.matches },
                  { label: 'Hiệu suất G+A / Trận', valA: parseFloat(playerA.calculated.gaPerMatch), valB: parseFloat(playerB.calculated.gaPerMatch) },
                  { label: 'Danh hiệu MVP', valA: playerA.calculated.mvp, valB: playerB.calculated.mvp },
                  { label: 'Số mùa giải tham gia', valA: playerA.calculated.seasons, valB: playerB.calculated.seasons },
                  {
                    label: 'Tỷ lệ thắng (Win Rate %)',
                    valA: playerA.calculated.winRate != null ? parseFloat(playerA.calculated.winRate.toFixed(1)) : 0,
                    valB: playerB.calculated.winRate != null ? parseFloat(playerB.calculated.winRate.toFixed(1)) : 0,
                    suffix: '%'
                  },
                  { label: 'Kỷ lục & Danh hiệu đạt được', valA: playerA.calculated.totalHonours, valB: playerB.calculated.totalHonours }
                ].map(({ label, valA, valB, suffix = '' }) => {
                  const max = Math.max(valA, valB, 1);
                  const pctA = Math.min((valA / max) * 100, 100);
                  const pctB = Math.min((valB / max) * 100, 100);
                  const aWins = valA > valB;
                  const bWins = valB > valA;

                  return (
                    <div key={label} className="analytics-compare-row">
                      <div className={`analytics-compare-val is-left ${aWins ? 'is-winner' : ''}`}>
                        {valA}{suffix}
                      </div>

                      <div className="analytics-compare-bar-container">
                        <div className="analytics-compare-label">{label}</div>
                        <div className="analytics-compare-dual-bar">
                          <div className="analytics-bar-track is-left">
                            <div
                              className={`analytics-bar-fill is-a ${aWins ? 'is-superior' : ''}`}
                              style={{ width: `${pctA}%` }}
                            />
                          </div>
                          <div className="analytics-bar-track is-right">
                            <div
                              className={`analytics-bar-fill is-b ${bWins ? 'is-superior' : ''}`}
                              style={{ width: `${pctB}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className={`analytics-compare-val is-right ${bWins ? 'is-winner' : ''}`}>
                        {valB}{suffix}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="analytics-empty">Vui lòng chọn 2 cầu thủ để so sánh.</div>
          )}
        </div>
      )}
    </div>
  );
}
