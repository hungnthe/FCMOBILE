import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import PlayerTable from './components/PlayerTable';
import Awards from './components/Awards';
import PlayerModal from './components/PlayerModal';
import PlayerDetail from './components/PlayerDetail';
import Sessions from './components/Sessions';
import Programs from './components/Programs';
import Legends from './components/Legends';

import {
  getPlayers,
  getNations,
  getImageCards,
  getSessions,
  getDashboardStats,
  createPlayer,
  updatePlayer,
  deletePlayer,
  createSession,
  updateSession,
  deleteSession,
  removeSessionPlayer,
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  recalculatePlayerStats
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'players' | 'programs' | 'sessions' | 'awards' | 'legends'
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Players state
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playersApiUnavailable, setPlayersApiUnavailable] = useState(false);
  const [nations, setNations] = useState([]);
  const [imageCards, setImageCards] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [masterPlayers, setMasterPlayers] = useState([]);
  const [programs, setPrograms] = useState([]);

  // Filters state
  const [search, setSearch] = useState('');
  const [cardTypeFilter, setCardTypeFilter] = useState('ALL');
  const [positionFilter, setPositionFilter] = useState('ALL');
  const [nationFilter, setNationFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('rating');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [playerToEdit, setPlayerToEdit] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [isCreatingPlayer, setIsCreatingPlayer] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);

  // Toast notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Load Dashboard Data
  const loadDashboard = async () => {
    setLoadingStats(true);
    try {
      const stats = await getDashboardStats();
      setDashboardStats(stats);
    } catch (err) {
      console.warn('Dashboard API unavailable; showing local preview data.', err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Load Squad Players Data
  const loadPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const data = await getPlayers({
        search,
        cardType: cardTypeFilter,
        position: positionFilter,
        nation: nationFilter,
        sortBy
      });
      setPlayers(data);
      setPlayersApiUnavailable(false);
    } catch (err) {
      console.warn('Players API unavailable; showing local preview data.', err);
      setPlayersApiUnavailable(true);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const loadSessions = async () => {
    try {
      setSessions(await getSessions());
    } catch (err) {
      console.warn('Sessions API unavailable.', err);
    }
  };

  const loadMasterPlayers = async () => {
    try {
      setMasterPlayers(await getPlayers({ sortBy: 'rating' }));
    } catch (err) {
      console.warn('Master players unavailable for season relationships.', err);
    }
  };

  const loadPrograms = async () => {
    try { setPrograms(await getPrograms()); } catch (err) { console.warn('Programs API unavailable.', err); }
  };

  useEffect(() => {
    loadDashboard();
    loadPlayers();
    getNations().then(setNations).catch((err) => console.warn('Nations API unavailable.', err));
    getImageCards().then(setImageCards).catch((err) => console.warn('Image cards API unavailable.', err));
    loadSessions();
    loadMasterPlayers();
    loadPrograms();
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboard();
    }
    if (activeTab === 'players' || activeTab === 'awards') {
      loadPlayers();
    }
    if (activeTab === 'sessions') {
      loadSessions();
    }
    if (activeTab === 'programs') {
      loadPrograms();
      loadMasterPlayers();
    }
  }, [activeTab, search, cardTypeFilter, positionFilter, nationFilter, sortBy]);

  const handleCreateProgram = async (data) => { try { await createProgram(data); await loadPrograms(); showToast('Đã tạo chương trình!'); } catch (err) { showToast(err.response?.data?.error || 'Không thể tạo chương trình', 'error'); throw err; } };
  const handleUpdateProgram = async (id, data) => { try { await updateProgram(id, data); await loadPrograms(); showToast('Đã cập nhật chương trình!'); } catch (err) { showToast(err.response?.data?.error || 'Không thể cập nhật chương trình', 'error'); throw err; } };
  const handleDeleteProgram = async (id) => { try { await deleteProgram(id); await loadPrograms(); await loadMasterPlayers(); showToast('Đã xóa chương trình!'); } catch (err) { showToast(err.response?.data?.error || 'Không thể xóa chương trình', 'error'); throw err; } };

  const handleCreateSession = async (data) => {
    const saved = await createSession(data);
    setSessions((current) => [...current, saved]);
    await loadPlayers();
    await loadMasterPlayers();
    showToast('Đã tạo mùa giải mới!');
  };

  const handleUpdateSession = async (id, data) => {
    const saved = await updateSession(id, data);
    setSessions((current) => current.map((session) => session.session_id === saved.session_id ? saved : session));
    await loadPlayers();
    await loadMasterPlayers();
    await loadDashboard();
    showToast('Đã cập nhật mùa giải!');
    return saved;
  };

  const handleRemoveSessionPlayer = async (sessionId, playerId, force = false) => {
    try {
      const saved = await removeSessionPlayer(sessionId, playerId, force);
      setSessions((current) => current.map((session) => session.session_id === saved.session_id ? saved : session));
      await loadPlayers();
      await loadMasterPlayers();
      await loadDashboard();
      showToast('Đã bỏ đăng ký cầu thủ khỏi mùa giải!');
      return saved;
    } catch (err) {
      showToast(err.response?.data?.error || 'Không thể bỏ đăng ký cầu thủ', 'error');
      throw err;
    }
  };

  const handleMatchChanged = async (result) => {
    const updatedSession = result?.session || result;
    if (updatedSession) setSessions((current) => current.map((session) => session.session_id === updatedSession.session_id ? updatedSession : session));
    await Promise.all([loadPlayers(), loadMasterPlayers(), loadSessions(), loadDashboard()]);
    const milestones = result?.milestones || [];
    if (milestones.length) {
      showToast(milestones.map((milestone) => `🎉 ${milestone.player_name} đã đạt ${milestone.milestone} trận!`).join(' '), 'milestone');
    }
  };

  const handleHonorChanged = async (result) => {
    if (result?.session) setSessions((current) => current.map((session) => session.session_id === result.session.session_id ? result.session : session));
    await Promise.all([loadPlayers(), loadMasterPlayers(), loadSessions()]);
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa mùa giải này?')) return;
    try {
      await deleteSession(id);
      setSessions((current) => current.filter((session) => session.session_id !== id));
      await loadPlayers();
      await loadMasterPlayers();
      await loadDashboard();
      showToast('Đã xóa mùa giải!');
    } catch (err) {
      showToast(err.response?.data?.error || 'Không thể xóa mùa giải', 'error');
    }
  };

  // Modal open handlers
  const handleOpenAddModal = () => {
    setPlayerToEdit(null);
    setSelectedPlayer(null);
    setIsCreatingPlayer(true);
    setIsModalOpen(false);
  };

  const handleOpenEditModal = (player) => {
    setIsCreatingPlayer(false);
    setSelectedPlayer(player);
  };

  const handleSaveDetail = async (formData) => {
    if (!selectedPlayer && !isCreatingPlayer) return;
    setSavingDetail(true);
    try {
      const saved = isCreatingPlayer
        ? await createPlayer(formData)
        : await updatePlayer(selectedPlayer.player_id ?? selectedPlayer.id, formData);
      setSelectedPlayer(saved);
      setIsCreatingPlayer(false);
      showToast(`${isCreatingPlayer ? 'Created' : 'Updated'} player data for ${saved.name}!`);
      await loadDashboard();
      await loadPlayers();
      await loadMasterPlayers();
      await loadSessions();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to update player data', 'error');
      throw err;
    } finally {
      setSavingDetail(false);
    }
  };

  // Save Player handler
  const handleSavePlayer = async (formData) => {
    try {
      if (playerToEdit) {
        await updatePlayer(playerToEdit.player_id ?? playerToEdit.id, formData);
        showToast(`Updated player card for ${formData.name}!`);
      } else {
        await createPlayer(formData);
        showToast(`Created new card for ${formData.name}!`);
      }

      loadDashboard();
      loadPlayers();
      loadMasterPlayers();
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to save player card', 'error');
      throw err;
    }
  };

  // Delete Player handler
  const handleDeletePlayer = async (id) => {
    if (!window.confirm('Are you sure you want to delete this player?')) return;
    try {
      await deletePlayer(id);
      showToast('Player deleted successfully!');
      loadDashboard();
      loadPlayers();
      loadMasterPlayers();
    } catch (err) {
      showToast('Failed to delete player', 'error');
    }
  };

  const handleRecalculateStats = async () => {
    if (!window.confirm('Hệ thống sẽ tính lại toàn bộ thống kê cầu thủ dựa trên dữ liệu các mùa giải. Tiếp tục?')) return;
    try {
      const result = await recalculatePlayerStats();
      await loadPlayers();
      await loadMasterPlayers();
      await loadDashboard();
      showToast(`Đã đồng bộ thống kê của ${result.count} cầu thủ.`);
    } catch (err) {
      showToast(err.response?.data?.error || 'Không thể đồng bộ thống kê', 'error');
    }
  };

  // Quick Stat Booster
  const handleQuickBoost = async (id, statType) => {
    const targetPlayer = players.find(p => (p.player_id ?? p.id) === id);
    if (!targetPlayer) return;

    try {
      const statMap = { goals: 'goalAmounts', assists: 'assistAmounts', motm: 'bestPlayerAmount' };
      const statKey = statMap[statType] || statType;
      const updateData = { stats: { ...targetPlayer.stats, [statKey]: (targetPlayer.stats?.[statKey] || 0) + 1, match: (targetPlayer.stats?.match || 0) + 1 } };
      await updatePlayer(id, updateData);
      showToast(`+1 ${statType.toUpperCase()} awarded to ${targetPlayer.name}!`);
      loadPlayers();
      loadMasterPlayers();
      loadDashboard();
    } catch (err) {
      showToast('Failed to boost stats', 'error');
    }
  };

  return (
    <div className="app-shell">
      
      {/* Left Sidebar Navigation */}
      {isSidebarOpen && (
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Main Content Body */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Header Topbar */}
        <Header
          onOpenSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Content Container */}
        <main className="app-main">
          
          {/* Toast Notification */}
          {toast && (
            <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl border shadow-lg font-bold text-sm flex items-center gap-3 animate-bounce ${
              toast.type === 'error'
                ? 'bg-red-50 border-red-300 text-red-700'
                : toast.type === 'milestone'
                  ? 'bg-amber-50 border-amber-300 text-amber-900'
                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}>
              <span>{toast.message}</span>
            </div>
          )}

          {/* Active Tab Views */}
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={dashboardStats}
              players={masterPlayers}
              loading={loadingStats}
              onSwitchTab={setActiveTab}
            />
          )}

          {activeTab === 'players' && (
            selectedPlayer || isCreatingPlayer ? (
              <PlayerDetail
                player={selectedPlayer}
                nations={nations}
                imageCards={imageCards}
                sessions={sessions}
                programs={programs}
                saving={savingDetail}
                onBack={() => { setSelectedPlayer(null); setIsCreatingPlayer(false); }}
                onSave={handleSaveDetail}
                onCardsChanged={async () => { await loadPlayers(); await loadMasterPlayers(); await loadPrograms(); if (selectedPlayer?.player_id) setSelectedPlayer(await getPlayerById(selectedPlayer.player_id)); }}
              />
            ) : (
              <PlayerTable
                players={players}
                useFallback={playersApiUnavailable}
                nations={nations}
                loading={loadingPlayers}
                search={search}
                setSearch={setSearch}
                cardTypeFilter={cardTypeFilter}
                setCardTypeFilter={setCardTypeFilter}
                positionFilter={positionFilter}
                setPositionFilter={setPositionFilter}
                nationFilter={nationFilter}
                setNationFilter={setNationFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
                onOpenAddModal={handleOpenAddModal}
                onEditPlayer={handleOpenEditModal}
                onDeletePlayer={handleDeletePlayer}
                onRecalculateStats={handleRecalculateStats}
                onQuickBoost={handleQuickBoost}
              />
            )
          )}

          {activeTab === 'sessions' && (
            <Sessions
              sessions={sessions}
              players={masterPlayers}
              nations={nations}
              onCreate={handleCreateSession}
              onUpdate={handleUpdateSession}
              onDelete={handleDeleteSession}
              onRemovePlayerFromSession={handleRemoveSessionPlayer}
              onMatchChanged={handleMatchChanged}
              onHonorChanged={handleHonorChanged}
              onUpdatePlayerCard={async (sessionId, playerMatch) => { const saved = await handleUpdateSession(sessionId, { player_match: playerMatch }); return saved; }}
            />
          )}

          {activeTab === 'programs' && <Programs programs={programs} players={masterPlayers} onCreate={handleCreateProgram} onUpdate={handleUpdateProgram} onDelete={handleDeleteProgram} />}

          {activeTab === 'awards' && (
            <Awards players={players} />
          )}

          {activeTab === 'legends' && <Legends />}

        </main>
      </div>

      {/* Create / Edit Modal */}
      <PlayerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePlayer}
        playerToEdit={playerToEdit}
      />

    </div>
  );
}
