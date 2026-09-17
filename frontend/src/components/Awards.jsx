import React from 'react';
import { Trophy, Award, Medal, Star, ShieldCheck } from 'lucide-react';

export default function Awards({ players = [] }) {
  const sortedByMotm = [...players].sort((a, b) => (b.motm || 0) - (a.motm || 0));

  return (
    <div className="space-y-6 font-sans text-slate-800 animate-fadeIn pb-8">
      
      {/* Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-red-50 text-red-600">
            <Trophy className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-display font-black text-3xl text-red-600 uppercase tracking-tight">
              PLAYER AWARDS & HONORS
            </h1>
            <p className="text-slate-500 text-sm">
              Celebrating individual excellence, Man of the Match awards, and top player honors.
            </p>
          </div>
        </div>
      </div>

      {/* Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sortedByMotm.slice(0, 3).map((player, idx) => {
          const ranks = [
            { label: 'GOLD WINNER', color: 'bg-amber-100 text-amber-800 border-amber-300', badge: '🥇 #1' },
            { label: 'SILVER RUNNER-UP', color: 'bg-slate-100 text-slate-700 border-slate-300', badge: '🥈 #2' },
            { label: 'BRONZE PODIUM', color: 'bg-orange-100 text-orange-800 border-orange-300', badge: '🥉 #3' },
          ];
          const rank = ranks[idx];
          return (
            <div key={player.id} className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col items-center text-center space-y-4">
              <span className={`px-3 py-1 rounded-full text-xs font-black border ${rank.color}`}>
                {rank.badge} {rank.label}
              </span>
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 shadow-md">
                <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-extrabold text-lg text-slate-900">{player.name}</h3>
                <p className="text-xs text-slate-400 font-medium">{player.position} • {player.club}</p>
              </div>
              <div className="w-full bg-red-50 rounded-2xl p-4 border border-red-100">
                <span className="block text-xs font-bold text-red-500 uppercase">BEST PLAYER WINS</span>
                <span className="font-display font-black text-3xl text-red-600">{player.motm}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Awards Standings Table */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
        <h2 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
          <Medal className="w-5 h-5 text-red-600" />
          Full MOTM Leaderboard Standings
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[10px] text-slate-400 border-b border-slate-100 font-bold uppercase">
                <th className="py-2.5">Rank</th>
                <th className="py-2.5">Player Name</th>
                <th className="py-2.5">Position</th>
                <th className="py-2.5">Club</th>
                <th className="py-2.5 text-center">Matches</th>
                <th className="py-2.5 text-center">Best Player Wins</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sortedByMotm.map((p, index) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3 font-bold text-slate-400">#{index + 1}</td>
                  <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                    <span>{p.name}</span>
                    {index === 0 && <span className="text-amber-500 text-xs">👑</span>}
                  </td>
                  <td className="py-3 text-slate-500">{p.position}</td>
                  <td className="py-3 text-slate-500">{p.club}</td>
                  <td className="py-3 text-center text-slate-700 font-bold">{p.matches}</td>
                  <td className="py-3 text-center text-red-600 font-black text-sm">{p.motm}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
