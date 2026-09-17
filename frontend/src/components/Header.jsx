import React from 'react';
import { Menu, Sun, User, ChevronDown } from 'lucide-react';

export default function Header({ onOpenSidebar }) {
  return (
    <header className="app-header">
      
      {/* Left Menu Toggle */}
      <button 
        onClick={onOpenSidebar}
        className="menu-button"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Right User Actions */}
      <div className="header-actions">
        {/* Sun Theme Icon */}
        <button className="icon-button" aria-label="Toggle theme">
          <Sun className="w-5 h-5" />
        </button>

        {/* User Profile Pill */}
        <div className="profile-chip">
          <div className="avatar">
            A
          </div>
          <div className="profile-copy">
            <p>Admin</p>
            <span>Local User</span>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

    </header>
  );
}
