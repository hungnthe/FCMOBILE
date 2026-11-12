import React from 'react';
import { BellRing, CalendarDays, Goal, Target } from 'lucide-react';

const MILESTONE_STEP = 50;
const MILESTONE_WINDOW = 5;
const MILESTONE_STATS = [
  { key: 'match', label: 'trận đấu', icon: CalendarDays },
  { key: 'goalAmounts', label: 'bàn thắng', icon: Goal },
  { key: 'assistAmounts', label: 'kiến tạo', icon: Target }
];

function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function milestoneNotifications(players = []) {
  return players.flatMap((player) => MILESTONE_STATS.flatMap((stat) => {
    const current = numberOrZero(player.stats?.[stat.key]);
    const milestone = (Math.floor(current / MILESTONE_STEP) + 1) * MILESTONE_STEP;
    const remaining = milestone - current;

    if (remaining < 1 || remaining > MILESTONE_WINDOW) return [];
    return [{
      id: `${player.player_id || player.id || player.name}-${stat.key}`,
      playerName: player.name || 'Cầu thủ chưa đặt tên',
      current,
      milestone,
      remaining,
      ...stat
    }];
  })).sort((left, right) => left.remaining - right.remaining || left.milestone - right.milestone || left.playerName.localeCompare(right.playerName, 'vi'));
}

function StatCard({ icon: Icon, label, value, hint }) {
  return <div className="metric-card"><div className="metric-icon"><Icon /></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

export default function Dashboard({ stats, players = [], loading }) {
  const data = stats || {};
  const summary = data.summary || {};
  const notifications = milestoneNotifications(players.filter((player) => player.is_active !== false));

  if (loading && !stats) return <div className="loading-state"><div className="spinner" /><p>Loading Champions Squad Dashboard...</p></div>;

  return <div className="dashboard-page">
    <section className="metrics-grid"><StatCard icon={CalendarDays} label="Matches" value={summary.totalMatches ?? 0} hint="Total matches played across all seasons" /></section>
    <section className="dashboard-notifications" aria-labelledby="milestone-notifications-title">
      <div className="dashboard-notifications-heading">
        <div><span><BellRing /> CỘT MỐC CẦU THỦ</span><h2 id="milestone-notifications-title">Thông báo sắp đạt cột mốc</h2><p>Hiển thị khi cầu thủ chỉ còn tối đa 5 trận, bàn thắng hoặc kiến tạo để chạm mốc 50 tiếp theo.</p></div>
        <b>{notifications.length}</b>
      </div>
      {notifications.length ? <div className="milestone-notification-list">{notifications.map((notification) => {
        const Icon = notification.icon;
        return <article className="milestone-notification" key={notification.id}>
          <span className="milestone-notification-icon"><Icon /></span>
          <div className="milestone-notification-copy"><strong>{notification.playerName}</strong><span>Còn <b>{notification.remaining}</b> {notification.label} để chạm mốc <b>{notification.milestone}</b></span></div>
          <div className="milestone-notification-progress"><strong>{notification.current}</strong><span>/ {notification.milestone}</span></div>
        </article>;
      })}</div> : <div className="milestone-notification-empty"><BellRing /><p>Chưa có cầu thủ nào ở gần cột mốc 50 kế tiếp.</p></div>}
    </section>
    <section className="dashboard-banner"><img src="/dashboard-banner.png" alt="Ajax football banner" /></section>
  </div>;
}
