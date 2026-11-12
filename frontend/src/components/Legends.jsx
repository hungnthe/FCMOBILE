import React, { useEffect, useMemo, useState } from 'react';
import {
  Award, ArrowDownUp, CalendarDays, ChevronRight, Clapperboard, Medal, Search, X
} from 'lucide-react';
import { getLegends, getNations } from '../services/api';

const AWARDS = [
  { key: 'golden_ball', title: 'Quả bóng vàng', icon: '🥇' },
  { key: 'silver_ball', title: 'Quả bóng bạc', icon: '🥈' },
  { key: 'bronze_ball', title: 'Quả bóng đồng', icon: '🥉' },
  { key: 'top_scorer', title: 'Vua phá lưới', icon: '⚽' },
  { key: 'top_assist', title: 'Vua kiến tạo', icon: '🎯' },
  { key: 'best_transfer', title: 'Bản hợp đồng xuất sắc nhất', icon: '🤝' },
  { key: 'best_goal', title: 'Bàn thắng đẹp nhất', icon: '🎬' }
];

const SORTS = [
  ['total', 'Nhiều danh hiệu nhất'],
  ['golden_ball', 'Quả bóng vàng'],
  ['top_scorer', 'Vua phá lưới'],
  ['top_assist', 'Vua kiến tạo'],
  ['recent', 'Mới được vinh danh'],
  ['name', 'Tên A-Z']
];

const publicAssetUrl = (value) => {
  if (!value) return '';
  const source = Array.isArray(value) ? value[0] : value;
  return String(source).startsWith('public/') ? `/${String(source).slice(7)}` : String(source);
};

const cardImageOf = (legend) => publicAssetUrl(
  legend.player?.currentCard?.imageCard || legend.player?.imageCard?.[0]
);

function AwardBreakdown({ legend, compact = false }) {
  return <div className={`legend-award-breakdown${compact ? ' is-compact' : ''}`}>
    {AWARDS.filter(({ key }) => legend.awards?.[key] > 0).map(({ key, title, icon }) => (
      <span key={key} title={title}><i>{icon}</i>{legend.awards[key]}<small>{compact ? '' : title}</small></span>
    ))}
  </div>;
}

function LegendAvatar({ legend }) {
  const image = cardImageOf(legend);
  return <div className="legend-player-avatar">{image ? <img src={image} alt="" /> : <Medal />}</div>;
}

function DetailModal({ legend, onClose }) {
  if (!legend) return null;
  return <div className="session-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="legend-detail-modal" role="dialog" aria-modal="true" aria-labelledby="legend-detail-title">
      <button className="session-close-button" onClick={onClose} aria-label="Đóng"><X /></button>
      <div className="legend-detail-hero">
        <LegendAvatar legend={legend} />
        <div><span className="session-eyebrow">HALL OF LEGENDS</span><h2 id="legend-detail-title">{legend.player?.name}</h2><p>{legend.player?.position?.join?.(', ') || 'Cầu thủ Ajax'} · {legend.totalAwards} danh hiệu</p></div>
      </div>
      <AwardBreakdown legend={legend} />
      <div className="legend-detail-history">
        <div className="legend-section-heading"><div><span className="session-eyebrow">HONOUR ROLL</span><h3>Lịch sử vinh danh</h3></div><strong>{legend.history.length}</strong></div>
        {legend.history.map((item, index) => <article className="legend-history-item" key={`${item.session_id}-${item.key}-${index}`}>
          <span className="legend-history-icon">{AWARDS.find((award) => award.key === item.key)?.icon}</span>
          <div><strong>{item.title}</strong><span>{item.session_title || `Mùa giải ${item.season}`} · {item.season || '—'}</span></div>
          {item.video && <a href={publicAssetUrl(item.video)} target="_blank" rel="noreferrer" className="legend-video-link"><Clapperboard /> Video</a>}
        </article>)}
      </div>
      {legend.history.some((item) => item.video) && <div className="legend-video-block"><span className="session-eyebrow">BEST GOAL</span><h3>Bàn thắng đẹp nhất</h3>{legend.history.filter((item) => item.video).map((item, index) => <video key={`${item.video}-${index}`} controls preload="metadata" src={publicAssetUrl(item.video)} />)}</div>}
    </section>
  </div>;
}

