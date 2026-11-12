import React from 'react';

const STAT_DEFINITIONS = [
  ['matches', 'Trận'],
  ['goals', 'Bàn'],
  ['assists', 'KT'],
  ['bestPlayer', 'MVP']
];

export default function PlayerStatsSummary({ stats = {}, className = '', variant = 'summary', resultTrackingEnabled = false }) {
  const definitions = resultTrackingEnabled ? [...STAT_DEFINITIONS, ['wins', 'W'], ['draws', 'D'], ['losses', 'L']] : STAT_DEFINITIONS;
  if (variant === 'table') return <>{definitions.map(([key]) => <td className="season-stat-cell" key={key}>{stats[key] ?? 0}</td>)}</>;
  return <div className={`player-stats-summary ${className}`.trim()} aria-label="Thống kê cầu thủ">
    {definitions.map(([key, label]) => <div className="player-stat-block" key={key}><strong>{stats[key] ?? 0}</strong><span>{label}</span></div>)}
  </div>;
}
