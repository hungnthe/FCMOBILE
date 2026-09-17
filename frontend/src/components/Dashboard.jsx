import React from 'react';
import { CalendarDays } from 'lucide-react';

function StatCard({ icon: Icon, label, value, hint }) {
  return <div className="metric-card"><div className="metric-icon"><Icon /></div><div><span>{label}</span><strong>{value}</strong><small>{hint}</small></div></div>;
}

export default function Dashboard({ stats, loading }) {
  const data = stats || {};
  const summary = data.summary || {};

  if (loading && !stats) return <div className="loading-state"><div className="spinner" /><p>Loading Champions Squad Dashboard...</p></div>;

  return <div className="dashboard-page">
    <section className="metrics-grid"><StatCard icon={CalendarDays} label="Matches" value={summary.totalMatches ?? 0} hint="Total matches played across all seasons" /></section>
    <section className="dashboard-banner"><img src="/dashboard-banner.png" alt="Ajax football banner" /></section>
  </div>;
}
