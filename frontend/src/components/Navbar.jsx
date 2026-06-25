import { BarChart3, TrendingUp, UploadCloud, Database, ChevronLeft, ChevronRight } from 'lucide-react';

function Navbar({ currentPage, setCurrentPage, isCollapsed, setIsCollapsed, isOpen, setIsOpen }) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <BarChart3 size={20} /> },
    { id: 'insights', name: 'AI Insights', icon: <TrendingUp size={20} /> },
    { id: 'upload', name: 'Upload Sales', icon: <UploadCloud size={20} /> }
  ];

  const handleLinkClick = (id) => {
    setCurrentPage(id);
    if (setIsOpen) {
      setIsOpen(false);
    }
  };

  return (
    <nav className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-logo">
          <Database size={20} color="#fff" />
        </div>
        <span className="brand-text">Mediwave Sales</span>
      </div>

      <ul className="sidebar-menu">
        {menuItems.map((item) => (
          <li key={item.id} className="menu-item">
            <button
              onClick={() => handleLinkClick(item.id)}
              className={`menu-link ${currentPage === item.id ? 'active' : ''}`}
              style={{ background: 'none', width: '100%', border: 'none', textAlign: 'left' }}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Sidebar Collapse Toggle Button */}
      <div className="sidebar-toggle-container" style={{ marginTop: 'auto', display: 'flex', justifyContent: isCollapsed ? 'center' : 'flex-end', paddingTop: '16px' }}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="collapse-toggle-btn"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="sidebar-footer">
        <p>Mediwave Life Sciences</p>
        <p style={{ marginTop: '4px', opacity: 0.5 }}>v1.0.0 (Stable)</p>
      </div>
    </nav>
  );
}

export default Navbar;
