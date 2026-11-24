import React from 'react';
import { Home, Users, CalendarDays, Monitor, Layers, Landmark, TrendingUp } from 'lucide-react';
import AjaxLogo from './AjaxLogo';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'players', label: 'Players', icon: Users },
    { id: 'programs', label: 'Programs', icon: Layers },
    { id: 'sessions', label: 'Mùa giải', icon: CalendarDays },
    { id: 'legends', label: 'Ngôi đền huyền thoại', icon: Landmark },
    { id: 'rank-journey', label: 'Hành trình thăng hạng', icon: TrendingUp },
  ];

  return (
    <aside className="app-sidebar">
      
      {/* Top Logo & Title */}
      <div className="sidebar-top">
        <div
          onClick={() => setActiveTab('dashboard')}
          className="sidebar-brand"
        >
          <AjaxLogo size={78} />
          <div>
            <h1>AJAX</h1>
            <p>FOOTBALL CLUB</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`sidebar-link ${
                  isActive
                    ? 'is-active'
                    : ''
                }`}
              >
                <Icon className="sidebar-link-icon" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Local Mode Card */}
      <div className="local-mode-card">
        <div className="local-mode-title">
          <span className="local-dot"></span>
          <span>Local Mode</span>
        </div>
        <p>Running on your machine</p>
        <div className="local-host">
          <Monitor />
          <span>localhost</span>
        </div>
      </div>

    </aside>
  );
}
