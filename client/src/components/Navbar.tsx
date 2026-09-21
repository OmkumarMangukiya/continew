/*
  Navbar.tsx — Application shell navigation header.
  Includes brand identity, active tab switching, authenticated user badge, and logout action.
*/

import React from 'react';
import { useAuthContext } from '../context/useAuthContext';
import { Activity, Webhook, Key, Send, LogOut, User } from 'lucide-react';
import './Navbar.css';

export type AppTab = 'dashboard' | 'endpoints' | 'apikeys' | 'test-event';

interface NavbarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onSelectTab }) => {
  const { user, logout } = useAuthContext();

  const tabs: Array<{ id: AppTab; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: 'Live Delivery', icon: <Activity size={15} /> },
    { id: 'endpoints', label: 'Endpoints', icon: <Webhook size={15} /> },
    { id: 'apikeys', label: 'API Keys', icon: <Key size={15} /> },
    { id: 'test-event', label: 'Send Event', icon: <Send size={15} /> },
  ];

  return (
    <header className="app-navbar">
      <div className="app-navbar__content">
        {/* Brand */}
        <div className="navbar-brand">
          <span className="brand-title">Continew</span>
          <span className="brand-badge">v1.0</span>
        </div>

        {/* Navigation Tabs */}
        <nav className="navbar-tabs" aria-label="Main Navigation">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab-btn ${isActive ? 'nav-tab-btn--active' : ''}`}
                onClick={() => onSelectTab(tab.id)}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile & Actions */}
        <div className="navbar-user-section">
          {user && (
            <div className="user-pill" title={`Logged in as ${user.email}`}>
              <User size={13} className="user-icon" />
              <span className="username">{user.username || user.email}</span>
            </div>
          )}
          <button
            type="button"
            className="logout-btn"
            onClick={logout}
            title="Sign out of Continew"
          >
            <LogOut size={15} />
            <span className="logout-label">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
