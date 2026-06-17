import { IndianRupee, ShoppingCart, Percent, Tag, Award, Globe, AlertCircle, Info, TrendingUp, TrendingDown } from 'lucide-react';

function KPICards({ kpis }) {
  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  const formatCurrencyCompact = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val);

  const primaryCards = [
    {
      title: 'Gross Sales Revenue',
      value: formatCurrency(kpis?.totalRevenue || 0),
      icon: <IndianRupee className="icon text-emerald" />,
      desc: 'Total value of all completed sales transactions',
      tooltip: 'The cumulative billing value of all finalized sales invoices in Indian Rupees (₹).',
      growth: kpis?.totalRevenueGrowth
    },
    {
      title: 'Top Product',
      value: kpis?.topProduct?.name || 'N/A',
      icon: <Award className="icon text-blue" />,
      desc: `Highest revenue generating product (${formatCurrencyCompact(kpis?.topProduct?.revenue || 0)})`,
      tooltip: 'The pharmaceutical product contributing the highest total revenue value within the current sales ledger.',
      accentColor: 'var(--primary)'
    },
    {
      title: 'Best Territory',
      value: kpis?.bestTerritory?.name || 'N/A',
      icon: <Globe className="icon text-emerald" />,
      desc: `Top performing sales region (${formatCurrencyCompact(kpis?.bestTerritory?.revenue || 0)})`,
      tooltip: 'The geographic sales region driving the largest overall revenue volume.',
      accentColor: 'var(--emerald)'
    },
    {
      title: 'Needs Attention Territory',
      value: kpis?.needsAttention?.name || 'N/A',
      icon: <AlertCircle className="icon text-rose" />,
      desc: `Region requiring business attention (${formatCurrencyCompact(kpis?.needsAttention?.revenue || 0)})`,
      tooltip: 'The weakest performing geographic sales region by overall revenue volume.',
      accentColor: 'var(--rose)'
    }
  ];

  const secondaryCards = [
    {
      title: 'Total Units Shipped',
      value: formatNumber(kpis?.totalUnitsSold || 0),
      icon: <ShoppingCart className="icon text-blue" />,
      desc: 'Total quantity of product packs/units shipped',
      tooltip: 'The sum of all physical drug product packs or units shipped to distributors/pharmacies.',
      growth: kpis?.totalUnitsSoldGrowth
    },
    {
      title: 'Validated Invoices',
      value: formatNumber(kpis?.totalTransactions || 0),
      icon: <Tag className="icon text-purple" />,
      desc: 'Total number of finalized order transactions',
      tooltip: 'The total count of verified and completed sales invoice records in the database.',
      growth: kpis?.totalTransactionsGrowth
    },
    {
      title: 'Average Invoice Value',
      value: formatCurrency(kpis?.avgOrderValue || 0),
      icon: <Percent className="icon text-amber" />,
      desc: 'Average revenue generated per sales invoice',
      tooltip: 'Average sales revenue generated per invoice (Gross Sales divided by Validated Invoices).',
      growth: kpis?.avgOrderValueGrowth
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
              <div 
                title={card.tooltip} 
                style={{ display: 'flex', alignItems: 'center', cursor: 'help', color: 'var(--text-muted)', opacity: 0.6 }}
              >
                <Info size={12} />
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
      {/* Primary KPI Cards Grid */}
      <div className="kpi-grid" style={{ marginBottom: 0 }}>
        {primaryCards.map((card, idx) => renderCard(card, idx))}
      </div>

      {/* Secondary Metrics Label and Grid */}
      <div className="animate-slide-up" style={{ marginTop: '4px' }}>
        <h4 style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Secondary Operational Metrics
        </h4>
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: 0 }}>
          {secondaryCards.map((card, idx) => renderCard(card, idx))}
        </div>
      </div>
    </div>
  );
}

export default KPICards;