function CategoryView({ data, nations = [], onSelect }) {
  const [categoryKey, setCategoryKey] = useState('golden_ball');
  const [nationFilter, setNationFilter] = useState('ALL');
  const category = data.categories?.[categoryKey] || {};
  const definition = AWARDS.find((item) => item.key === categoryKey);
  const legendById = new Map((data.legends || []).map((legend) => [Number(legend.player_id), legend]));
  const records = (category.records || []).filter((record) => {
    const legend = legendById.get(Number(record.player_id));
    const playerNationId = legend?.player?.nation?.nation_id ?? legend?.player?.nation?.id ?? legend?.player?.nation;
    return nationFilter === 'ALL' || String(playerNationId) === String(nationFilter);
  });
  return <section className="legend-category-view">
    <div className="legend-category-tabs" role="tablist" aria-label="Các hạng mục danh hiệu">
      {AWARDS.map((item) => <button key={item.key} className={categoryKey === item.key ? 'is-active' : ''} onClick={() => setCategoryKey(item.key)} role="tab" aria-selected={categoryKey === item.key}><span>{item.icon}</span>{item.title}</button>)}
    </div>
    <div className="legend-category-heading"><div><span className="session-eyebrow">{definition?.icon} CATEGORY RECORD</span><h2>{category.title || definition?.title}</h2><p>{category.totalAwards || 0} lần trao · {category.playersCount || 0} cầu thủ</p></div><label className="legend-filter"><select value={nationFilter} onChange={(event) => setNationFilter(event.target.value)} aria-label="Lọc danh hiệu theo nation"><option value="ALL">Tất cả nation</option>{nations.map((nation) => <option key={nation.nation_id} value={nation.nation_id}>{nation.name}</option>)}</select></label></div>
    <div className="legend-category-records">{records.map((record, index) => { const legend = legendById.get(Number(record.player_id)); return <button key={record.player_id} onClick={() => legend && onSelect(legend)}><strong>#{index + 1}</strong>{legend && <LegendAvatar legend={legend} />}<span>{record.name}<small>{record.count} danh hiệu</small></span><ChevronRight /></button>; })}</div>
    {!records.length && <div className="legend-empty-state">Chưa có danh hiệu phù hợp với nation đã chọn.</div>}
  </section>;
}

export default function Legends() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nations, setNations] = useState([]);
  const [query, setQuery] = useState('');
  const [nationFilter, setNationFilter] = useState('ALL');
  const [sort, setSort] = useState('total');
  const [view, setView] = useState('legends');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getLegends(), getNations()]).then(([result, nationList]) => { if (active) { setData(result); setNations(Array.isArray(nationList) ? nationList : []); } }).catch(() => { if (active) setError('Không thể tải dữ liệu Ngôi đền huyền thoại.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const legends = useMemo(() => {
    const items = (data?.legends || []).filter((legend) => {
      const matchesName = String(legend.player?.name || '').toLowerCase().includes(query.trim().toLowerCase());
      const playerNationId = legend.player?.nation?.nation_id ?? legend.player?.nation?.id ?? legend.player?.nation;
      return matchesName && (nationFilter === 'ALL' || String(playerNationId) === String(nationFilter));
    });
    return items.sort((left, right) => {
      if (sort === 'name') return String(left.player?.name || '').localeCompare(String(right.player?.name || ''), 'vi');
      if (sort === 'recent') return Number(right.history?.[0]?.session_id || 0) - Number(left.history?.[0]?.session_id || 0) || String(left.player?.name || '').localeCompare(String(right.player?.name || ''), 'vi');
      const primaryKey = sort === 'total' ? 'totalAwards' : sort;
      return Number(right[primaryKey] || right.awards?.[primaryKey] || 0) - Number(left[primaryKey] || left.awards?.[primaryKey] || 0) || Number(right.awards?.golden_ball || 0) - Number(left.awards?.golden_ball || 0) || Number(right.awards?.top_scorer || 0) - Number(left.awards?.top_scorer || 0) || Number(right.awards?.top_assist || 0) - Number(left.awards?.top_assist || 0) || String(left.player?.name || '').localeCompare(String(right.player?.name || ''), 'vi');
    });
  }, [data, nationFilter, query, sort]);

  if (loading) return <div className="loading-state"><div className="spinner" /><p>Đang mở Ngôi đền huyền thoại...</p></div>;
  if (error) return <div className="legend-empty-state">{error}</div>;
  const summary = data?.summary || {};
  const topThree = (data?.legends || []).slice(0, 3);

  return <div className="legends-page">
    <section className="legends-hero"><img className="legends-hero-image" src="/SessionImages/THE_legancy.png" alt="Ngôi đền huyền thoại Ajax" /></section>
    <section className="legends-summary" aria-label="Tổng quan danh hiệu"><div><CalendarDays /><strong>{summary.seasons || 0}</strong><span>Mùa giải</span></div><div><Medal /><strong>{summary.categories || AWARDS.length}</strong><span>Hạng mục chính thức</span></div></section>
    <div className="legend-view-switcher"><button className={view === 'legends' ? 'is-active' : ''} onClick={() => setView('legends')}>Cầu thủ huyền thoại</button><button className={view === 'awards' ? 'is-active' : ''} onClick={() => setView('awards')}>Danh hiệu</button></div>
    {view === 'awards' ? <CategoryView data={data} nations={nations} onSelect={setSelected} /> : <>
      <section className="legend-top-section"><div className="legend-section-heading"><div><span className="session-eyebrow">THE IMMORTALS</span><h2>Những tượng đài</h2><p>Ba cầu thủ đang dẫn đầu bảng vàng của Ajax.</p></div><Medal /></div><div className="legend-podium">{topThree.map((legend, index) => <button key={legend.player_id} className={`legend-podium-card rank-${index + 1}`} onClick={() => setSelected(legend)}><span className="legend-rank">{['🥇', '🥈', '🥉'][index]}</span><LegendAvatar legend={legend} /><strong>{legend.player?.name}</strong><span>{legend.totalAwards} danh hiệu</span><AwardBreakdown legend={legend} compact /></button>)}</div></section>
      <section className="legend-directory"><div className="legend-directory-heading"><div><span className="session-eyebrow">THE ARCHIVE</span><h2>Danh sách huyền thoại</h2></div><span>{legends.length} kết quả</span></div><div className="legend-toolbar"><label className="legend-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên cầu thủ..." aria-label="Tìm cầu thủ huyền thoại" /></label><label className="legend-filter"><select value={nationFilter} onChange={(event) => setNationFilter(event.target.value)} aria-label="Lọc theo quốc gia"><option value="ALL">Tất cả nation</option>{nations.map((nation) => <option key={nation.nation_id} value={nation.nation_id}>{nation.name}</option>)}</select></label><label className="legend-sort"><ArrowDownUp /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sắp xếp danh sách">{SORTS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div><div className="legend-grid">{legends.map((legend) => <button className="legend-card" key={legend.player_id} onClick={() => setSelected(legend)}><LegendAvatar legend={legend} /><div className="legend-card-copy"><strong>{legend.player?.name}</strong><span>{legend.player?.currentCard?.program?.name || legend.player?.program?.[0] || 'Ajax player'} · OVR {legend.player?.ovr || '—'}</span><AwardBreakdown legend={legend} /></div><div className="legend-card-total"><b>{legend.totalAwards}</b><small>Danh hiệu</small></div><ChevronRight /></button>)}</div>{!legends.length && <div className="legend-empty-state">Không có cầu thủ phù hợp với tìm kiếm.</div>}</section>
    </>}
    <DetailModal legend={selected} onClose={() => setSelected(null)} />
  </div>;
}
