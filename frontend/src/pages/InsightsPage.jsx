import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Sparkles, FileText, Award, MapPin, TrendingDown, Lightbulb, AlertTriangle, Loader2 } from 'lucide-react';

function InsightsPage({ setCurrentPage }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState(null);

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

  const summarizeText = (text) => {
    if (!text) return '';
    const clean = stripMarkdown(text);
    if (clean.length <= 110) return clean;
    const sentences = clean.split(/(?<=[.!?])\s+/);
    if (sentences[0] && sentences[0].length <= 110) {
      return sentences[0];
    }
    return clean.substring(0, 107).trim() + '...';
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

  const fetchInsights = async (forceRefresh = false) => {
    try {
      const url = forceRefresh ? '/api/ai-insights?refresh=true' : '/api/ai-insights';
      const res = await axios.get(url);
      if (res.data.success && res.data.insights) {
        console.log('Successfully fetched insights from Gemini AI.');
        if (res.data.metadata) {
          setMetadata(res.data.metadata);
        }
        return res.data.insights;
      }
    } catch (err) {
      console.warn('Failed to fetch Gemini AI insights. Falling back to rule-based insights.', err.message);
    }

    // Fallback to rule-based insights
    const res = await axios.get('/api/insights');
    if (res.data.success) {
      // Fetch database status to set metadata counts
      const dbStatusRes = await axios.get('/api/database-status').catch(() => null);
      if (dbStatusRes && dbStatusRes.data) {
        setMetadata({
          totalRecords: dbStatusRes.data.salesCount,
          lastUpdated: new Date().toISOString()
        });
      } else {
        setMetadata({
          totalRecords: 'N/A',
          lastUpdated: new Date().toISOString()
        });
      }
      return res.data.insights;
    } else {
      throw new Error('Failed to fetch AI sales insights.');
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchInsights(false)
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

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    fetchInsights(true)
      .then(resData => {
        setData(resData);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Connection to backend server failed.');
        setLoading(false);
      });
  };

  const getFirstSentence = (text) => {
    if (!text) return '';
    const sentences = text.split(/[.!?]/);
    return sentences[0] ? sentences[0].trim() + '.' : '';
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case 'green':
        return {
          color: 'var(--emerald)',
          borderColor: 'rgba(16, 185, 129, 0.25)',
          glow: 'var(--emerald-glow)',
          badgeText: 'Good'
        };
      case 'yellow':
        return {
          color: 'var(--amber)',
          borderColor: 'rgba(245, 158, 11, 0.25)',
          glow: 'rgba(245, 158, 11, 0.08)',
          badgeText: 'Warning'
        };
      case 'red':
        return {
          color: 'var(--rose)',
          borderColor: 'rgba(244, 63, 94, 0.25)',
          glow: 'rgba(244, 63, 94, 0.08)',
          badgeText: 'Needs Attention'
        };
      default:
        return {
          color: 'var(--text-secondary)',
          borderColor: 'var(--border-color)',
          glow: 'transparent',
          badgeText: 'Info'
        };
    }
  };

  const renderIndicatorDot = (status) => {
    const styles = getStatusStyles(status);
    return (
      <span 
        style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          background: styles.color,
          boxShadow: `0 0 6px ${styles.color}`
        }} 
      />
    );
  };

  const takeawayCardStyle = (status) => {
    const styles = getStatusStyles(status);
    return {
      padding: '12px 14px',
      background: 'rgba(255, 255, 255, 0.01)',
      border: `1px solid ${styles.borderColor}`,
      borderLeft: `3px solid ${styles.color}`,
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: '8px'
    };
  };

  // Compile a concise 10-second reading brief dynamically (4 sentences maximum)
  const briefText = useMemo(() => {
    if (!data) return '';
    const revenueVal = data.executiveSummary?.[0]?.highlight || 'stable';
    const topProd = data.topProducts?.[0]?.highlight || 'core product';
    const weakReg = data.weakTerritories?.[0]?.highlight || 'lagging region';
    const recAction = data.recommendations?.[0]?.highlight || 'take action';
    
    const cleanRev = stripMarkdown(revenueVal);
    const cleanProd = stripMarkdown(topProd);
    const cleanReg = stripMarkdown(weakReg);
    const cleanRec = stripMarkdown(recAction);
    
    return `Sales growth is at ${cleanRev}. ${cleanProd} is the top-selling product. ${cleanReg} region needs attention. Recommended action: ${cleanRec}.`;
  }, [data]);

  const renderSkeletonSection = () => {
    return (
      <div style={{ marginBottom: '32px' }}>
        <div style={{ height: '20px', width: '150px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '16px' }}></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {[1, 2].map((i) => (
            <div key={i} className="glass-panel" style={{ height: '140px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <p className="page-subtitle">Plain English performance summaries, anomaly detection, and business recommendations</p>
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
            AI is analyzing sales data...
          </span>
        </div>

        {/* Skeleton Briefing */}
        <div className="glass-panel" style={{ height: '160px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '16px', marginBottom: '32px' }}></div>

        {/* Skeleton Sections */}
        {renderSkeletonSection()}
        {renderSkeletonSection()}
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
          onClick={handleRefresh}
          style={{ marginTop: '8px' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const hasData = data && (
    data.executiveSummary || 
    data.topProducts || 
    data.weakTerritories || 
    data.decliningProducts || 
    data.recommendations
  );

  if (!hasData) {
    return (
      <div className="no-data-card animate-slide-up" style={{ marginTop: '80px' }}>
        <div className="no-data-icon">
          <Sparkles size={28} />
        </div>
        <h3>No insights generated</h3>
        <p>
          We need sales transactions to analyze and flag trends. Upload a CSV ledger file to generate automated insights.
        </p>
        <button 
          className="btn btn-primary" 
          onClick={() => setCurrentPage('upload')}
          style={{ marginTop: '8px' }}
        >
          Go to Upload
        </button>
      </div>
    );
  }

  const renderCard = (insight) => {
    if (!insight) return null;
    const styles = getStatusStyles(insight.status);
    
    return (
      <div 
        className="glass-panel"
        style={{
          borderLeft: `4px solid ${styles.color}`,
          borderTop: `1px solid ${styles.borderColor}`,
          borderRight: `1px solid ${styles.borderColor}`,
          borderBottom: `1px solid ${styles.borderColor}`,
          padding: '16px 20px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          boxShadow: `0 4px 20px rgba(0, 0, 0, 0.35)`,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '12px',
          height: '100%',
          transition: 'all 0.25s ease'
        }}
      >
        <div>
          {/* Card Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '600', margin: 0, color: 'var(--text-primary)' }}>
              {insight.title}
            </h4>
            
            {/* Status Indicator Badge */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '3px 8px', 
                borderRadius: '6px', 
                background: 'rgba(255, 255, 255, 0.02)', 
                border: `1px solid ${styles.borderColor}`,
                fontSize: '0.7rem',
                fontWeight: '600',
                color: styles.color
              }}
            >
              {renderIndicatorDot(insight.status)}
              {styles.badgeText}
            </div>
          </div>
          
          {/* Description Text (constrained for non-technical users to exactly 2 lines max) */}
          <p 
            style={{ 
              fontSize: '0.82rem', 
              color: 'var(--text-secondary)', 
              lineHeight: '1.4', 
              margin: 0,
              height: '2.8em',
              overflow: 'hidden'
            }}
          >
            {summarizeText(insight.text)}
          </p>
        </div>

        {/* Bottom Focus Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: '600' }}>
            Focus:
          </span>
          <span 
            style={{ 
              fontSize: '0.75rem', 
              fontWeight: '600', 
              color: styles.color,
              backgroundColor: styles.glow,
              padding: '2px 8px',
              borderRadius: '4px',
              border: `1px solid ${styles.borderColor}`
            }}
          >
            {stripMarkdown(insight.highlight)}
          </span>
        </div>
      </div>
    );
  };

  const renderSection = (title, items, icon) => {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginBottom: '32px' }} className="animate-slide-up">
        <h3 
          style={{ 
            fontSize: '1.05rem', 
            fontWeight: '600', 
            marginBottom: '16px', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em'
          }}
        >
          <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
            {icon}
          </span>
          {title}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {items.map((item, index) => (
            <div key={index}>
              {renderCard(item)}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 className="page-title">Executive AI Insights</h2>
            <span className="badge badge-success" style={{ gap: '4px', padding: '4px 8px' }}>
              <Sparkles size={12} /> AI Powered
            </span>
          </div>
          <p className="page-subtitle">Plain English performance summaries, anomaly detection, and business recommendations</p>
          
          {metadata && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div>Analysis based on <strong>{metadata.totalRecords}</strong> sales records</div>
              <div>Last updated: <strong>{formatLastUpdated(metadata.lastUpdated)}</strong></div>
            </div>
          )}
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={handleRefresh}
          disabled={loading}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            padding: '8px 16px', 
            fontSize: '0.82rem',
            fontWeight: '600',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <Sparkles size={14} style={{ color: 'var(--primary)' }} />
          Refresh AI Insights
        </button>
      </div>

      {/* DEDICATED AI EXECUTIVE SUMMARY PANEL (TOP OF THE PAGE) */}
      <div 
        className="glass-panel animate-slide-up"
        style={{
          padding: '24px',
          background: 'rgba(99, 102, 241, 0.03)',
          border: '1px solid rgba(99, 102, 241, 0.15)',
          borderRadius: '16px',
          marginBottom: '32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Executive Summary Briefing</h3>
          <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', fontWeight: '600' }}>30s Read</span>
        </div>
        
        {/* Render executive briefing split cleanly into individual sentences */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '0 0 20px 0', borderLeft: '3px solid var(--primary)', paddingLeft: '12px' }}>
          {briefText.split(/(?<=[.!?])\s+/).map((sentence, idx) => {
            if (!sentence.trim()) return null;
            return (
              <p key={idx} style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: 0, fontWeight: '500', lineHeight: '1.4' }}>
                {sentence}
              </p>
            );
          })}
        </div>

        {/* 4 Takeaway Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* 1. Overall Performance */}
          <div style={takeawayCardStyle(data.executiveSummary?.[0]?.status)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Overall Performance</span>
              {renderIndicatorDot(data.executiveSummary?.[0]?.status)}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.35' }}>
              Sales change: <strong>{stripMarkdown(data.executiveSummary?.[0]?.highlight)}</strong>. {stripMarkdown(getFirstSentence(data.executiveSummary?.[0]?.text))}
            </p>
          </div>

          {/* 2. Top Opportunity */}
          <div style={takeawayCardStyle('green')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Top Opportunity</span>
              {renderIndicatorDot('green')}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.35' }}>
              Top product: <strong>{stripMarkdown(data.topProducts?.[0]?.highlight)}</strong>. {stripMarkdown(getFirstSentence(data.topProducts?.[0]?.text))}
            </p>
          </div>

          {/* 3. Weak Territory */}
          <div style={takeawayCardStyle('red')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Weak Territory</span>
              {renderIndicatorDot('red')}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.35' }}>
              Slowest region: <strong>{stripMarkdown(data.weakTerritories?.[0]?.highlight)}</strong>. {stripMarkdown(getFirstSentence(data.weakTerritories?.[0]?.text))}
            </p>
          </div>

          {/* 4. Recommended Action */}
          <div style={takeawayCardStyle(data.recommendations?.[0]?.status)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '700' }}>Recommended Action</span>
              {renderIndicatorDot(data.recommendations?.[0]?.status)}
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.35' }}>
              Action needed: <strong>{stripMarkdown(data.recommendations?.[0]?.highlight)}</strong>. {stripMarkdown(getFirstSentence(data.recommendations?.[0]?.text))}
            </p>
          </div>
        </div>
      </div>

      {/* Main Categories Section List */}
      <div style={{ marginTop: '12px' }}>
        {renderSection('Executive Summary', data.executiveSummary, <FileText size={18} />)}
        {renderSection('Top Products', data.topProducts, <Award size={18} />)}
        {renderSection('Weak Territories', data.weakTerritories, <MapPin size={18} />)}
        {renderSection('Declining Products', data.decliningProducts, <TrendingDown size={18} />)}
        {renderSection('Recommendations', data.recommendations, <Lightbulb size={18} />)}
      </div>
    </div>
  );
}

export default InsightsPage;
