import React from 'react';
import { LayoutDashboard, Users, PlusCircle, FileSpreadsheet, Trophy, Sparkles } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, onOpenAddModal }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'squad', label: 'Squad Collection', icon: Users },
    { id: 'import', label: 'Excel Import', icon: FileSpreadsheet },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#0a0e17]/90 backdrop-blur-xl border-b border-amber-500/20 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand Logo */}
        <div 
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 p-0.5 shadow-gold-glow group-hover:scale-105 transition-transform duration-300">
            <div className="w-full h-full bg-[#0a0e17] rounded-[14px] flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-400 group-hover:rotate-12 transition-transform" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-display font-black text-2xl tracking-wider text-white">FC</span>
              <span className="font-display font-black text-2xl tracking-wider bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">MANAGER</span>
            </div>
            <p className="text-[10px] font-bold text-amber-400/80 uppercase tracking-widest -mt-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 inline" /> Ultimate Collection
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-2xl border border-white/10">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 px-5 py-2.5 rounded-xl font-extrabold text-sm shadow-gold-glow hover:scale-105 active:scale-95 transition-all duration-200"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Create Card</span>
          </button>
        </div>

      </div>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex items-center justify-around bg-slate-900/95 border-t border-white/10 py-2 px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-bold ${
                isActive ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
