import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import KPICards from '../components/Dashboard/KPICards';
import SalesCharts from '../components/Dashboard/SalesCharts';
import RecentSalesTable from '../components/Dashboard/RecentSalesTable';
import { Database, AlertTriangle, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { exportPdfReport } from '../utils/pdfGenerator';
import { toast } from 'react-hot-toast';

function DashboardPage({ setCurrentPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [dbOffline, setDbOffline] = useState(false);
  const isMounted = useRef(false);

  // Filters State
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [filterOptions, setFilterOptions] = useState({ regions: [], products: [], months: [] });

  const fetchDashboardData = async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.region && filters.region !== 'All') params.append('region', filters.region);
    if (filters.product && filters.product !== 'All') params.append('product', filters.product);
    if (filters.month && filters.month !== 'All') params.append('month', filters.month);
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const res = await axios.get(`${API_URL}/api/dashboard${queryString}`);
    if (res.data.success) {
      return res.data;
    } else {
      throw new Error('Failed to fetch sales insights dashboard data.');
    }
  };

  // Fetch filter options and database status once on mount
  useEffect(() => {
    axios.get(`${API_URL}/api/filter-options`)
      .then(res => {
        if (res.data.success) {
          setFilterOptions({
            regions: res.data.regions || [],
            products: res.data.products || [],
            months: res.data.months || []
          });
        }
      })
      .catch(err => console.error("Failed to load filter options:", err.message));

    axios.get(`${API_URL}/api/database-status`)
      .then(res => {
        if (res.data && res.data.postgresConnected === false) {
          setDbOffline(true);
        }
      })
      .catch(() => {
        setDbOffline(true);
      });
  }, []);

  // Fetch data whenever filters change
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchDashboardData({ region: selectedRegion, product: selectedProduct, month: selectedMonth })
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
  }, [selectedRegion, selectedProduct, selectedMonth]);

  // Toast notification for user actions applying filters
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    const filterDesc = [];
    if (selectedRegion !== 'All') filterDesc.push(`Region: ${selectedRegion}`);
    if (selectedProduct !== 'All') filterDesc.push(`Product: ${selectedProduct}`);
    if (selectedMonth !== 'All') {
      const [yr, mn] = selectedMonth.split('-');
      const date = new Date(parseInt(yr, 10), parseInt(mn, 10) - 1, 1);
      const mName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      filterDesc.push(`Month: ${mName}`);
    }
    const appliedMsg = filterDesc.length > 0 ? filterDesc.join(', ') : 'All Transactions';
    toast.success(`Filter applied: ${appliedMsg}`);
  }, [selectedRegion, selectedProduct, selectedMonth]);

  const getBriefing = () => {
    if (!data) return [];
    const bullets = [];
    const formatCurrencyCompact = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
    const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val);

    // 1. Top product
    const topP = data.kpis?.topProduct;
    if (topP && topP.name && topP.name !== 'N/A') {
      bullets.push(`**Top product**: **${topP.name}** is our best-selling product. It made **${formatCurrencyCompact(topP.revenue)}**.`);
    } else {
      bullets.push(`**Top product**: No sales data available for products.`);
    }

    // 2. Weak product
    const weakP = data.kpis?.weakProduct;
    if (weakP && weakP.name && weakP.name !== 'N/A') {
      bullets.push(`**Weak product**: **${weakP.name}** generated the lowest revenue at **${formatCurrencyCompact(weakP.revenue)}**.`);
    } else {
      bullets.push(`**Weak product**: No lagging products identified.`);
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

    // 4. Operational Volume
    const invoices = data.kpis?.totalTransactions || 0;
    const units = data.kpis?.totalUnitsSold || 0;
    if (invoices > 0 || units > 0) {
      bullets.push(`**Operational volume**: Processed **${formatNumber(invoices)} invoices** and sold **${formatNumber(units)} units** over the last 30 days.`);
    } else {
      bullets.push(`**Operational volume**: No transaction data recorded.`);
    }

    return bullets;
  };

  const formatInsightText = (text) => {
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  };

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

  const isDbEmpty = !loading && filterOptions.regions.length === 0;

  if (isDbEmpty) {
    return (
      <div 
        className="glass-panel animate-slide-up" 
        style={{ 
          padding: '64px 32px', 
          textAlign: 'center', 
          maxWidth: '600px', 
          margin: '80px auto 0 auto', 
          borderRadius: '20px', 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          gap: '20px', 
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)' 
        }}
      >
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
          <Database size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>No sales records in system</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
            Mediwave Life Sciences database is currently empty. Upload your CSV sales spreadsheet to populate the charts and KPI metrics.
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => setCurrentPage('upload')}
          style={{ padding: '12px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          Go to Upload <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPdfReport({ region: selectedRegion, product: selectedProduct, month: selectedMonth });
      toast.success('PDF report downloaded successfully!');
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const briefing = getBriefing();

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Executive Summary</h2>
        <p className="page-subtitle">Interactive sales performance and distribution analysis overview</p>
      </div>

      {dbOffline && (
        <div 
          className="glass-panel animate-slide-up" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            padding: '10px 16px', 
            borderRadius: '10px', 
            background: 'rgba(244, 63, 94, 0.06)', 
            border: '1px solid rgba(244, 63, 94, 0.25)', 
            color: 'var(--rose)', 
            fontSize: '0.82rem', 
            marginBottom: '20px' 
          }}
        >
          <Database size={14} style={{ color: 'var(--rose)', flexShrink: 0 }} />
          <span><strong>Offline Failover Mode:</strong> PostgreSQL database is currently unreachable. Operating using local fallback database files.</span>
        </div>
      )}

      {/* Filters & Export Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {/* Region Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>REGION</label>
            <select 
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="filter-select"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                outline: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer',
                minWidth: '120px'
              }}
            >
              <option value="All" style={{ background: '#0f172a' }}>All Regions</option>
              {filterOptions.regions.map(r => (
                <option key={r} value={r} style={{ background: '#0f172a' }}>{r}</option>
              ))}
            </select>
          </div>

          {/* Product Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>PRODUCT</label>
            <select 
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="filter-select"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                outline: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer',
                minWidth: '150px'
              }}
            >
              <option value="All" style={{ background: '#0f172a' }}>All Products</option>
              {filterOptions.products.map(p => (
                <option key={p} value={p} style={{ background: '#0f172a' }}>{p}</option>
              ))}
            </select>
          </div>

          {/* Month Filter */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>MONTH</label>
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="filter-select"
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '8px',
                outline: 'none',
                fontSize: '0.85rem',
                cursor: 'pointer',
                minWidth: '120px'
              }}
            >
              <option value="All" style={{ background: '#0f172a' }}>All Months</option>
              {filterOptions.months.map(m => {
                const [yr, mn] = m.split('-');
                const date = new Date(parseInt(yr, 10), parseInt(mn, 10) - 1, 1);
                const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                return (
                  <option key={m} value={m} style={{ background: '#0f172a' }}>{label}</option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Export Report Button */}
        <button 
          onClick={handleExport}
          disabled={exporting || loading}
          className="btn btn-primary"
          style={{
            alignSelf: 'flex-end',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            fontSize: '0.85rem',
            height: '38px',
            marginTop: 'auto'
          }}
        >
          {exporting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <Database size={16} />
              Export Report
            </>
          )}
        </button>
      </div>

      {!loading && data && (!data.kpis || !data.kpis.totalTransactions) ? (
        <div 
          className="glass-panel animate-slide-up" 
          style={{ 
            padding: '48px 32px', 
            textAlign: 'center', 
            color: 'var(--text-secondary)', 
            marginTop: '24px', 
            borderRadius: '16px', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '16px' 
          }}
        >
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
            <AlertTriangle size={24} style={{ color: 'var(--rose)' }} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>No records match your selection</h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '450px', margin: 0, lineHeight: '1.5' }}>
            No sales transactions were found matching the selected Region, Product, or Month.
          </p>
          <button 
            className="btn btn-primary" 
            onClick={() => {
              setSelectedRegion('All');
              setSelectedProduct('All');
              setSelectedMonth('All');
            }}
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
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

          <KPICards kpis={data?.kpis} loading={loading} />
          
          <SalesCharts 
            salesTrends={data?.salesTrends} 
            salesByRegion={data?.salesByRegion} 
            loading={loading}
          />

          <RecentSalesTable recentSales={data?.recentSales} loading={loading} />
        </>
      )}
    </div>
  );
}

export default DashboardPage;
