import { IndianRupee, ShoppingCart, Percent, Tag, Award, Globe, AlertCircle, Info, TrendingUp, TrendingDown } from 'lucide-react';

function KPICards({ kpis, loading = false }) {
  if (loading) {
    return (
      <div style={{ marginBottom: '32px' }}>
        <div className="kpi-grid" style={{ marginBottom: 0 }}>
          {[1, 2, 3, 4, 5].map((idx) => (
            <div 
              key={idx} 
              className="kpi-card skeleton-card animate-pulse" 
              style={{ 
                minHeight: '135px', 
                background: 'rgba(255, 255, 255, 0.015)', 
                border: '1px solid var(--border-color)', 
                display: 'flex', 
                flexDirection: 'column', 
                justifyContent: 'space-between',
                padding: '20px 24px',
                borderRadius: '16px'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '12px', width: '50%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '10px' }}></div>
                    <div style={{ height: '24px', width: '70%', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
                  </div>
                  <div style={{ width: '32px', height: '32px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', flexShrink: 0 }}></div>
                </div>
              </div>
              <div style={{ height: '12px', width: '90%', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginTop: '14px' }}></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  const formatCurrencyCompact = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val);

  const cards = [
    {
      title: 'Gross Sales Revenue',
      value: formatCurrency(kpis?.totalRevenue || 0),
      icon: <IndianRupee className="icon text-emerald" />,
      desc: 'Total value of all completed sales transactions',
      tooltip: 'Total revenue generated from uploaded sales records.',
      growth: kpis?.totalRevenueGrowth
    },
    {
      title: 'Total Invoices',
      value: formatNumber(kpis?.totalTransactions || 0),
      icon: <Tag className="icon text-purple" />,
      desc: 'Total count of billing transactions and invoices',
      tooltip: 'Number of processed invoices.',
      growth: kpis?.totalTransactionsGrowth
    },
    {
      title: 'Total Units Sold',
      value: formatNumber(kpis?.totalUnitsSold || 0),
      icon: <ShoppingCart className="icon text-blue" />,
      desc: 'Total quantity of pharmaceutical product units sold',
      tooltip: 'Total product units sold.',
      growth: kpis?.totalUnitsSoldGrowth
    },
    {
      title: 'Top Product',
      value: kpis?.topProduct?.name || 'N/A',
      icon: <Award className="icon text-emerald" />,
      desc: `Highest revenue generating product (${formatCurrencyCompact(kpis?.topProduct?.revenue || 0)})`,
      tooltip: 'Product generating the highest revenue.',
      accentColor: 'var(--emerald)'
    },
    {
      title: 'Weak Product',
      value: kpis?.weakProduct?.name || 'N/A',
      icon: <AlertCircle className="icon text-rose" />,
      desc: `Lowest revenue generating product (${formatCurrencyCompact(kpis?.weakProduct?.revenue || 0)})`,
      tooltip: 'Product generating the lowest revenue.',
      accentColor: 'var(--rose)'
    }
  ];

  const renderCard = (card, idx) => (
    <div 
      key={idx} 
      className="kpi-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderTop: card.accentColor ? `3px solid ${card.accentColor}` : '1px solid var(--border-color)',
        minHeight: '135px'
      }}
    >
      <div>
        <div className="kpi-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <span className="kpi-title" style={{ margin: 0, userSelect: 'none' }}>{card.title}</span>
              <div className="tooltip-container" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                <Info size={12} style={{ cursor: 'pointer' }} />
                <span className="tooltip-text">{card.tooltip}</span>
              </div>
            </div>
            <h3 className="kpi-value" style={card.accentColor ? { fontSize: '1.35rem', marginTop: '2px' } : {}}>
              {card.value}
            </h3>
          </div>
          <div className="icon-wrapper" style={{ flexShrink: 0 }}>{card.icon}</div>
        </div>
      </div>

      <div style={{ marginTop: '10px' }}>
        {card.growth !== undefined ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span 
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '4px',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: '700',
                background: card.growth > 0 
                  ? 'rgba(16, 185, 129, 0.08)' 
                  : card.growth < 0 
                  ? 'rgba(244, 63, 94, 0.08)' 
                  : 'rgba(255, 255, 255, 0.02)',
                color: card.growth > 0 
                  ? 'var(--emerald)' 
                  : card.growth < 0 
                  ? 'var(--rose)' 
                  : 'var(--text-muted)',
                border: card.growth > 0 
                  ? '1px solid rgba(16, 185, 129, 0.15)' 
                  : card.growth < 0 
                  ? '1px solid rgba(244, 63, 94, 0.15)' 
                  : '1px solid var(--border-color)'
              }}
            >
              {card.growth > 0 ? (
                <TrendingUp size={12} />
              ) : card.growth < 0 ? (
                <TrendingDown size={12} />
              ) : null}
              {card.growth > 0 
                ? `+${card.growth.toFixed(1)}%` 
                : card.growth < 0 
                ? `${card.growth.toFixed(1)}%` 
                : '0.0%'}
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              vs last 30d period
            </span>
          </div>
        ) : (
          <p className="kpi-desc" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{card.desc}</p>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ marginBottom: '32px' }}>
      <div className="kpi-grid" style={{ marginBottom: 0 }}>
        {cards.map((card, idx) => renderCard(card, idx))}
      </div>
    </div>
  );
}

export default KPICards;
