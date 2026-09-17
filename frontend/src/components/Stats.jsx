import React from 'react';
import { BarChart2, TrendingUp, Shield, Activity } from 'lucide-react';

export default function Stats({ stats }) {
  if (!stats) return null;
  const { summary = {} } = stats;

  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fadeIn pb-8">
      
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-red-50 text-red-600">
            <BarChart2 className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-display font-black text-3xl text-red-600 uppercase tracking-tight">
              SQUAD ANALYTICS & STATS
            </h1>
            <p className="text-slate-500 text-sm">
              Comprehensive technical statistics, efficiency ratios, and club performance records.
            </p>
          </div>
        </div>
      </div>

      {/* Ratios & Averages */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">GOALS PER MATCH</span>
          <p className="font-display font-black text-3xl text-red-600">
            {summary.totalMatches ? (summary.totalGoals / summary.totalMatches).toFixed(2) : '0.00'}
          </p>
          <p className="text-[11px] text-slate-400">Team offensive efficiency</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">ASSISTS PER MATCH</span>
          <p className="font-display font-black text-3xl text-slate-900">
            {summary.totalMatches ? (summary.totalAssists / summary.totalMatches).toFixed(2) : '0.00'}
          </p>
          <p className="text-[11px] text-slate-400">Playmaking ratio</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">GOAL CONTRIBUTIONS</span>
          <p className="font-display font-black text-3xl text-red-600">
            {(summary.totalGoals || 0) + (summary.totalAssists || 0)}
          </p>
          <p className="text-[11px] text-slate-400">Combined G + A score</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-400 uppercase">AVERAGE OVR RATING</span>
          <p className="font-display font-black text-3xl text-slate-900">
            {summary.averageRating || '89.5'}
          </p>
          <p className="text-[11px] text-slate-400">Squad strength indicator</p>
        </div>
      </div>

    </div>
  );
}
