import React, { useEffect, useState } from 'react';
import { ChevronDown, ImagePlus, Pencil, Plus, Search, Trash2, Trophy, X } from 'lucide-react';
import { createRecord, deleteRecord, getPlayers, getRecords, recordImageUrl, updateRecord } from '../services/api';

const normalizeSearch = (value) => String(value || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

function RecordForm({ record, onClose, onSaved }) {
  const [name, setName] = useState(record?.name || '');
  const [awardName, setAwardName] = useState(record?.award_name || '');
  const [note, setNote] = useState(record?.note || '');
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(record?.player_id ? String(record.player_id) : '');
  const [legacyPlayer, setLegacyPlayer] = useState(record?.player || '');
  const [playerSearch, setPlayerSearch] = useState('');
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerLoading, setPlayerLoading] = useState(true);
  const [playerError, setPlayerError] = useState('');
  const [image, setImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!image) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);
  useEffect(() => {
    let active = true;
    getPlayers({ sortBy: 'name', order: 'asc' }).then((items) => {
      if (!active) return;
      setPlayers(items);
      if (record?.player && !record.player_id) {
        const matches = items.filter((item) => item.name.trim().toLocaleLowerCase('vi') === record.player.trim().toLocaleLowerCase('vi'));
        if (matches.length === 1) setPlayerId(String(matches[0].player_id));
      }
    }).catch(() => { if (active) setPlayerError('Không thể tải kho cầu thủ. Vui lòng đóng và thử lại.'); })
      .finally(() => { if (active) setPlayerLoading(false); });
    return () => { active = false; };
  }, [record]);
  const selectedPlayer = players.find((item) => String(item.player_id) === playerId);
  const visiblePlayers = players.filter((item) => normalizeSearch(item.name).includes(normalizeSearch(playerSearch.trim())));
  const cover = image ? preview : (!removeImage ? recordImageUrl(record?.image) : '');
  const submit = async (event) => {
    event.preventDefault();
    if (!name.trim() || (!selectedPlayer && !legacyPlayer)) { setError('Vui lòng nhập tên kỷ lục và chọn cầu thủ.'); return; }
    if (image && image.size > 5 * 1024 * 1024) { setError('Ảnh bìa không được vượt quá 5 MB.'); return; }
    const form = new FormData();
    form.append('name', name.trim());
    form.append('award_name', awardName.trim());
    form.append('note', note.trim());
    form.append('player', selectedPlayer?.name || legacyPlayer);
    if (selectedPlayer) form.append('player_id', String(selectedPlayer.player_id));
    if (image) form.append('image', image);
    if (removeImage) form.append('removeImage', 'true');
    setSaving(true); setError('');
    try {
      const saved = record ? await updateRecord(record.record_id, form) : await createRecord(form);
      onSaved(saved);
    } catch (err) { setError(err.response?.data?.error || 'Không thể lưu kỷ lục. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  };
  return <div className="session-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
      <button type="button" className="session-close-button record-close" onClick={onClose} disabled={saving} aria-label="Đóng"><X /></button>
      <span className="session-eyebrow">THE RECORDS</span><h2 id="record-form-title">{record ? 'Chỉnh sửa kỷ lục' : 'Thêm kỷ lục'}</h2>
      <form onSubmit={submit}>
        <label>Tên kỷ lục<input autoFocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Cầu thủ ghi nhiều bàn thắng nhất" /></label>
        <label>Tên danh hiệu <input maxLength={200} value={awardName} onChange={(event) => setAwardName(event.target.value)} placeholder="Nhập tên danh hiệu" /></label>
        <div className="record-player-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPlayerOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape') { setPlayerOpen(false); event.currentTarget.querySelector('button')?.focus(); } }}>
          <span id="record-player-label">Cầu thủ sở hữu</span>
          <button type="button" className="record-player-toggle" aria-labelledby="record-player-label record-player-value" aria-expanded={playerOpen} aria-controls="record-player-options" disabled={playerLoading || !!playerError} onClick={() => { setPlayerOpen((open) => !open); setPlayerSearch(''); }}><span id="record-player-value">{playerLoading ? 'Đang tải cầu thủ...' : selectedPlayer?.name || legacyPlayer || 'Chọn cầu thủ'}</span><ChevronDown /></button>
          {playerOpen && <div className="record-player-dropdown" id="record-player-options"><label className="record-player-search"><Search /><input autoFocus value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Tìm cầu thủ..." aria-label="Tìm cầu thủ" /></label><div className="record-player-options">{visiblePlayers.length ? visiblePlayers.map((item) => <button type="button" key={item.player_id} className={String(item.player_id) === playerId ? 'is-selected' : ''} onClick={() => { setPlayerId(String(item.player_id)); setLegacyPlayer(''); setPlayerOpen(false); }}><span>{item.name}</span><small className={item.is_active === false ? 'is-inactive' : ''}>{item.is_active === false ? 'DeActive' : 'Active'}</small></button>) : <p>Không tìm thấy cầu thủ.</p>}</div></div>}
          {playerError && <span className="record-error" role="alert">{playerError}</span>}
          {!playerLoading && !selectedPlayer && legacyPlayer && <small>Tên đã lưu trước đây; chọn cầu thủ trong kho nếu muốn liên kết.</small>}
        </div>
        <label>Ghi chú <textarea maxLength={2000} rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thêm ghi chú cho kỷ lục..." /></label>
        <div className="record-cover-field"><span>Ảnh bìa <small>(không bắt buộc)</small></span>
          {cover && <img className="record-cover-preview" src={cover} alt="Xem trước ảnh bìa" />}
          <div className="record-cover-actions"><label className="session-secondary-button record-upload"><ImagePlus /> {cover ? 'Đổi ảnh' : 'Chọn ảnh bìa'}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => { setImage(event.target.files?.[0] || null); setRemoveImage(false); event.target.value = ''; }} /></label>{cover && <button type="button" className="record-remove-image" onClick={() => { setImage(null); setRemoveImage(true); }}>Xóa ảnh</button>}</div>
          <small>PNG, JPG, GIF hoặc WebP · tối đa 5 MB</small>
        </div>
        {error && <p className="record-error" role="alert">{error}</p>}
        <div className="record-form-actions"><button type="button" className="session-secondary-button" disabled={saving} onClick={onClose}>Hủy</button><button type="submit" className="session-primary-button" disabled={saving || playerLoading || !!playerError}>{saving ? 'Đang lưu...' : 'Lưu kỷ lục'}</button></div>
      </form>
    </section>
  </div>;
}

export default function Records() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  useEffect(() => {
    let active = true;
    getRecords().then((items) => { if (active) setRecords(items); }).catch(() => { if (active) setError('Không thể tải kỷ lục. Vui lòng tải lại trang.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const remove = async (record) => {
    if (!window.confirm(`Xóa kỷ lục “${record.name}”?`)) return;
    setDeleting(record.record_id); setError('');
    try { await deleteRecord(record.record_id); setRecords((items) => items.filter((item) => item.record_id !== record.record_id)); }
    catch (err) { setError(err.response?.data?.error || 'Không thể xóa kỷ lục. Vui lòng thử lại.'); }
    finally { setDeleting(null); }
  };
  return <section className="records-section">
    <div className="records-heading"><div><span className="session-eyebrow">THE RECORDS</span><h2>Những kỷ lục</h2><p>Những dấu ấn đáng nhớ của các cầu thủ Ajax.</p></div><button type="button" className="session-primary-button" onClick={() => setForm({})}><Plus /> Thêm kỷ lục</button></div>
    {error && <p className="record-error" role="alert">{error}</p>}
    {loading ? <div className="legend-empty-state">Đang tải kỷ lục...</div> : !records.length ? <div className="record-empty"><Trophy /><strong>Chưa có kỷ lục nào</strong><span>Thêm kỷ lục đầu tiên để lưu lại dấu ấn của cầu thủ.</span></div> : <div className="records-grid">{records.map((record) => <article className="record-card" key={record.record_id}>
      <div className="record-card-cover">{record.image ? <img src={recordImageUrl(record.image)} alt="" /> : <Trophy />}</div>
      <div className="record-card-content"><div className="record-card-details"><span className="session-eyebrow">KỶ LỤC</span><h3>{record.name}</h3>{record.award_name && <p className="record-award-name">{record.award_name}</p>}<strong>{record.player}</strong>{record.player_history?.length > 0 && <details className="record-history"><summary>Cầu thủ từng giữ kỷ lục <ChevronDown /></summary><ol>{[...record.player_history].reverse().map((entry, index) => <li key={entry.changed_at + "-" + index}>{entry.player}</li>)}</ol></details>}</div>{record.note && <div className="record-card-note"><span className="record-player-label">GHI CHÚ</span><p>{record.note}</p></div>}<div className="record-card-actions"><button type="button" onClick={() => setForm(record)}><Pencil /> Chỉnh sửa</button><button type="button" disabled={deleting === record.record_id} onClick={() => remove(record)}><Trash2 /> Xóa</button></div></div>
    </article>)}</div>}
    {form && <RecordForm record={form.record_id ? form : null} onClose={() => setForm(null)} onSaved={(saved) => { setRecords((items) => form.record_id ? items.map((item) => item.record_id === saved.record_id ? saved : item) : [...items, saved]); setForm(null); }} />}
  </section>;
}
