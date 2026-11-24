const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('../jsonStore');
const DATA = path.join(store.DATA_DIR, 'player-rank-data.json');
const JOURNAL = path.join(store.DATA_DIR, 'player-rank-transaction.json');
const FIELDS = { match: 'Trận đấu', goalAmounts: 'Bàn thắng', assistAmounts: 'Kiến tạo', bestPlayerAmount: 'MVP', sessionAmount: 'Mùa giải', wins: 'Thắng', draws: 'Hòa', losses: 'Thua', goalsAgainst: 'Bàn thua', cleanSheets: 'Giữ sạch lưới' };
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
function writeJSON(file, value) { const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', 'utf8'); fs.renameSync(tmp, file); }
function data() { if (fs.existsSync(JOURNAL)) recover(); const d = JSON.parse(fs.readFileSync(DATA, 'utf8').replace(/^\uFEFF/, '')); if (!Array.isArray(d.ranks) || !d.players || !Array.isArray(d.history)) throw error('Dữ liệu hành trình không hợp lệ.', 500); return d; }
function rankIndex(d, code) { const index = d.ranks.findIndex((r) => r.code === (code || 'young_talent')); if (index < 0) throw error('Mã bậc hiện tại không hợp lệ.', 500); return index; }
function targetIndex(d, code) {
  const index = typeof code === 'string' ? d.ranks.findIndex((rank) => rank.code === code) : -1;
  if (index < 0) throw error('Mã bậc đích không hợp lệ.');
  return index;
}
function stats(player) { return Object.fromEntries(Object.keys(FIELDS).map((key) => [key, Number(player.stats?.[key]) || 0])); }
function readPlayer(id) { const player = store.readCollection('players.json').find((p) => String(p.player_id) === String(id)); if (!player) throw error('Không tìm thấy cầu thủ.', 404); return player; }
function entry(d, id) { return d.players[String(id)] ||= { stages: {} }; }
function stage(d, id, code) { return entry(d, id).stages[code] ||= { missions: [] }; }
function startNext(d, player) { const next = d.ranks[rankIndex(d, player.rank) + 1]; if (!next) return; const s = stage(d, player.player_id, next.code); if (!s.baseline) { s.baseline = stats(player); s.started_at = new Date().toISOString(); } }
function recover() {
  if (!fs.existsSync(JOURNAL)) return;
  const j = JSON.parse(fs.readFileSync(JOURNAL, 'utf8'));
  writeJSON(DATA, j.beforeData); store.writePromotedPlayers(j.beforePlayers); fs.unlinkSync(JOURNAL);
}
function initialize() {
  fs.mkdirSync(store.DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA)) fs.copyFileSync(path.join(__dirname, '../rank-default.json'), DATA);
  recover(); const d = data(); let players = store.readCollection('players.json');
  const seen = new Set(); for (const p of players) { if (!p.player_id || seen.has(String(p.player_id))) throw error('Định danh cầu thủ bị thiếu hoặc trùng.', 500); seen.add(String(p.player_id)); rankIndex(d, p.rank); }
  const missing = players.some((p) => !p.rank);
  if (missing) { players = players.map((p) => p.rank ? p : { ...p, rank: 'young_talent' }); store.writePromotedPlayers(players); }
  for (const p of players) startNext(d, p); writeJSON(DATA, d);
}
function evaluate(player, s) {
  const missions = (s?.missions || []).map((m) => {
    if (m.type === 'manual') return { ...m, complete: m.confirmed === true };
    const value = stats(player)[m.stat]; const baseline = m.scope === 'stage' ? s?.baseline?.[m.stat] : 0;
    const progress = baseline === undefined ? null : Math.max(0, value - baseline);
    return { ...m, progress, complete: progress !== null && progress >= m.target };
  });
  return { missions, complete: missions.length > 0 && missions.every((m) => m.complete), completed: missions.filter((m) => m.complete).length };
}
function view(player, d) {
  const index = rankIndex(d, player.rank); const stages = d.ranks.map((r, i) => { const snapshot = i <= index ? [...d.history].reverse().find((h) => String(h.player_id) === String(player.player_id) && h.to === r.code) : null; const progress = snapshot ? { missions: snapshot.missions, complete: snapshot.missions.length > 0 && snapshot.missions.every((m) => m.complete), completed: snapshot.missions.filter((m) => m.complete).length } : evaluate(player, d.players[String(player.player_id)]?.stages?.[r.code]); return { ...r, state: i < index ? 'achieved' : i === index ? 'current' : i === index + 1 ? 'next' : 'locked', ...progress }; });
  return { player, current: d.ranks[index], next: d.ranks[index + 1] || null, stages, history: d.history.filter((h) => String(h.player_id) === String(player.player_id)).reverse() };
}
function startPlayer(id) { const d = data(), p = readPlayer(id); startNext(d, p); writeJSON(DATA, d); }
function getAll() { const d = data(); return { ranks: d.ranks, stats: FIELDS, players: store.readCollection('players.json').map((p) => view(p,d)) }; }
function setMissions(id, code, input) {
  const d=data(), p=readPlayer(id), i=rankIndex(d,p.rank), target=targetIndex(d,code);
  if (target <= i) throw error('Không thể sửa nhiệm vụ của bậc đã trao.');
  if (!Array.isArray(input) || input.length > 50) throw error('Danh sách nhiệm vụ không hợp lệ.');
  const old=stage(d,id,code); const ids=new Set();
  const missions=input.map((m) => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) throw error('Nhiệm vụ không hợp lệ.');
    const mid = m.id ? String(m.id) : crypto.randomUUID();
    if (ids.has(mid)) throw error('Định danh nhiệm vụ bị trùng.'); ids.add(mid);
    const name=String(m.name || '').trim(), description=String(m.description || '').trim();
    if (!name || name.length>200 || description.length>1000 || !['manual','stat'].includes(m.type)) throw error('Nhiệm vụ không hợp lệ.');
    const previous=old.missions.find((item)=>item.id===mid);
    if (m.type==='manual') return { id:mid, name, description, type:'manual', confirmed: previous?.type==='manual' && previous.name === name && previous.description === description ? previous.confirmed === true : false };
    const target=Number(m.target);
    if (!Object.hasOwn(FIELDS, m.stat) || !['career','stage'].includes(m.scope) || !Number.isSafeInteger(target) || target < 1) throw error('Chỉ số hoặc chỉ tiêu nhiệm vụ không hợp lệ.');
    return { id:mid, name, description, type:'stat', stat:m.stat, scope:m.scope, target };
  });
  old.missions=missions; if (target===i+1 && !old.baseline) startNext(d,p); writeJSON(DATA,d); return view(p,d);
}
function confirmMission(id,code,missionId,confirmed) {
  const d=data(),p=readPlayer(id); if (targetIndex(d,code)<=rankIndex(d,p.rank)) throw error('Không thể sửa nhiệm vụ của bậc đã trao.');
  const m=d.players[String(id)]?.stages?.[code]?.missions?.find((x)=>x.id===missionId);
  if (!m || m.type!=='manual' || typeof confirmed !== 'boolean') throw error('Nhiệm vụ xác nhận không hợp lệ.');
  m.confirmed=confirmed; writeJSON(DATA,d); return view(p,d);
}
function promote(id,code) {
  const d=data(), players=store.readCollection('players.json'), p=players.find((x)=>String(x.player_id)===String(id));
  if (!p) throw error('Không tìm thấy cầu thủ.',404);
  const index=rankIndex(d,p.rank), next=d.ranks[index+1];
  if (!next || next.code!==code) throw error('Chỉ có thể trao bậc kế tiếp.');
  const result=evaluate(p,d.players[String(id)]?.stages?.[code]);
  const beforeData=JSON.parse(JSON.stringify(d)), beforePlayers=JSON.parse(JSON.stringify(players));
  const previous=p.rank || 'young_talent'; p.rank=code;
  d.history.push({ id:crypto.randomUUID(), player_id:p.player_id, from:previous, to:code, awarded_at:new Date().toISOString(), awarded_by:'Quản trị viên', missions:result.missions });
  startNext(d,p);
  writeJSON(JOURNAL,{beforeData,beforePlayers});
  try { writeJSON(DATA,d); store.writePromotedPlayers(players); fs.unlinkSync(JOURNAL); }
  catch (e) { try { recover(); } catch (rollbackError) { console.error('Rank recovery required:',rollbackError); } throw e; }
  return view(p,d);
}
module.exports={ recover, initialize, startPlayer, getAll, setMissions, confirmMission, promote };
