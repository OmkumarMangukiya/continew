/*
  App.tsx — Application root container.
  Orchestrates auth state checking, navigation tab switching, and page composition.
*/

import { useState } from 'react';
import { useAuthContext } from './context/useAuthContext';
import { Navbar, type AppTab } from './components/Navbar';
import { AuthPage } from './pages/AuthPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { EventTesterPage } from './pages/EventTesterPage';
import { LiveDeliveryPage } from './pages/LiveDeliveryPage';
import { RefreshCw } from 'lucide-react';
import './App.css';

export default function App() {
  const { isAuthenticated, isLoading } = useAuthContext();
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');

  // Initial session verification loader
  if (isLoading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-content">
          <div className="app-loading-logo">Continew</div>
          <div className="app-loading-status">
            <RefreshCw size={16} className="spin-icon" />
            <span>Connecting to session...</span>
          </div>
        </div>
      </div>
    );
  }

  // Not logged in -> Show authentication page
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Logged in -> Show dashboard shell
  return (
    <div className="app-shell">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />
      <main className="app-main-content">
        {activeTab === 'dashboard' && <LiveDeliveryPage />}
        {activeTab === 'endpoints' && <EndpointsPage />}
        {activeTab === 'apikeys' && <ApiKeysPage />}
        {activeTab === 'test-event' && (
          <EventTesterPage onNavigateToLiveDelivery={() => setActiveTab('dashboard')} />
        )}
      </main>
    </div>
  );
}
