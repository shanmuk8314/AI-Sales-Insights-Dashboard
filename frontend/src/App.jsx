import { useState } from 'react';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import InsightsPage from './pages/InsightsPage';
import UploadPage from './pages/UploadPage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

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
      <Navbar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <main className="content-area">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
