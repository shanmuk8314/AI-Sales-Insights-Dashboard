import { BarChart3, TrendingUp, UploadCloud, Database } from 'lucide-react';

function Navbar({ currentPage, setCurrentPage }) {
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: <BarChart3 size={20} /> },
    { id: 'insights', name: 'AI Insights', icon: <TrendingUp size={20} /> },
    { id: 'upload', name: 'Upload Sales', icon: <UploadCloud size={20} /> }
  ];

  return (
    <nav className="sidebar">
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
              onClick={() => setCurrentPage(item.id)}
              className={`menu-link ${currentPage === item.id ? 'active' : ''}`}
              style={{ background: 'none', width: '100%', border: 'none', textAlign: 'left' }}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar-footer">
        <p>Mediwave Life Sciences</p>
        <p style={{ marginTop: '4px', opacity: 0.5 }}>v1.0 (MVP)</p>
      </div>
    </nav>
  );
}

export default Navbar;
