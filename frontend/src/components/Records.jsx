import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUp, ChevronDown, Crown, Filter, Flame, ImagePlus, Landmark, Pencil, Plus, RotateCcw, Search, Shield, Sparkles, Target, Trash2, Trophy, X } from 'lucide-react';
import { createRecord, deleteRecord, getPlayers, getRecords, recordImageUrl, updateRecord } from '../services/api';
import { isBreakableRecord } from '../services/recordClassification';

const normalizeSearch = (value) => String(value || '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

export const RECORD_GROUPS = [
  {
    id: 'legacy_glory',
    shortName: 'Di sản',
    title: 'DI SẢN & VINH QUANG',
    subtitle: 'Legacy & Glory',
    Icon: Landmark,
    record_ids: [1, 9]
  },
  {
    id: 'individual_honours',
    shortName: 'Danh hiệu',
    title: 'DANH HIỆU CÁ NHÂN',
    subtitle: 'Individual Honours',
    Icon: Trophy,
    record_ids: [10, 4, 5, 6]
  },
  {
    id: 'goals_assists',
    shortName: 'Tấn công',
    title: 'GHI BÀN & KIẾN TẠO',
    subtitle: 'Goals & Assists',
    Icon: Target,
    record_ids: [18, 7, 2, 19, 8, 3]
  },
  {
    id: 'skill_brilliance',
    shortName: 'Bản lĩnh',
    title: 'KỸ NĂNG & BẢN LĨNH',
    subtitle: 'Skill & Brilliance',
    Icon: Flame,
    record_ids: [11, 12, 13, 14, 15]
  },
  {
    id: 'masters_of_position',
    shortName: 'Vị trí',
    title: 'BẬC THẦY VỊ TRÍ',
    subtitle: 'Masters of Position',
    Icon: Shield,
    record_ids: [16, 17]
  }
];

function RecordForm({ record, onClose, onSaved }) {
  const [name, setName] = useState(record?.name || '');
  const [awardName, setAwardName] = useState(record?.award_name || '');
  const [note, setNote] = useState(record?.note || '');
  const [players, setPlayers] = useState([]);
  const [playerId, setPlayerId] = useState(record?.player_id ? String(record.player_id) : '');
  const [legacyPlayer, setLegacyPlayer] = useState(record?.player || '');
  const [coPlayers, setCoPlayers] = useState(Array.isArray(record?.co_players) ? record.co_players : []);
  const [coOpen, setCoOpen] = useState(false);
  const [coSearch, setCoSearch] = useState('');
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

  const availableCoPlayers = useMemo(() => {
    return players.filter((item) => {
      if (playerId && String(item.player_id) === String(playerId)) return false;
      if (coPlayers.some((c) => String(c.player_id) === String(item.player_id))) return false;
      if (coSearch.trim()) {
        return normalizeSearch(item.name).includes(normalizeSearch(coSearch.trim()));
      }
      return true;
    });
  }, [players, playerId, coPlayers, coSearch]);

  const removeCoPlayer = (index) => {
    setCoPlayers((prev) => prev.filter((_, i) => i !== index));
  };

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
    form.append('co_players', JSON.stringify(coPlayers));
    if (image) form.append('image', image);
    if (removeImage) form.append('removeImage', 'true');
    setSaving(true); setError('');
    try {
      const saved = record ? await updateRecord(record.record_id, form) : await createRecord(form);
      onSaved(saved);
    } catch (err) { setError(err.response?.data?.error || 'Không thể lưu kỷ lục. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  };
  const breakable = isBreakableRecord({ name: name || record?.name, record_id: record?.record_id });

  return <div className="session-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="record-form-title">
      <button type="button" className="session-close-button record-close" onClick={onClose} disabled={saving} aria-label="Đóng"><X /></button>
      <span className="session-eyebrow">THE RECORDS</span><h2 id="record-form-title">{record ? 'Chỉnh sửa kỷ lục' : 'Thêm kỷ lục'}</h2>
      <div className={`record-form-type-banner ${breakable ? 'is-breakable' : 'is-milestone'}`}>
        {breakable ? (
          <>
            <Crown className="w-3.5 h-3.5 text-amber-600" />
            <span>Kỷ lục có thể bị xô đổ (Theo dõi cầu thủ đang nắm giữ và lưu lịch sử người từng giữ)</span>
          </>
        ) : (
          <>
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Danh hiệu đạt được (Sở hữu vĩnh viễn, có thể thuộc về nhiều cầu thủ cùng lúc)</span>
          </>
        )}
      </div>
      <form onSubmit={submit}>
        <label>Tên kỷ lục<input autoFocus required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Cầu thủ ghi nhiều bàn thắng nhất" /></label>
        <label>Tên danh hiệu <input maxLength={200} value={awardName} onChange={(event) => setAwardName(event.target.value)} placeholder="Nhập tên danh hiệu" /></label>
        <div className="record-player-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPlayerOpen(false); }} onKeyDown={(event) => { if (event.key === 'Escape') { setPlayerOpen(false); event.currentTarget.querySelector('button')?.focus(); } }}>
          <span id="record-player-label">{breakable ? 'Cầu thủ đang giữ kỷ lục' : 'Cầu thủ đạt danh hiệu'}</span>
          <button type="button" className="record-player-toggle" aria-labelledby="record-player-label record-player-value" aria-expanded={playerOpen} aria-controls="record-player-options" disabled={playerLoading || !!playerError} onClick={() => { setPlayerOpen((open) => !open); setPlayerSearch(''); }}><span id="record-player-value">{playerLoading ? 'Đang tải cầu thủ...' : selectedPlayer?.name || legacyPlayer || 'Chọn cầu thủ'}</span><ChevronDown /></button>
          {playerOpen && <div className="record-player-dropdown" id="record-player-options"><label className="record-player-search"><Search /><input autoFocus value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Tìm cầu thủ..." aria-label="Tìm cầu thủ" /></label><div className="record-player-options">{visiblePlayers.length ? visiblePlayers.map((item) => <button type="button" key={item.player_id} className={String(item.player_id) === playerId ? 'is-selected' : ''} onClick={() => { setPlayerId(String(item.player_id)); setLegacyPlayer(''); setPlayerOpen(false); }}><span>{item.name}</span><small className={item.is_active === false ? 'is-inactive' : ''}>{item.is_active === false ? 'DeActive' : 'Active'}</small></button>) : <p>Không tìm thấy cầu thủ.</p>}</div></div>}
          {playerError && <span className="record-error" role="alert">{playerError}</span>}
          {!playerLoading && !selectedPlayer && legacyPlayer && <small>Tên đã lưu trước đây; chọn cầu thủ trong kho nếu muốn liên kết.</small>}
        </div>

        {/* Đồng sở hữu kỷ lục / Các cầu thủ cùng đạt danh hiệu */}
        <div className="record-co-players-group">
          <div className="record-co-players-header">
            <span id="record-co-players-label">
              {breakable
                ? `Cầu thủ đồng nắm giữ ${coPlayers.length > 0 ? `(${coPlayers.length})` : ''}`
                : `Các cầu thủ khác cùng đạt danh hiệu ${coPlayers.length > 0 ? `(${coPlayers.length})` : ''}`}
            </span>
            <button
              type="button"
              className="record-add-co-btn"
              disabled={playerLoading || !!playerError}
              onClick={() => { setCoOpen((open) => !open); setCoSearch(''); }}
            >
              <Plus size={14} /> {breakable ? 'Thêm đồng sở hữu' : 'Thêm cầu thủ đạt danh hiệu'}
            </button>
          </div>

          {coPlayers.length > 0 && (
            <div className="record-co-chips-list">
              {coPlayers.map((co, index) => (
                <span key={co.player_id || index} className="record-co-chip">
                  <span className="record-co-chip-name">{co.player}</span>
                  <button
                    type="button"
                    className="record-co-chip-remove"
                    onClick={() => removeCoPlayer(index)}
                    aria-label={`Xóa đồng sở hữu ${co.player}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {coOpen && (
            <div
              className="record-player-dropdown record-co-dropdown"
              onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setCoOpen(false); }}
              onKeyDown={(event) => { if (event.key === 'Escape') setCoOpen(false); }}
            >
              <label className="record-player-search">
                <Search />
                <input
                  autoFocus
                  value={coSearch}
                  onChange={(event) => setCoSearch(event.target.value)}
                  placeholder={breakable ? 'Tìm cầu thủ đồng sở hữu...' : 'Tìm cầu thủ cùng đạt danh hiệu...'}
                  aria-label={breakable ? 'Tìm cầu thủ đồng sở hữu' : 'Tìm cầu thủ cùng đạt danh hiệu'}
                />
              </label>
              <div className="record-player-options">
                {availableCoPlayers.length ? (
                  availableCoPlayers.map((item) => (
                    <button
                      type="button"
                      key={item.player_id}
                      onClick={() => {
                        setCoPlayers((prev) => [...prev, { player: item.name, player_id: item.player_id }]);
                        setCoOpen(false);
                        setCoSearch('');
                      }}
                    >
                      <span>{item.name}</span>
                      <small className={item.is_active === false ? 'is-inactive' : ''}>
                        {item.is_active === false ? 'DeActive' : 'Active'}
                      </small>
                    </button>
                  ))
                ) : (
                  <p>Không có thêm cầu thủ nào phù hợp.</p>
                )}
              </div>
            </div>
          )}
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

function BreakRecordModal({ record, onClose, onSaved }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [mode, setMode] = useState('break'); // 'break' | 'co'
  const [note, setNote] = useState(record?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPlayers()
      .then((items) => {
        if (!active) return;
        setPlayers(items);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('Không thể tải danh sách cầu thủ.');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const currentHolders = useMemo(() => {
    const list = [record.player];
    if (Array.isArray(record.co_players)) {
      record.co_players.forEach((co) => {
        if (co.player && !list.includes(co.player)) list.push(co.player);
      });
    }
    return list;
  }, [record]);

  const availablePlayers = useMemo(() => {
    const term = normalizeSearch(playerSearch);
    return players.filter((p) => {
      const pId = Number(p.player_id);
      const isCurrentPrimary = (record.player_id && Number(record.player_id) === pId) || p.name === record.player;
      if (isCurrentPrimary) return false;
      if (mode === 'co') {
        const isCo = Array.isArray(record.co_players) && record.co_players.some((co) => (co.player_id && Number(co.player_id) === pId) || co.player === p.name);
        if (isCo) return false;
      }
      if (!term) return true;
      return normalizeSearch(p.name).includes(term);
    });
  }, [players, playerSearch, record, mode]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedPlayer) {
      setError('Vui lòng chọn cầu thủ.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', record.name);
      formData.append('award_name', record.award_name || '');
      formData.append('note', note.trim());

      if (mode === 'break') {
        formData.append('player', selectedPlayer.name);
        formData.append('player_id', String(selectedPlayer.player_id));
        formData.append('co_players', JSON.stringify([]));
      } else {
        formData.append('player', record.player);
        if (record.player_id) formData.append('player_id', String(record.player_id));
        const existingCo = Array.isArray(record.co_players) ? record.co_players : [];
        const updatedCo = [...existingCo, { player: selectedPlayer.name, player_id: selectedPlayer.player_id }];
        formData.append('co_players', JSON.stringify(updatedCo));
      }

      const saved = await updateRecord(record.record_id, formData);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể cập nhật kỷ lục.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="session-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <section className="record-modal record-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="break-modal-title">
        <button type="button" className="session-close-button record-close" onClick={onClose} disabled={saving} aria-label="Đóng"><X /></button>
        <span className="session-eyebrow">KỶ LỤC CẠNH TRANH</span>
        <h2 id="break-modal-title">{record.name}</h2>
        {record.award_name && <p className="record-modal-subtitle">Danh hiệu: <strong>{record.award_name}</strong></p>}

        <div className="record-current-holders-box">
          <span className="record-holders-label">Đang nắm giữ hiện tại:</span>
          <div className="record-holders-tags">
            {currentHolders.map((name) => (
              <span key={name} className="record-holder-chip">👑 {name}</span>
            ))}
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="record-transfer-mode-selector">
            <label className={`record-mode-card ${mode === 'break' ? 'is-active' : ''}`}>
              <input type="radio" name="breakMode" value="break" checked={mode === 'break'} onChange={() => { setMode('break'); setSelectedPlayer(null); }} />
              <div>
                <strong>Xô đổ kỷ lục (Thiết lập mốc mới)</strong>
                <small>Cầu thủ mới thiết lập mốc cao hơn. Người đang giữ ({record.player}) sẽ chuyển vào lịch sử người từng giữ.</small>
              </div>
            </label>

            <label className={`record-mode-card ${mode === 'co' ? 'is-active' : ''}`}>
              <input type="radio" name="breakMode" value="co" checked={mode === 'co'} onChange={() => { setMode('co'); setSelectedPlayer(null); }} />
              <div>
                <strong>Đồng sở hữu kỷ lục (Cùng mốc thành tích)</strong>
                <small>Cầu thủ mới đạt cùng thành tích. Cả hai sẽ cùng chia sẻ danh hiệu và kỷ lục này.</small>
              </div>
            </label>
          </div>

          <div className="record-player-field">
            <span id="break-player-label">
              {mode === 'break' ? 'Cầu thủ xô đổ kỷ lục' : 'Cầu thủ đồng sở hữu kỷ lục'}
            </span>
            <button
              type="button"
              className="record-player-toggle"
              disabled={loading || !!error}
              onClick={() => { setPlayerOpen((open) => !open); setPlayerSearch(''); }}
            >
              <span>{loading ? 'Đang tải cầu thủ...' : selectedPlayer?.name || 'Chọn cầu thủ'}</span>
              <ChevronDown />
            </button>
            {playerOpen && (
              <div className="record-player-dropdown">
                <label className="record-player-search">
                  <Search />
                  <input
                    autoFocus
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="Tìm cầu thủ..."
                  />
                </label>
                <div className="record-player-options">
                  {availablePlayers.length ? (
                    availablePlayers.map((item) => (
                      <button
                        type="button"
                        key={item.player_id}
                        className={selectedPlayer?.player_id === item.player_id ? 'is-selected' : ''}
                        onClick={() => {
                          setSelectedPlayer(item);
                          setPlayerOpen(false);
                        }}
                      >
                        <span>{item.name}</span>
                        <small className={item.is_active === false ? 'is-inactive' : ''}>
                          {item.is_active === false ? 'DeActive' : 'Active'}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p>Không có cầu thủ phù hợp.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <label>
            Cập nhật ghi chú / chỉ số kỷ lục (Tùy chọn)
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Cập nhật số bàn thắng / số trận mới..."
            />
          </label>

          {error && <p className="record-error">{error}</p>}

          <div className="record-form-actions">
            <button type="button" className="session-secondary-button" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" className="session-primary-button" disabled={saving || !selectedPlayer}>
              <Flame size={14} />
              {saving ? 'Đang lưu...' : mode === 'break' ? 'Xác nhận xô đổ' : 'Xác nhận đồng sở hữu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AddAchieverModal({ record, onClose, onSaved }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playerSearch, setPlayerSearch] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [note, setNote] = useState(record?.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPlayers()
      .then((items) => {
        if (!active) return;
        setPlayers(items);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError('Không thể tải danh sách cầu thủ.');
        setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const currentAchievers = useMemo(() => {
    const list = [record.player];
    if (Array.isArray(record.co_players)) {
      record.co_players.forEach((co) => {
        if (co.player && !list.includes(co.player)) list.push(co.player);
      });
    }
    return list;
  }, [record]);

  const availablePlayers = useMemo(() => {
    const term = normalizeSearch(playerSearch);
    const existingIds = new Set([
      Number(record.player_id),
      ...(Array.isArray(record.co_players) ? record.co_players.map((c) => Number(c.player_id)) : [])
    ].filter(Boolean));
    const existingNames = new Set([
      normalizeSearch(record.player),
      ...(Array.isArray(record.co_players) ? record.co_players.map((c) => normalizeSearch(c.player)) : [])
    ].filter(Boolean));

    return players.filter((p) => {
      const pId = Number(p.player_id);
      if (pId && existingIds.has(pId)) return false;
      if (existingNames.has(normalizeSearch(p.name))) return false;
      if (!term) return true;
      return normalizeSearch(p.name).includes(term);
    });
  }, [players, playerSearch, record]);

  const submit = async (e) => {
    e.preventDefault();
    if (!selectedPlayer) {
      setError('Vui lòng chọn cầu thủ.');
      return;
    }
    setSaving(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('name', record.name);
      formData.append('award_name', record.award_name || '');
      formData.append('note', note.trim());
      formData.append('player', record.player);
      if (record.player_id) formData.append('player_id', String(record.player_id));

      const existingCo = Array.isArray(record.co_players) ? record.co_players : [];
      const updatedCo = [...existingCo, { player: selectedPlayer.name, player_id: selectedPlayer.player_id }];
      formData.append('co_players', JSON.stringify(updatedCo));

      const saved = await updateRecord(record.record_id, formData);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Không thể thêm người đạt danh hiệu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="session-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <section className="record-modal record-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="achiever-modal-title">
        <button type="button" className="session-close-button record-close" onClick={onClose} disabled={saving} aria-label="Đóng"><X /></button>
        <span className="session-eyebrow">DANH HIỆU ĐẠT ĐƯỢC</span>
        <h2 id="achiever-modal-title">{record.name}</h2>
        {record.award_name && <p className="record-modal-subtitle">Danh hiệu: <strong>{record.award_name}</strong></p>}

        <div className="record-current-holders-box is-milestone">
          <span className="record-holders-label">Các cầu thủ đã đạt danh hiệu này ({currentAchievers.length}):</span>
          <div className="record-holders-tags">
            {currentAchievers.map((name) => (
              <span key={name} className="record-holder-chip is-achiever">🏆 {name}</span>
            ))}
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="record-player-field">
            <span id="achiever-player-label">Người tiếp theo giành được danh hiệu</span>
            <button
              type="button"
              className="record-player-toggle"
              disabled={loading || !!error}
              onClick={() => { setPlayerOpen((open) => !open); setPlayerSearch(''); }}
            >
              <span>{loading ? 'Đang tải cầu thủ...' : selectedPlayer?.name || 'Chọn cầu thủ'}</span>
              <ChevronDown />
            </button>
            {playerOpen && (
              <div className="record-player-dropdown">
                <label className="record-player-search">
                  <Search />
                  <input
                    autoFocus
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="Tìm cầu thủ..."
                  />
                </label>
                <div className="record-player-options">
                  {availablePlayers.length ? (
                    availablePlayers.map((item) => (
                      <button
                        type="button"
                        key={item.player_id}
                        className={selectedPlayer?.player_id === item.player_id ? 'is-selected' : ''}
                        onClick={() => {
                          setSelectedPlayer(item);
                          setPlayerOpen(false);
                        }}
                      >
                        <span>{item.name}</span>
                        <small className={item.is_active === false ? 'is-inactive' : ''}>
                          {item.is_active === false ? 'DeActive' : 'Active'}
                        </small>
                      </button>
                    ))
                  ) : (
                    <p>Tất cả cầu thủ hiện tại đã sở hữu danh hiệu này.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <label>
            Cập nhật ghi chú (Tùy chọn)
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thêm thông tin mùa giải hoặc ghi chú..."
            />
          </label>

          {error && <p className="record-error">{error}</p>}

          <div className="record-form-actions">
            <button type="button" className="session-secondary-button" onClick={onClose} disabled={saving}>Hủy</button>
            <button type="submit" className="session-primary-button is-gold-btn" disabled={saving || !selectedPlayer}>
              <Sparkles size={14} />
              {saving ? 'Đang lưu...' : 'Xác nhận thêm danh hiệu'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Records({ targetRecordId, onClearTargetRecord }) {
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedPlayer, setSelectedPlayer] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [breakModalRecord, setBreakModalRecord] = useState(null);
  const [achieverModalRecord, setAchieverModalRecord] = useState(null);

  useEffect(() => {
    let active = true;
    getRecords().then((items) => { if (active) setRecords(items); }).catch(() => { if (active) setError('Không thể tải kỷ lục. Vui lòng tải lại trang.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const playerOptions = useMemo(() => {
    const counts = {};
    records.forEach((r) => {
      if (r.player) {
        const p = r.player.trim();
        counts[p] = (counts[p] || 0) + 1;
      }
      if (Array.isArray(r.co_players)) {
        r.co_players.forEach((cp) => {
          if (cp.player) {
            const p = cp.player.trim();
            counts[p] = (counts[p] || 0) + 1;
          }
        });
      }
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));
  }, [records]);

  const scrollToRecord = (recordId) => {
    const el = document.getElementById(`record-${recordId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('is-highlighted');
      const timer = setTimeout(() => {
        el.classList.remove('is-highlighted');
      }, 2500);
      return () => clearTimeout(timer);
    }
  };

  useEffect(() => {
    if (!loading && targetRecordId && records.length > 0) {
      const timer = setTimeout(() => {
        scrollToRecord(targetRecordId);
        if (onClearTargetRecord) onClearTargetRecord();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, targetRecordId, records, onClearTargetRecord]);

  const remove = async (record) => {
    if (!window.confirm(`Xóa kỷ lục “${record.name}”?`)) return;
    setDeleting(record.record_id); setError('');
    try { await deleteRecord(record.record_id); setRecords((items) => items.filter((item) => item.record_id !== record.record_id)); }
    catch (err) { setError(err.response?.data?.error || 'Không thể xóa kỷ lục. Vui lòng thử lại.'); }
    finally { setDeleting(null); }
  };

  const filteredRecords = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    return records.filter((rec) => {
      if (q) {
        const matchName = normalizeSearch(rec.name).includes(q);
        const matchAward = normalizeSearch(rec.award_name).includes(q);
        const matchPlayer = normalizeSearch(rec.player).includes(q) ||
          (Array.isArray(rec.co_players) && rec.co_players.some((co) => normalizeSearch(co.player).includes(q)));
        if (!matchName && !matchAward && !matchPlayer) return false;
      }

      if (selectedPlayer !== 'all') {
        const isHolder = rec.player === selectedPlayer ||
          (Array.isArray(rec.co_players) && rec.co_players.some((co) => co.player === selectedPlayer));
        if (!isHolder) return false;
      }

      return true;
    });
  }, [records, searchQuery, selectedPlayer]);

  const renderRecordCard = (record) => {
    const breakable = isBreakableRecord(record);
    const coCount = record.co_players?.length || 0;
    const totalAchievers = 1 + coCount;

    return (
      <article className={`record-card ${breakable ? 'is-breakable-record' : 'is-milestone-record'}`} key={record.record_id} id={`record-${record.record_id}`}>
        {record.award_name && <div className="record-card-tab">{record.award_name}</div>}
        <div className="record-card-cover">{record.image ? <img src={recordImageUrl(record.image)} alt="" /> : <Trophy />}</div>
        <div className="record-card-content">
          <div className="record-card-details">
            {breakable ? (
              <>
                {coCount > 0 && (
                  <span className="record-co-owner-badge">
                    Đồng nắm giữ ({totalAchievers})
                  </span>
                )}
                <strong className="record-player-name">{record.player}</strong>
                {record.co_players?.map((co, index) => (
                  <strong key={co.player_id || index} className="record-player-name is-co-holder">
                    {co.player}
                  </strong>
                ))}
                {record.player_history?.length > 0 && (
                  <details className="record-history">
                    <summary>Cầu thủ từng giữ kỷ lục <ChevronDown /></summary>
                    <ol>
                      {[...record.player_history].reverse().map((entry, index) => (
                        <li key={entry.changed_at + "-" + index}>{entry.player}</li>
                      ))}
                    </ol>
                  </details>
                )}
              </>
            ) : (
              <>
                <span className="record-type-chip is-milestone">
                  <Sparkles className="w-3 h-3 text-amber-600 inline mr-1" />
                  Danh hiệu đạt được ({totalAchievers} cầu thủ)
                </span>
                <div className="record-milestone-achievers">
                  <strong className="record-player-name is-achiever">
                    🏆 {record.player}
                  </strong>
                  {record.co_players?.map((co, index) => (
                    <strong key={co.player_id || index} className="record-player-name is-achiever">
                      🏆 {co.player}
                    </strong>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="record-card-note">
            <h3 className="record-name-uppercase">{record.name}</h3>
            {record.note && (
              <>
                <span className="record-player-label">GHI CHÚ</span>
                <p>{record.note}</p>
              </>
            )}
          </div>
          <div className="record-card-actions">
            {breakable ? (
              <button
                type="button"
                className="record-quick-action-btn is-break"
                onClick={() => setBreakModalRecord(record)}
                title="Ghi nhận cầu thủ xô đổ kỷ lục hoặc đồng sở hữu kỷ lục"
              >
                <Flame size={13} /> Cầu thủ xô đổ
              </button>
            ) : (
              <button
                type="button"
                className="record-quick-action-btn is-achieve"
                onClick={() => setAchieverModalRecord(record)}
                title="Thêm người tiếp theo giành được danh hiệu này"
              >
                <Sparkles size={13} /> Người tiếp theo giành được
              </button>
            )}
            <button type="button" onClick={() => setForm(record)}><Pencil /> Chỉnh sửa</button>
            <button type="button" disabled={deleting === record.record_id} onClick={() => remove(record)}><Trash2 /> Xóa</button>
          </div>
        </div>
      </article>
    );
  };

  return <section className="records-section">
    <div className="records-heading">
      <div>
        <span className="session-eyebrow">H A L L &nbsp; O F &nbsp; F A M E</span>
        <h2>The Records</h2>
        <p>Nơi những thành tựu trở thành bất tử.</p>

        {/* Category Pill Tabs */}
        <div className="records-category-tabs">
          <button
            type="button"
            className={`records-category-tab ${activeCategory === 'all' ? 'is-active' : ''}`}
            onClick={() => setActiveCategory('all')}
          >
            <Sparkles className="records-tab-icon" />
            <span>Tất cả · {records.length}</span>
          </button>
          {RECORD_GROUPS.map((group) => {
            const count = group.record_ids.length;
            return (
              <button
                key={group.id}
                type="button"
                className={`records-category-tab ${activeCategory === group.id ? 'is-active' : ''}`}
                onClick={() => setActiveCategory((prev) => (prev === group.id ? 'all' : group.id))}
              >
                <group.Icon className="records-tab-icon" />
                <span>{group.shortName} · {count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <button type="button" className="session-primary-button" onClick={() => setForm({})}><Plus /> Thêm kỷ lục</button>
    </div>

    <div className="legend-toolbar records-toolbar">
      <label className="legend-search">
        <Search />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Tìm theo tên kỷ lục, tên danh hiệu (ví dụ: Vạn Cúp Chi Vương, Cầu thủ nhiều danh hiệu...)"
          aria-label="Tìm theo tên kỷ lục hoặc danh hiệu"
        />
        {searchQuery && (
          <button
            type="button"
            className="records-clear-btn"
            onClick={() => setSearchQuery('')}
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <X />
          </button>
        )}
      </label>
      <div className="records-count-chip">
        <span><strong>{filteredRecords.length}</strong> / {records.length} kỷ lục</span>
      </div>
    </div>

    {error && <p className="record-error" role="alert">{error}</p>}

    {loading ? (
      <div className="legend-empty-state">Đang tải kỷ lục...</div>
    ) : !records.length ? (
      <div className="record-empty">
        <Trophy />
        <strong>Chưa có kỷ lục nào</strong>
        <span>Thêm kỷ lục đầu tiên để lưu lại dấu ấn của cầu thủ.</span>
      </div>
    ) : !filteredRecords.length ? (
      <div className="legend-empty-state">Không tìm thấy kỷ lục nào khớp với bộ lọc hiện tại.</div>
    ) : (
      <div className="records-groups-container">
        {RECORD_GROUPS.filter((g) => activeCategory === 'all' || g.id === activeCategory).map((group) => {
          const groupRecords = filteredRecords.filter((r) => group.record_ids.includes(r.record_id));
          if (!groupRecords.length) return null;

          return (
            <section key={group.id} className="record-group-section" id={`group-${group.id}`}>
              <div className="record-category-card">
                <div className="record-category-card-header">
                  <div className="record-category-card-title-wrap">
                    <div className="record-category-icon-wrapper">
                      <group.Icon className="record-category-icon" />
                    </div>
                    <div>
                      <h3 className="record-category-title">{group.title}</h3>
                      <span className="record-category-subtitle">{group.subtitle}</span>
                    </div>
                  </div>
                  <span className="record-category-badge">
                    {searchQuery || selectedPlayer !== 'all'
                      ? `${groupRecords.length} / ${group.record_ids.length} kỷ lục`
                      : `${group.record_ids.length} kỷ lục`}
                  </span>
                </div>
              </div>

              <div className="records-grid">
                {groupRecords.map((record) => renderRecordCard(record))}
              </div>
            </section>
          );
        })}

        {/* Other / Uncategorized records if any */}
        {activeCategory === 'all' && (() => {
          const categorizedIds = new Set(RECORD_GROUPS.flatMap((g) => g.record_ids));
          const otherRecords = filteredRecords.filter((r) => !categorizedIds.has(r.record_id));
          if (!otherRecords.length) return null;
          return (
            <section className="record-group-section" id="group-other">
              <div className="record-category-card">
                <div className="record-category-card-header">
                  <div className="record-category-card-title-wrap">
                    <div className="record-category-icon-wrapper">
                      <Trophy className="record-category-icon" />
                    </div>
                    <div>
                      <h3 className="record-category-title">KỶ LỤC KHÁC</h3>
                      <span className="record-category-subtitle">Other Records</span>
                    </div>
                  </div>
                  <span className="record-category-badge">{otherRecords.length} kỷ lục</span>
                </div>
              </div>
              <div className="records-grid">
                {otherRecords.map((record) => renderRecordCard(record))}
              </div>
            </section>
          );
        })()}
      </div>
    )}

    {/* Bottom Filter & Quick Jump Section */}
    {records.length > 0 && (
      <div className="records-bottom-filter-card">
        <div className="records-bottom-filter-header">
          <div className="records-bottom-filter-title">
            <Filter className="w-4 h-4 text-red-600" />
            <h3>Bộ lọc kỷ lục</h3>
            <span className="records-count-chip">
              Hiển thị <strong>{filteredRecords.length}</strong> / {records.length} kỷ lục
            </span>
          </div>

          <div className="records-bottom-filter-actions">
            {(activeCategory !== 'all' || selectedPlayer !== 'all' || searchQuery.trim()) && (
              <button
                type="button"
                className="records-filter-reset-btn"
                onClick={() => {
                  setActiveCategory('all');
                  setSelectedPlayer('all');
                  setSearchQuery('');
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
            <button
              type="button"
              className="records-scroll-top-btn"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              title="Cuộn lên đầu trang"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Lên đầu trang</span>
            </button>
          </div>
        </div>

        {/* Filter by player */}
        <div className="records-filter-group">
          <span className="records-filter-group-label">Lọc nhanh theo cầu thủ:</span>
          <div className="records-filter-pills">
            <button
              type="button"
              className={`records-filter-pill ${selectedPlayer === 'all' ? 'is-active' : ''}`}
              onClick={() => setSelectedPlayer('all')}
            >
              <span>Tất cả cầu thủ ({records.length})</span>
            </button>
            {playerOptions.map((p) => (
              <button
                key={p.name}
                type="button"
                className={`records-filter-pill ${selectedPlayer === p.name ? 'is-active' : ''}`}
                onClick={() => setSelectedPlayer((prev) => (prev === p.name ? 'all' : p.name))}
              >
                <span>{p.name}</span>
                <small>({p.count})</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    {form && <RecordForm record={form.record_id ? form : null} onClose={() => setForm(null)} onSaved={(saved) => { setRecords((items) => form.record_id ? items.map((item) => item.record_id === saved.record_id ? saved : item) : [...items, saved]); setForm(null); }} />}
    {breakModalRecord && (
      <BreakRecordModal
        record={breakModalRecord}
        onClose={() => setBreakModalRecord(null)}
        onSaved={(saved) => {
          setRecords((items) => items.map((item) => (item.record_id === saved.record_id ? saved : item)));
          setBreakModalRecord(null);
        }}
      />
    )}
    {achieverModalRecord && (
      <AddAchieverModal
        record={achieverModalRecord}
        onClose={() => setAchieverModalRecord(null)}
        onSaved={(saved) => {
          setRecords((items) => items.map((item) => (item.record_id === saved.record_id ? saved : item)));
          setAchieverModalRecord(null);
        }}
      />
    )}
  </section>;
}
