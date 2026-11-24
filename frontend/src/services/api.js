import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  // Creating a player also creates its card and recalculates career stats.
  // Keep enough time for that local filesystem work to finish.
  timeout: Number(import.meta.env.VITE_API_TIMEOUT || 10000),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getPlayers = async (params = {}) => {
  const response = await api.get('/players', { params });
  return response.data;
};

export const getNations = async () => {
  const response = await api.get('/nations');
  return response.data;
};

export const getImageCards = async () => {
  const response = await api.get('/players/image-cards');
  return response.data;
};

export const getSessions = async () => {
  const response = await api.get('/sessions');
  return response.data;
};

export const getLegends = async () => (await api.get('/legends')).data;
export const getRecords = async () => (await api.get('/records')).data;
export const createRecord = async (data) => (await api.post('/records', data, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
export const updateRecord = async (id, data) => (await api.put(`/records/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } })).data;
export const deleteRecord = async (id) => (await api.delete(`/records/${id}`)).data;
export const recordImageUrl = (filename) => filename ? `${API_BASE_URL.replace(/\/$/, '')}/records/images/${encodeURIComponent(filename)}` : '';

export const createSession = async (sessionData) => {
  const response = await api.post('/sessions', sessionData);
  return response.data;
};

export const updateSession = async (id, sessionData) => {
  const response = await api.put(`/sessions/${id}`, sessionData);
  return response.data;
};

export const deleteSession = async (id) => {
  const response = await api.delete(`/sessions/${id}`);
  return response.data;
};
export const getSessionImages = async () => (await api.get('/sessions/images')).data;
export const getSessionVideos = async () => (await api.get('/sessions/videos')).data;

export const getMatches = async (sessionId) => (await api.get('/matches', { params: { session_id: sessionId } })).data;
export const createMatch = async (match) => (await api.post('/matches', match)).data;
export const updateMatch = async (id, match) => (await api.put(`/matches/${id}`, match)).data;
export const finalizeMatch = async (id) => (await api.post(`/matches/${id}/finalize`)).data;
export const deleteMatch = async (id) => (await api.delete(`/matches/${id}`)).data;

export const applySeasonHth = async (sessionId) => (await api.post('/honors/hth', { session_id: sessionId })).data;
export const applyLastWeekCup = async (sessionId, playerIds, batchId) => (await api.post('/honors/last-week-cup', { session_id: sessionId, player_ids: playerIds }, { headers: batchId ? { 'Idempotency-Key': batchId } : {} })).data;

export const removeSessionPlayer = async (sessionId, playerId, force = false) => {
  const response = await api.delete(`/sessions/${sessionId}/players/${playerId}`, { params: { force } });
  return response.data;
};

export const uploadImageCard = async (formData) => {
  const response = await api.post('/players/image-cards', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getPlayerById = async (id) => {
  const response = await api.get(`/players/${id}`);
  return response.data;
};

export const createPlayer = async (playerData) => {
  const response = await api.post('/players', playerData);
  return response.data;
};

export const updatePlayer = async (id, playerData) => {
  const response = await api.put(`/players/${id}`, playerData);
  return response.data;
};

export const deletePlayer = async (id) => {
  const response = await api.delete(`/players/${id}`);
  return response.data;
};

export const recalculatePlayerStats = async () => {
  const response = await api.post('/players/recalculate-stats');
  return response.data;
};

export const getDashboardStats = async () => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

export const getPrograms = async () => (await api.get('/programs')).data;
export const createProgram = async (program) => (await api.post('/programs', program)).data;
export const updateProgram = async (id, program) => (await api.put(`/programs/${id}`, program)).data;
export const deleteProgram = async (id) => (await api.delete(`/programs/${id}`)).data;

export const getPlayerCards = async (playerId) => (await api.get('/player-cards', { params: { player_id: playerId } })).data;
export const createPlayerCard = async (card) => (await api.post('/player-cards', card)).data;
export const updatePlayerCard = async (id, card) => (await api.put(`/player-cards/${id}`, card)).data;
export const setCurrentPlayerCard = async (id) => (await api.post(`/player-cards/${id}/current`)).data;
export const deletePlayerCard = async (id) => (await api.delete(`/player-cards/${id}`)).data;

export const importExcelPlayers = async (formData) => {
  const response = await api.post('/players/import/excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const downloadExcelTemplateUrl = `${API_BASE_URL}/players/export/template`;

export default api;
