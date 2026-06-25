import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Sparkles, FileText, Award, MapPin, TrendingDown, TrendingUp, Lightbulb, AlertTriangle, Loader2, Globe, AlertCircle, Tag, Database, ArrowRight } from 'lucide-react';
import { API_URL } from '../config/api';
import { exportPdfReport } from '../utils/pdfGenerator';
import { toast } from 'react-hot-toast';

function InsightsPage({ setCurrentPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [metadata, setMetadata] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const isMounted = useRef(false);

  // Filters State
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [filterOptions, setFilterOptions] = useState({ regions: [], products: [], months: [] });

  const stripMarkdown = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*|__/g, '') // remove bold markers
      .replace(/#/g, '')       // remove headers
      .replace(/^[\s-*+]+|[\r\n]+[\s-*+]+/g, ' ') // remove bullet markers
      .replace(/`([^`]+)`/g, '$1') // remove code ticks
      .replace(/\s+/g, ' ') // collapse extra whitespaces
      .trim();
  };

  const formatLastUpdated = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const datePart = date.toLocaleDateString('en-GB', options);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${datePart}, ${hours}:${minutes} ${ampm}`;
  };

  const fetchInsights = async (forceRefresh = false, filters = {}) => {
    const queryParams = new URLSearchParams();
    if (filters.region && filters.region !== 'All') queryParams.append('region', filters.region);
    if (filters.product && filters.product !== 'All') queryParams.append('product', filters.product);
    if (filters.month && filters.month !== 'All') queryParams.append('month', filters.month);
    if (forceRefresh) queryParams.append('refresh', 'true');

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    const url = `${API_URL}/api/ai-insights${queryString}`;
    
    const res = await axios.get(url, { timeout: 20000 });
    if (res.data.success && res.data.insights) {
      console.log('Successfully fetched insights.');
      if (res.data.metadata) {
        setMetadata(res.data.metadata);
      }
      return {
        insights: res.data.insights,
        cached: res.data.cached || false
      };
    } else {
      throw new Error(res.data.message || 'AI Insights temporarily unavailable.');
    }
  };

  // Fetch filter options once on mount
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
  }, []);

  // Fetch insights when filters change
  useEffect(() => {
    let active = true;
    setLoading(true);
    setApiFailed(false);
    fetchInsights(false, { region: selectedRegion, product: selectedProduct, month: selectedMonth })
      .then(resData => {
        if (active) {
          setData(resData.insights);
          setIsCached(resData.cached);
          setApiFailed(false);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to load insights:", err);
        if (active) {
          setData(null);
          setApiFailed(true);
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

  const handleRefresh = () => {
    setIsRefreshing(true);
    setApiFailed(false);
    toast.loading('Regenerating AI Insights...', { id: 'insights-toast' });
    fetchInsights(true, { region: selectedRegion, product: selectedProduct, month: selectedMonth })
      .then(resData => {
        setData(resData.insights);
        setIsCached(resData.cached);
        setApiFailed(false);
        setIsRefreshing(false);
        toast.success('AI insights generated successfully!', { id: 'insights-toast' });
      })
      .catch(err => {
        console.error(err);
        setData(null);
        setApiFailed(true);
        setIsRefreshing(false);
        toast.error('AI service is currently unavailable. Please try again later.', { id: 'insights-toast' });
      });
  };

  const renderEmptyState = () => {
    return (
      <div 
        className="glass-panel animate-slide-up"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 32px',
          background: 'rgba(99, 102, 241, 0.02)',
          border: '1px solid rgba(99, 102, 241, 0.12)',
          borderRadius: '16px',
          textAlign: 'center',
          maxWidth: '680px',
          margin: '40px auto',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
        }}
      >
        <div 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(99, 102, 241, 0.08)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px',
            color: 'rgba(165, 180, 252, 0.8)'
          }}
        >
          <Sparkles size={28} />
        </div>
        
        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '12px' }}>
          AI Insights Temporarily Unavailable
        </h3>
        
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px', maxWidth: '520px' }}>
          The AI analysis service is currently unavailable due to API limits or temporary server load. Dashboard metrics, charts, and business analytics remain accurate because they are generated directly from your sales data. Please try generating AI insights again later.
        </p>
        
        <button 
          className="btn btn-primary"
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            fontSize: '0.85rem',
            fontWeight: '600',
            borderRadius: '8px',
            transition: 'all 0.2s ease',
            boxShadow: '0 4px 16px rgba(99, 102, 241, 0.2)'
          }}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="spinner animate-spin" size={16} />
              Generating AI Insights...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Refresh AI Insights
            </>
          )}
        </button>
      </div>
    );
  };

  const renderNoDataState = () => {
    return (
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
          gap: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)'
        }}
      >
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(244, 63, 94, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
          <AlertCircle size={24} style={{ color: 'var(--rose)' }} />
        </div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>No insights found for this selection</h3>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '450px', margin: 0, lineHeight: '1.5' }}>
          No sales data is available matching the active filter combination. Please select a different Region, Product, or Month to run the analysis.
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
    );
  };

  const renderSkeletonSection = () => {
    return (
      <div style={{ marginBottom: '32px' }}>
        <div style={{ height: '20px', width: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '16px' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel animate-pulse" style={{ height: '180px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ height: '16px', width: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
              <div style={{ height: '12px', width: '90%', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}></div>
              <div style={{ height: '12px', width: '75%', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}></div>
              <div style={{ height: '20px', width: '30%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', marginTop: 'auto' }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 className="page-title">Executive AI Insights</h2>
              <span className="badge" style={{ gap: '4px', padding: '4px 8px', background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
                <Sparkles size={12} /> AI Powered
              </span>
            </div>
            <p className="page-subtitle">Detailed performance evaluation and strategic growth indicators</p>
          </div>
        </div>

        {/* Loading Banner */}
        <div 
          className="glass-panel"
          style={{
            padding: '20px',
            background: 'rgba(99, 102, 241, 0.03)',
            border: '1px solid rgba(99, 102, 241, 0.15)',
            borderRadius: '16px',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
          }}
        >
          <Loader2 className="spinner animate-spin" size={20} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: '600' }}>
            AI is compiling sales report...
          </span>
        </div>

        {/* Skeleton Briefing */}
        <div className="glass-panel animate-pulse" style={{ height: '140px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px', marginBottom: '32px' }}></div>

        {/* Skeleton Sections */}
        {renderSkeletonSection()}
        {renderSkeletonSection()}
      </div>
    );
  }

  // Helper to parse revenue amount and share percentage
  const parseRevenueAndShare = (revStr) => {
    if (!revStr) return { amount: 'N/A', share: '' };
    const match = revStr.match(/\(([^)]+)\)/);
    const share = match ? match[1] : '';
    const amount = revStr.replace(/\s*\([^)]+\)/, '').trim();
    return { amount, share };
  };

  // Helper to prioritize and style recommendations
  const prioritizeRecommendations = (recs) => {
    if (!recs || !Array.isArray(recs)) return [];
    return recs.map((rec, index) => {
      let priority = 'Low Priority';
      let badgeColor = 'var(--primary)';
      let badgeBg = 'rgba(99, 102, 241, 0.08)';
      let badgeBorder = 'rgba(99, 102, 241, 0.15)';
      
      if (index === 0 || index === 1) {
        priority = 'High Priority';
        badgeColor = 'var(--rose)';
        badgeBg = 'rgba(244, 63, 94, 0.08)';
        badgeBorder = 'rgba(244, 63, 94, 0.15)';
      } else if (index === 2 || index === 3) {
        priority = 'Medium Priority';
        badgeColor = 'var(--amber)';
        badgeBg = 'rgba(245, 158, 11, 0.08)';
        badgeBorder = 'rgba(245, 158, 11, 0.15)';
      }
      
      return {
        text: rec,
        priority,
        badgeColor,
        badgeBg,
        badgeBorder
      };
    });
  };

  // Helper to construct exactly 3 executive summary bullets
  const getSummaryBullets = () => {
    const trend = data?.trendAnalysis || {};
    const topProd = data?.productAnalysis?.topProduct || {};
    const weakTerr = data?.territoryAnalysis?.weakTerritory || {};
    
    const sentences = data?.executiveSummary
      ? data.executiveSummary.split(/[.!?]\s+/).map(s => s.trim().replace(/\.$/, '')).filter(Boolean)
      : [];
      
    const trendSentence = sentences.find(s => /revenue|increased|decreased|growth|sales|%|month/i.test(s)) 
      || sentences[0]
      || `Revenue changed by ${trend.growthPercentage || 'N/A'} compared to the previous period (Current: ${trend.currentMonthRevenue || 'N/A'} vs Previous: ${trend.previousMonthRevenue || 'N/A'}).`;
      
    const topProductSentence = sentences.find(s => new RegExp(topProd.productName || 'topProduct_placeholder', 'i').test(s) || /strongest|product|lead/i.test(s))
      || sentences[1]
      || `${topProd.productName || 'N/A'} remains the leading product, contributing ${topProd.revenue || 'N/A'} of portfolio revenue.`;
      
    const weakTerrSentence = sentences.find(s => new RegExp(weakTerr.territoryName || 'weakTerr_placeholder', 'i').test(s) || /weak|region|territory|focus/i.test(s))
      || sentences[2]
      || `${weakTerr.territoryName || 'N/A'} is the weakest performing region, requiring direct-delivery realignment and operational focus.`;

    return [
      {
        label: 'Revenue Trend',
        text: trendSentence.endsWith('.') ? trendSentence : trendSentence + '.',
        icon: trend.growthPercentage?.startsWith('-') ? <TrendingDown size={14} style={{ color: 'var(--rose)' }} /> : <TrendingUp size={14} style={{ color: 'var(--emerald)' }} />
      },
      {
        label: 'Top Product',
        text: topProductSentence.endsWith('.') ? topProductSentence : topProductSentence + '.',
        icon: <Award size={14} style={{ color: 'var(--emerald)' }} />
      },
      {
        label: 'Weak Territory',
        text: weakTerrSentence.endsWith('.') ? weakTerrSentence : weakTerrSentence + '.',
        icon: <AlertCircle size={14} style={{ color: 'var(--rose)' }} />
      }
    ];
  };

  const renderFiltersBar = () => {
    return (
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
          onClick={async () => {
            setExporting(true);
            await exportPdfReport({ region: selectedRegion, product: selectedProduct, month: selectedMonth });
            setExporting(false);
          }}
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
    );
  };

  const isDbEmpty = !loading && filterOptions.regions.length === 0;
  const hasData = data && (
    data.executiveSummary || 
    data.productAnalysis || 
    data.territoryAnalysis || 
    data.trendAnalysis || 
    data.recommendations
  );

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
          <Sparkles size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '8px' }}>No insights generated</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
            We need sales transactions to analyze and flag trends. Upload a CSV sales ledger file to generate automated AI insights.
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

  return (
    <div style={{ paddingBottom: '40px' }}>
      <style>{`
        .trend-comparison-container {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          width: 100%;
          max-width: 720px;
          margin: 12px auto;
        }
        .trend-comparison-box {
          flex: 1;
          max-width: 260px;
          background: rgba(255, 255, 255, 0.02);
          padding: 16px 20px;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
          transition: var(--transition);
        }
        .trend-comparison-box:hover {
          border-color: var(--border-hover);
          background: rgba(255, 255, 255, 0.03);
        }
        .trend-comparison-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          width: 140px;
        }
        .insights-section-title {
          font-size: 1.05rem;
          font-weight: 600;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--text-primary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .product-grid, .territory-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }
        @media (max-width: 992px) {
          .product-grid, .territory-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 768px) {
          .product-grid, .territory-grid {
            grid-template-columns: 1fr;
          }
          .trend-comparison-container {
            flex-direction: column;
            gap: 16px;
          }
          .trend-comparison-arrow {
            width: 100%;
            padding: 10px 0;
          }
          .trend-comparison-arrow span.arrow-symbol {
            transform: rotate(90deg);
          }
        }
      `}</style>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="page-title">Executive AI Insights</h2>
            {!loading && !isRefreshing && data && (
              <>
                {!isCached ? (
                  <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--emerald)' }}></span> Live AI
                  </span>
                ) : (
                  <span className="badge" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--amber)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--amber)' }}></span> Cached AI
                  </span>
                )}
              </>
            )}
          </div>
          <p className="page-subtitle">Detailed performance evaluation and strategic growth indicators</p>
          
          {metadata && !apiFailed && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div>Analysis based on <strong>{metadata.totalRecords || 'N/A'}</strong> sales records</div>
              <div>Last updated: <strong>{metadata.lastUpdated ? formatLastUpdated(metadata.lastUpdated) : 'N/A'}</strong></div>
            </div>
          )}
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={handleRefresh}
          disabled={loading || isRefreshing}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            fontSize: '0.82rem',
            fontWeight: '600',
            background: 'rgba(99, 102, 241, 0.12)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            color: '#ffffff',
            borderRadius: '8px',
            cursor: (loading || isRefreshing) ? 'not-allowed' : 'pointer',
            opacity: (loading || isRefreshing) ? 0.7 : 1,
            transition: 'all 0.2s ease',
            boxShadow: '0 0 12px rgba(99, 102, 241, 0.12)'
          }}
        >
          {isRefreshing ? (
            <>
              <Loader2 className="spinner animate-spin" size={14} style={{ color: '#a5b4fc' }} />
              Generating AI Insights...
            </>
          ) : (
            <>
              <Sparkles size={14} style={{ color: '#a5b4fc' }} />
              Refresh AI Insights
            </>
          )}
        </button>
      </div>

      {renderFiltersBar()}

      {isRefreshing && (
        <div 
          className="glass-panel animate-pulse"
          style={{
            padding: '16px 20px',
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 20px rgba(99, 102, 241, 0.1)'
          }}
        >
          <Loader2 className="spinner animate-spin" size={18} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>
            Generating AI Insights... Please wait, analyzing latest sales performance data.
          </span>
        </div>
      )}

      {isRefreshing && (
        <>
          {renderSkeletonSection()}
          {renderSkeletonSection()}
        </>
      )}

      {!isRefreshing && apiFailed && renderEmptyState()}

      {!isRefreshing && !apiFailed && !hasData && renderNoDataState()}

      {!isRefreshing && !apiFailed && hasData && isCached && (
        <div 
          className="glass-panel animate-slide-up"
          style={{
            padding: '16px 20px',
            background: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '12px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}
        >
          <AlertTriangle size={18} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: '500' }}>
            Showing cached AI insights. Click Refresh to run a live analysis.
          </span>
        </div>
      )}

      {/* 1. EXECUTIVE SUMMARY SECTION */}
      {!isRefreshing && data?.executiveSummary && (
        <div 
          className="glass-panel animate-slide-up"
          style={{
            padding: '24px',
            background: 'rgba(99, 102, 241, 0.02)',
            border: '1px solid rgba(99, 102, 241, 0.12)',
            borderRadius: '16px',
            marginBottom: '32px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <FileText size={18} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '0.9rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Executive Summary Briefing</h3>
            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontWeight: '600', marginLeft: 'auto' }}>Key Highlights</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {getSummaryBullets().map((bullet, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '2px', padding: '6px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {bullet.icon}
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '2px', letterSpacing: '0.03em' }}>
                    {bullet.label}
                  </span>
                  <p style={{ fontSize: '0.86rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.5', fontWeight: '500' }}>
                    {bullet.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. PRODUCT PERFORMANCE ANALYSIS SECTION */}
      {!isRefreshing && data?.productAnalysis && (
        <div style={{ marginBottom: '32px' }} className="animate-slide-up">
          <h3 className="insights-section-title">
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <Award size={18} />
            </span>
            Product Performance Analysis
          </h3>
          <div className="product-grid">
            {/* Top Product */}
            {data.productAnalysis.topProduct && (() => {
              const { amount, share } = parseRevenueAndShare(data.productAnalysis.topProduct.revenue);
              return (
                <div 
                  className="glass-panel" 
                  style={{ 
                    borderTop: '4px solid var(--emerald)', 
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.02) 0%, rgba(22, 28, 45, 0.6) 100%)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--emerald)', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      #1 Top Product
                    </span>
                    <Award size={16} style={{ color: 'var(--emerald)' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                      {data.productAnalysis.topProduct.productName || 'N/A'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{amount}</span>
                      {share && (
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald)' }}>
                          {share} Share
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>Reason for Strong Performance</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.productAnalysis.topProduct.reason || 'N/A'}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>Recommendation</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.productAnalysis.topProduct.recommendation || data.productAnalysis.topProduct.suggestion || 'N/A'}</p>
                  </div>
                </div>
              );
            })()}

            {/* Moderate Product */}
            {data.productAnalysis.moderateProduct && (() => {
              const { amount, share } = parseRevenueAndShare(data.productAnalysis.moderateProduct.revenue);
              return (
                <div 
                  className="glass-panel" 
                  style={{ 
                    borderTop: '4px solid var(--amber)', 
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.015) 0%, rgba(22, 28, 45, 0.6) 100%)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--amber)', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                      #2 Moderate Performer
                    </span>
                    <Tag size={14} style={{ color: 'var(--amber)' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                      {data.productAnalysis.moderateProduct.productName || 'N/A'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{amount}</span>
                      {share && (
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--amber)' }}>
                          {share} Share
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>Reason for Average Performance</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.productAnalysis.moderateProduct.reason || 'N/A'}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>Improvement Suggestion</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.productAnalysis.moderateProduct.suggestion || data.productAnalysis.moderateProduct.recommendation || 'N/A'}</p>
                  </div>
                </div>
              );
            })()}

            {/* Weak Product */}
            {data.productAnalysis.weakProduct && (() => {
              const { amount, share } = parseRevenueAndShare(data.productAnalysis.weakProduct.revenue);
              return (
                <div 
                  className="glass-panel" 
                  style={{ 
                    borderTop: '4px solid var(--rose)', 
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(180deg, rgba(244, 63, 94, 0.02) 0%, rgba(22, 28, 45, 0.6) 100%)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(244, 63, 94, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--rose)', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
                      #3 Weak Performer
                    </span>
                    <AlertCircle size={16} style={{ color: 'var(--rose)' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                      {data.productAnalysis.weakProduct.productName || 'N/A'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{amount}</span>
                      {share && (
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.12)', color: 'var(--rose)' }}>
                          {share} Share
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--rose)', fontWeight: '700', marginBottom: '4px' }}>Reason for Weak Performance</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.productAnalysis.weakProduct.reason || 'N/A'}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--rose)', fontWeight: '700', marginBottom: '4px' }}>Improvement Suggestion</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.productAnalysis.weakProduct.suggestion || data.productAnalysis.weakProduct.recommendation || 'N/A'}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 3. TERRITORY PERFORMANCE ANALYSIS SECTION */}
      {!isRefreshing && data?.territoryAnalysis && (
        <div style={{ marginBottom: '32px' }} className="animate-slide-up">
          <h3 className="insights-section-title">
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <MapPin size={18} />
            </span>
            Territory Performance Analysis
          </h3>
          <div className="territory-grid">
            {/* Strong Territory */}
            {data.territoryAnalysis.strongTerritory && (() => {
              const { amount, share } = parseRevenueAndShare(data.territoryAnalysis.strongTerritory.revenue);
              return (
                <div 
                  className="glass-panel" 
                  style={{ 
                    borderTop: '4px solid var(--emerald)', 
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(180deg, rgba(16, 185, 129, 0.02) 0%, rgba(22, 28, 45, 0.6) 100%)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--emerald)', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
                      #1 Strongest Territory
                    </span>
                    <Globe size={16} style={{ color: 'var(--emerald)' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                      {data.territoryAnalysis.strongTerritory.territoryName || 'N/A'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{amount}</span>
                      {share && (
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.12)', color: 'var(--emerald)' }}>
                          {share} Share
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>Business Observation</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.territoryAnalysis.strongTerritory.observation || 'N/A'}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>Recommendation</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.territoryAnalysis.strongTerritory.recommendation || 'N/A'}</p>
                  </div>
                </div>
              );
            })()}

            {/* Moderate Territory */}
            {data.territoryAnalysis.moderateTerritory && (() => {
              const { amount, share } = parseRevenueAndShare(data.territoryAnalysis.moderateTerritory.revenue);
              return (
                <div 
                  className="glass-panel" 
                  style={{ 
                    borderTop: '4px solid var(--amber)', 
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.015) 0%, rgba(22, 28, 45, 0.6) 100%)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(245, 158, 11, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--amber)', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                      #2 Moderate Territory
                    </span>
                    <MapPin size={16} style={{ color: 'var(--amber)' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                      {data.territoryAnalysis.moderateTerritory.territoryName || 'N/A'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{amount}</span>
                      {share && (
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.12)', color: 'var(--amber)' }}>
                          {share} Share
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>Business Observation</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.territoryAnalysis.moderateTerritory.observation || 'N/A'}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '4px' }}>Recommendation</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.territoryAnalysis.moderateTerritory.recommendation || 'N/A'}</p>
                  </div>
                </div>
              );
            })()}

            {/* Weak Territory */}
            {data.territoryAnalysis.weakTerritory && (() => {
              const { amount, share } = parseRevenueAndShare(data.territoryAnalysis.weakTerritory.revenue);
              return (
                <div 
                  className="glass-panel" 
                  style={{ 
                    borderTop: '4px solid var(--rose)', 
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    background: 'linear-gradient(180deg, rgba(244, 63, 94, 0.02) 0%, rgba(22, 28, 45, 0.6) 100%)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '14px',
                    boxShadow: '0 4px 20px rgba(244, 63, 94, 0.03)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--rose)', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.08)', border: '1px solid rgba(244, 63, 94, 0.15)' }}>
                      #3 Weakest Territory
                    </span>
                    <AlertTriangle size={16} style={{ color: 'var(--rose)' }} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '0 0 4px 0', color: 'var(--text-primary)' }}>
                      {data.territoryAnalysis.weakTerritory.territoryName || 'N/A'}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{amount}</span>
                      {share && (
                        <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '2px 6px', borderRadius: '4px', background: 'rgba(244, 63, 94, 0.12)', color: 'var(--rose)' }}>
                          {share} Share
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--rose)', fontWeight: '700', marginBottom: '4px' }}>Business Observation</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.territoryAnalysis.weakTerritory.observation || 'N/A'}</p>
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.68rem', letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--rose)', fontWeight: '700', marginBottom: '4px' }}>Recommendation</div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.45' }}>{data.territoryAnalysis.weakTerritory.recommendation || 'N/A'}</p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* 4. TREND PERFORMANCE ANALYSIS SECTION */}
      {!isRefreshing && data?.trendAnalysis && (
        <div style={{ marginBottom: '32px' }} className="animate-slide-up">
          <h3 className="insights-section-title">
            <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
              <TrendingDown size={18} />
            </span>
            Trend Performance Analysis
          </h3>
          <div 
            className="glass-panel" 
            style={{ 
              padding: '24px', 
              borderRadius: '16px', 
              background: 'var(--bg-card)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '20px' 
            }}
          >
            <div className="trend-comparison-container">
              {/* Previous Period */}
              <div className="trend-comparison-box">
                <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Previous Period</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-secondary)' }}>{data.trendAnalysis.previousMonthRevenue || 'N/A'}</span>
              </div>

              {/* Transition / Growth Indicator */}
              <div className="trend-comparison-arrow">
                {(() => {
                  const isDecline = data.trendAnalysis.growthPercentage?.startsWith('-');
                  const isZero = data.trendAnalysis.growthPercentage === '0.0%' || data.trendAnalysis.growthPercentage === '0%';
                  const statusText = isDecline ? 'Decline' : (isZero ? 'Stable' : 'Growth');
                  const statusIcon = isDecline ? '▼ Decline' : (isZero ? '● Stable' : '▲ Growth');
                  const statusColor = isDecline ? 'var(--rose)' : (isZero ? 'var(--text-muted)' : 'var(--emerald)');
                  const statusBg = isDecline ? 'rgba(244, 63, 94, 0.08)' : (isZero ? 'rgba(255, 255, 255, 0.04)' : 'rgba(16, 185, 129, 0.08)');
                  const statusBorder = isDecline ? '1px solid rgba(244, 63, 94, 0.15)' : (isZero ? '1px solid var(--border-color)' : '1px solid rgba(16, 185, 129, 0.15)');

                  return (
                    <div 
                      style={{ 
                        fontSize: '0.78rem', 
                        fontWeight: '700', 
                        padding: '6px 14px', 
                        borderRadius: '20px', 
                        background: statusBg,
                        color: statusColor,
                        border: statusBorder,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                      }}
                    >
                      <span>{statusIcon}</span>
                      <span>{data.trendAnalysis.growthPercentage || 'N/A'}</span>
                    </div>
                  );
                })()}
              </div>

              {/* Current Period */}
              <div 
                className="trend-comparison-box"
                style={{
                  borderColor: data.trendAnalysis.growthPercentage?.startsWith('-') ? 'rgba(244, 63, 94, 0.2)' : 'rgba(16, 185, 129, 0.2)'
                }}
              >
                <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Period</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-primary)' }}>{data.trendAnalysis.currentMonthRevenue || 'N/A'}</span>
              </div>
            </div>

            {/* AI Insight Paragraph */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', letterSpacing: '0.05em' }}>
                <Sparkles size={12} style={{ color: 'var(--primary)' }} /> AI Trend Interpretation
              </div>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5', fontWeight: '500' }}>
                {data.trendAnalysis.insight || 'N/A'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5. BUSINESS RECOMMENDATIONS SECTION */}
      {!isRefreshing && data?.recommendations && data.recommendations.length > 0 && (() => {
        const prioritized = prioritizeRecommendations(data.recommendations);
        return (
          <div style={{ marginBottom: '32px' }} className="animate-slide-up">
            <h3 className="insights-section-title">
              <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                <Lightbulb size={18} />
              </span>
              Business Recommendations
            </h3>
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {prioritized.map((rec, index) => (
                  <div 
                    key={index} 
                    style={{ 
                      display: 'flex', 
                      gap: '14px', 
                      alignItems: 'flex-start',
                      paddingBottom: index < prioritized.length - 1 ? '16px' : '0',
                      borderBottom: index < prioritized.length - 1 ? '1px solid var(--border-color)' : 'none'
                    }}
                  >
                    <span 
                      className="priority-badge"
                      style={{ 
                        fontSize: '0.62rem', 
                        fontWeight: '800', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        background: rec.badgeBg, 
                        color: rec.badgeColor, 
                        border: `1px solid ${rec.badgeBorder}`,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        flexShrink: 0,
                        marginTop: '2px',
                        minWidth: '100px',
                        textAlign: 'center'
                      }}
                    >
                      {rec.priority}
                    </span>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                      {stripMarkdown(rec.text)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default InsightsPage;

