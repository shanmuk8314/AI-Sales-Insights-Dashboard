import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import KPICards from '../components/Dashboard/KPICards';
import SalesCharts from '../components/Dashboard/SalesCharts';
import RecentSalesTable from '../components/Dashboard/RecentSalesTable';
import { Database, AlertTriangle, ArrowRight, Loader2, Sparkles } from 'lucide-react';

function DashboardPage({ setCurrentPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    const res = await axios.get(`${API_URL}/api/dashboard`);
    if (res.data.success) {
      return res.data;
    } else {
      throw new Error('Failed to fetch sales insights dashboard data.');
    }
  };

  useEffect(() => {
    let active = true;
    fetchDashboardData()
      .then(resData => {
        if (active) {
          setData(resData);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error(err);
        if (active) {
          setError('Connection to backend server failed.');
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const getBriefing = () => {
    if (!data) return [];
    const bullets = [];
    const formatCurrencyCompact = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

    // 1. Top performing territory
    const bestT = data.kpis?.bestTerritory;
    if (bestT && bestT.name && bestT.name !== 'N/A') {
      bullets.push(`**Top performing territory**: **${bestT.name}** has the highest sales at **${formatCurrencyCompact(bestT.revenue)}**.`);
    } else {
      bullets.push(`**Top performing territory**: No sales data available for territories.`);
    }

    // 2. Top product
    const topP = data.kpis?.topProduct;
    if (topP && topP.name && topP.name !== 'N/A') {
      bullets.push(`**Top product**: **${topP.name}** is our best-selling product. It made **${formatCurrencyCompact(topP.revenue)}**.`);
    } else {
      bullets.push(`**Top product**: No sales data available for products.`);
    }

    // 3. Major growth trend
    const growth = data.kpis?.totalRevenueGrowth || 0;
    if (growth !== 0) {
      const direction = growth > 0 ? 'grew by' : 'declined by';
      const changeStr = growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;
      bullets.push(`**Major growth trend**: Sales revenue ${direction} **${changeStr}** compared to last month.`);
    } else {
      bullets.push(`**Major growth trend**: Sales revenue stayed the same this month.`);
    }

    // 4. Territory requiring attention
    const weakT = data.kpis?.needsAttention;
    if (weakT && weakT.name && weakT.name !== 'N/A') {
      bullets.push(`**Territory requiring attention**: **${weakT.name}** has low sales of **${formatCurrencyCompact(weakT.revenue)}**. This area needs attention.`);
    } else {
      bullets.push(`**Territory requiring attention**: All sales territories are doing well.`);
    }

    return bullets;
  };

  const formatInsightText = (text) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loader2 className="spinner" size={32} />
        <p style={{ color: 'var(--text-secondary)' }}>Loading sales performance metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="no-data-card animate-slide-up">
        <div className="no-data-icon" style={{ color: 'var(--rose)' }}>
          <AlertTriangle size={28} />
        </div>
        <h3>Server connection issue</h3>
        <p>{error}</p>
        <button 
          className="btn btn-primary" 
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchDashboardData()
              .then(resData => {
                setData(resData);
                setLoading(false);
              })
              .catch(err => {
                console.error(err);
                setError('Connection to backend server failed.');
                setLoading(false);
              });
          }} 
          style={{ marginTop: '8px' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const hasData = data && data.recentSales && data.recentSales.length > 0;

  if (!hasData) {
    return (
      <div className="no-data-card animate-slide-up" style={{ marginTop: '80px' }}>
        <div className="no-data-icon">
          <Database size={28} />
        </div>
        <h3>No sales records in system</h3>
        <p>
          Mediwave Life Sciences database is currently empty. Upload your CSV sales spreadsheet to populate the charts and KPI metrics.
        </p>
        <button 
          className="btn btn-primary" 
          onClick={() => setCurrentPage('upload')}
          style={{ marginTop: '8px' }}
        >
          Go to Upload <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  const briefing = getBriefing();

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Executive Summary</h2>
        <p className="page-subtitle">Interactive sales performance and distribution analysis overview</p>
      </div>

      {briefing.length > 0 && (
        <div 
          className="glass-panel animate-slide-up" 
          style={{ 
            padding: '16px 20px', 
            borderRadius: '12px', 
            marginBottom: '24px', 
            borderLeft: '4px solid var(--primary)', 
            backgroundColor: 'rgba(99, 102, 241, 0.02)' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <Sparkles size={16} style={{ color: 'var(--primary)' }} />
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI Executive Briefing
            </h4>
            <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontWeight: '600', marginLeft: '6px' }}>10s Read</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', lineHeight: '1.45' }}>
            {briefing.map((ins, idx) => (
              <li key={idx} dangerouslySetInnerHTML={{ __html: formatInsightText(ins) }} />
            ))}
          </ul>
        </div>
      )}

      <KPICards kpis={data.kpis} />
      
      <SalesCharts 
        salesTrends={data.salesTrends} 
        salesByRegion={data.salesByRegion} 
      />

      <RecentSalesTable recentSales={data.recentSales} />
    </div>
  );
}

export default DashboardPage;
