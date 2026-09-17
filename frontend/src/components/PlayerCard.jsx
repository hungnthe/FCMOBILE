import React from 'react';
import { Award, Zap, Trophy, Shield, Activity, Target } from 'lucide-react';

function publicAssetUrl(value) {
  if (!value) return '';
  return value.startsWith('public/') ? `/${value.slice('public/'.length)}` : value;
}

export default function PlayerCard({ player, onClick, onEdit, onDelete, compact = false }) {
  if (!player) return null;

  const name = player.name || 'Unknown Player';
  const rating = player.ovr ?? player.rating ?? 75;
  const position = Array.isArray(player.position) ? player.position.join(', ') : (player.position || 'CM');
  const nation = player.nation || 'Unknown';
  const club = Array.isArray(player.program) ? player.program.join(' • ') : (player.program || player.club || 'Unknown');
  const cardType = player.Status_I_H_M || player.cardType || 'Gold';
  const photoUrl = publicAssetUrl(player.imageCard?.[0] || player.metadata?.imageCard?.[0] || player.metadata?.image || player.photoUrl);
  const pac = player.pac ?? 70;
  const sho = player.sho ?? 70;
  const pas = player.pas ?? 70;
  const dri = player.dri ?? 70;
  const def = player.def ?? 70;
  const phy = player.phy ?? 70;
  const goals = player.stats?.goalAmounts ?? player.goals ?? 0;
  const assists = player.stats?.assistAmounts ?? player.assists ?? 0;
  const matches = player.stats?.match ?? player.matches ?? 0;
  const motm = player.stats?.bestPlayerAmount ?? player.motm ?? 0;

  // Determine styles by cardType
  const getCardTheme = () => {
    switch (cardType?.toUpperCase()) {
      case 'TOTY':
        return {
          bg: 'bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-950',
          border: 'border-blue-400/60 shadow-toty-glow',
          badgeBg: 'bg-blue-600/30 text-blue-300 border-blue-400/40',
          textColor: 'text-blue-100',
          ratingColor: 'text-amber-300 text-glow-gold',
          accent: 'from-blue-500 to-indigo-600',
          label: 'TEAM OF THE YEAR'
        };
      case 'ICON':
        return {
          bg: 'bg-gradient-to-b from-amber-800 via-yellow-950 to-stone-950',
          border: 'border-amber-400/80 shadow-icon-glow',
          badgeBg: 'bg-amber-500/30 text-amber-200 border-amber-400/50',
          textColor: 'text-amber-100',
          ratingColor: 'text-amber-300 text-glow-gold',
          accent: 'from-amber-400 to-yellow-600',
          label: 'ULTIMATE ICON'
        };
      case 'FUTTIES':
        return {
          bg: 'bg-gradient-to-b from-pink-900 via-rose-950 to-slate-950',
          border: 'border-pink-500/70 shadow-futties-glow',
          badgeBg: 'bg-pink-500/30 text-pink-200 border-pink-400/40',
          textColor: 'text-pink-100',
          ratingColor: 'text-pink-300',
          accent: 'from-pink-500 to-rose-600',
          label: 'FUTTIES SPECIAL'
        };
      case 'HERO':
        return {
          bg: 'bg-gradient-to-b from-emerald-900 via-teal-950 to-slate-950',
          border: 'border-emerald-400/60',
          badgeBg: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40',
          textColor: 'text-emerald-100',
          ratingColor: 'text-emerald-300',
          accent: 'from-emerald-400 to-teal-600',
          label: 'CLUB HERO'
        };
      default: // GOLD
        return {
          bg: 'bg-gradient-to-b from-amber-900/90 via-amber-950 to-slate-950',
          border: 'border-amber-500/50 shadow-gold-glow',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          textColor: 'text-amber-100',
          ratingColor: 'text-amber-300 text-glow-gold',
          accent: 'from-amber-400 to-amber-600',
          label: 'GOLD RARE'
        };
    }
  };

  const theme = getCardTheme();
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=f5c542&size=200&font-size=0.4`;

  if (compact) {
    return (
      <div 
        onClick={onClick}
        className={`group relative p-3 rounded-xl border ${theme.bg} ${theme.border} transition-all duration-300 hover:scale-105 cursor-pointer flex items-center gap-3`}
      >
        <div className="relative w-12 h-14 rounded-lg overflow-hidden border border-white/20 bg-slate-800 flex-shrink-0 flex items-center justify-center">
          <img 
            src={photoUrl || defaultAvatar} 
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = defaultAvatar; }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`font-display font-extrabold text-lg ${theme.ratingColor}`}>{rating}</span>
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 font-bold uppercase tracking-wider">{position}</span>
          </div>
          <p className="font-bold text-sm text-slate-100 truncate">{name}</p>
          <p className="text-xs text-slate-400 truncate">{club}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      onClick={onClick}
      className={`group relative w-full max-w-[280px] mx-auto rounded-3xl border-2 ${theme.bg} ${theme.border} p-4 text-white shadow-2xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl card-shimmer cursor-pointer select-none`}
    >
      {/* Top Banner & Shield Badge */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${theme.badgeBg} border`}>
          {theme.label}
        </span>
        {motm > 0 && (
          <div className="flex items-center gap-1 text-amber-300 text-xs font-bold bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>{motm} MOTM</span>
          </div>
        )}
      </div>

      {/* Rating + Position + Face Image */}
      <div className="relative flex items-start justify-between mb-3 px-1">
        {/* Left Stats Column */}
        <div className="flex flex-col items-center z-10">
          <span className={`font-display font-black text-4xl leading-none ${theme.ratingColor} tracking-tighter`}>
            {rating}
          </span>
          <span className="font-display font-extrabold text-lg uppercase tracking-wider text-slate-200 mt-1">
            {position}
          </span>
          <div className="w-6 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent my-1"></div>
          <span className="text-[11px] font-bold text-slate-300 text-center max-w-[65px] truncate">
            {nation}
          </span>
        </div>

        {/* Player Avatar */}
        <div className="relative w-36 h-36 mx-auto -mt-2">
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent blur-md"></div>
          <img 
            src={photoUrl || defaultAvatar} 
            alt={name}
            className="w-full h-full object-cover rounded-2xl drop-shadow-xl border border-white/10 transition-transform duration-300 group-hover:scale-105"
            onError={(e) => { e.target.src = defaultAvatar; }}
          />
        </div>
      </div>

      {/* Name Header */}
      <div className="text-center my-2">
        <h3 className="font-display font-black text-xl uppercase tracking-wide truncate drop-shadow text-white">
          {name}
        </h3>
        <p className="text-xs font-medium text-slate-300 truncate">
          {club}
        </p>
      </div>

      <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-2"></div>

      {/* FUT Attribute Stats Grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-2 py-1 text-sm font-display font-bold">
        <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
          <span className="text-slate-400 text-xs">PAC</span>
          <span className="text-amber-300">{pac}</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
          <span className="text-slate-400 text-xs">DRI</span>
          <span className="text-amber-300">{dri}</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
          <span className="text-slate-400 text-xs">SHO</span>
          <span className="text-amber-300">{sho}</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
          <span className="text-slate-400 text-xs">DEF</span>
          <span className="text-amber-300">{def}</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
          <span className="text-slate-400 text-xs">PAS</span>
          <span className="text-amber-300">{pas}</span>
        </div>
        <div className="flex justify-between items-center bg-white/5 px-2 py-1 rounded">
          <span className="text-slate-400 text-xs">PHY</span>
          <span className="text-amber-300">{phy}</span>
        </div>
      </div>

      {/* Record Stats Bar (Matches / Goals / Assists) */}
      <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-around text-center text-xs">
        <div>
          <span className="block text-slate-400 text-[10px]">MATCHES</span>
          <span className="font-bold text-slate-200">{matches}</span>
        </div>
        <div className="w-px h-6 bg-white/10"></div>
        <div>
          <span className="block text-emerald-400 text-[10px]">GOALS</span>
          <span className="font-bold text-emerald-300">{goals}</span>
        </div>
        <div className="w-px h-6 bg-white/10"></div>
        <div>
          <span className="block text-blue-400 text-[10px]">ASSISTS</span>
          <span className="font-bold text-blue-300">{assists}</span>
        </div>
      </div>

      {/* Action Hover Buttons */}
      {(onEdit || onDelete) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-slate-950/80 backdrop-blur p-1 rounded-lg border border-white/20">
          {onEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(player); }}
              className="p-1 text-slate-300 hover:text-amber-400 transition"
              title="Edit Card"
            >
              ✏️
            </button>
          )}
          {onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(player.player_id ?? player.id); }}
              className="p-1 text-slate-300 hover:text-rose-400 transition"
              title="Delete Card"
            >
              🗑️
            </button>
          )}
        </div>
      )}
    </div>
  );
}
