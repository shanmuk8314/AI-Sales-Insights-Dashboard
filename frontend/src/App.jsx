import { useState } from 'react';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import InsightsPage from './pages/InsightsPage';
import UploadPage from './pages/UploadPage';

import { Menu, X, Database } from 'lucide-react';
import { Toaster } from 'react-hot-toast';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 1024 : false
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage setCurrentPage={setCurrentPage} />;
      case 'insights':
        return <InsightsPage setCurrentPage={setCurrentPage} />;
      case 'upload':
        return <UploadPage onUploadSuccess={() => setCurrentPage('dashboard')} />;

      default:
        return <DashboardPage setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <div className="app-container">
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontFamily: 'var(--font-body)',
            padding: '12px 16px',
            maxWidth: '400px'
          },
          success: {
            iconTheme: {
              primary: 'var(--emerald)',
              secondary: '#0b0f19',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--rose)',
              secondary: '#0b0f19',
            },
          },
        }}
      />
      {/* Mobile Header */}
      <div className="mobile-header">
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{ 
            background: 'none', 
            border: 'none', 
            color: 'var(--text-primary)', 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center',
            padding: '8px'
          }}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} color="var(--primary)" />
          <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>Mediwave Sales</span>
        </div>
        <div style={{ width: '40px' }}></div>
      </div>

      <Navbar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        isCollapsed={sidebarCollapsed}
        setIsCollapsed={setSidebarCollapsed}
        isOpen={mobileMenuOpen}
        setIsOpen={setMobileMenuOpen}
      />
      
      <main className={`content-area ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {renderPage()}
      </main>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div 
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            top: '60px',
            left: 0,
            width: '100vw',
            height: 'calc(100vh - 60px)',
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 998
          }}
        />
      )}
    </div>
  );
}

export default App;
