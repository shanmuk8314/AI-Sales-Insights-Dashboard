import { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Info } from 'lucide-react';

function SalesCharts({ salesTrends = { weekly: [], monthly: [], quarterly: [], halfYearly: [], yearly: [] } }) {
  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', compactDisplay: 'short' }).format(val);
  
  // States for Chart 1: Revenue Growth Trend (Default is All Territories + Monthly)
  const [periodType, setPeriodType] = useState('monthly');
  const [selectedRegion, setSelectedRegion] = useState('All');

  // States for Chart 2: Regional Performance breakdown (Default is All Territories + Monthly)
  const [regionFilter, setRegionFilter] = useState('All');
  const [timeFilter, setTimeFilter] = useState('monthly');

  // Colors mapping for all active regions
  const regionColors = {
    North: 'var(--primary)',
    South: 'var(--cyan)',
    East: 'var(--emerald)',
    West: 'var(--amber)',
    Hyderabad: '#ec4899',   // Pink
    Bangalore: '#8b5cf6',   // Violet
    Mumbai: '#f97316',      // Orange
    Chennai: '#14b8a6'      // Teal
  };

  // Data processing for Chart 1 (Revenue Growth Trend)
  const trendsData = useMemo(() => {
    const rawData = salesTrends?.[periodType] || [];
    
    // Parse periodRegion into period and region
    const parsedData = rawData.map(item => {
      if (!item.periodRegion) return { ...item, period: item.period || 'Unknown', region: 'Unknown' };
      const parts = item.periodRegion.split('_');
      return {
        ...item,
        period: parts[0],
        region: parts[1] || 'Unknown'
      };
    });

    if (selectedRegion === 'All' || selectedRegion === 'All Territories') {
      // Group and sum in-memory for all territories
      const grouped = {};
      parsedData.forEach(item => {
        if (!grouped[item.period]) {
          grouped[item.period] = { period: item.period, revenue: 0, unitsSold: 0 };
        }
        grouped[item.period].revenue += item.revenue || 0;
        grouped[item.period].unitsSold += item.unitsSold || 0;
      });
      return Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
    } else {
      // Filter by region and sort
      return parsedData
        .filter(item => item.region.toLowerCase() === selectedRegion.toLowerCase())
        .sort((a, b) => a.period.localeCompare(b.period));
    }
  }, [salesTrends, periodType, selectedRegion]);

  // Data processing for Chart 2 (Territory Sales Performance)
  const regionalTrendData = useMemo(() => {
    const rawData = salesTrends?.[timeFilter] || [];
    
    // Parse items: periodRegion is e.g. "2026-06_North"
    const parsedData = rawData.map(item => {
      if (!item.periodRegion) return null;
      const parts = item.periodRegion.split('_');
      return {
        period: parts[0],
        region: parts[1] || 'Unknown',
        revenue: item.revenue || 0,
        unitsSold: item.unitsSold || 0
      };
    }).filter(Boolean);

    // Group by period and break out region properties dynamically
    const periodsMap = {};
    parsedData.forEach(item => {
      if (!periodsMap[item.period]) {
        periodsMap[item.period] = {
          period: item.period,
          All: 0,
          All_units: 0
        };
      }
      const regKey = item.region.charAt(0).toUpperCase() + item.region.slice(1).toLowerCase();
      if (!periodsMap[item.period][regKey]) {
        periodsMap[item.period][regKey] = 0;
        periodsMap[item.period][regKey + '_units'] = 0;
      }
      periodsMap[item.period][regKey] += item.revenue;
      periodsMap[item.period][regKey + '_units'] += item.unitsSold;
      periodsMap[item.period].All += item.revenue;
      periodsMap[item.period].All_units += item.unitsSold;
    });

    return Object.values(periodsMap).sort((a, b) => a.period.localeCompare(b.period));
  }, [salesTrends, timeFilter]);

  // Dynamic bar rendering for Chart 2
  const regionsToRender = useMemo(() => {
    if (regionFilter === 'All' || regionFilter === 'All Territories') {
      const presentRegions = new Set();
      regionalTrendData.forEach(pData => {
        Object.keys(pData).forEach(key => {
          if (key !== 'period' && key !== 'All' && !key.endsWith('_units')) {
            presentRegions.add(key);
          }
        });
      });
      return Array.from(presentRegions);
    }
    const formattedSelected = regionFilter.charAt(0).toUpperCase() + regionFilter.slice(1).toLowerCase();
    return [formattedSelected];
  }, [regionalTrendData, regionFilter]);

  // Calculate dynamic regional rankings for Chart 2
  const regionRanks = useMemo(() => {
    const totals = {};
    regionalTrendData.forEach(periodData => {
      Object.keys(periodData).forEach(key => {
        if (key !== 'period' && key !== 'All' && !key.endsWith('_units')) {
          totals[key] = (totals[key] || 0) + (periodData[key] || 0);
        }
      });
    });
    
    return Object.keys(totals)
      .map(key => ({ name: key, revenue: totals[key] }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [regionalTrendData]);

  return (
    <div className="charts-grid animate-slide-up delay-1">
      {/* Sales Trend over time */}
      <div className="chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h4 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            Sales Revenue Growth over Time
            <Info size={14} className="text-muted" style={{ cursor: 'help', opacity: 0.7 }} title="Displays trend analysis of sales revenues grouped by the selected period (weekly, monthly, quarterly, half-yearly, yearly)." />
          </h4>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="period-select"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            >
              <option value="All">All Territories</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="Hyderabad">Hyderabad</option>
              <option value="Bangalore">Bangalore</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Chennai">Chennai</option>
            </select>
            <select 
              value={periodType} 
              onChange={(e) => setPeriodType(e.target.value)}
              className="period-select"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="halfYearly">Half-Yearly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>
        <div className="chart-container" style={{ minHeight: '300px' }}>
          {trendsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              {trendsData.length === 1 ? (
                <BarChart data={trendsData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis tickFormatter={formatCurrency} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '8px' }} 
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: '600' }}
                    formatter={(value) => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value), 'Revenue']} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Bar dataKey="revenue" fill="var(--emerald)" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              ) : (
                <LineChart data={trendsData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                  <YAxis tickFormatter={formatCurrency} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-sidebar)', border: '1px solid var(--border-color)', borderRadius: '8px' }} 
                    labelStyle={{ color: 'var(--text-primary)', fontWeight: '600' }}
                    formatter={(value) => [new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value), 'Revenue']} 
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                  <Line type="monotone" dataKey="revenue" stroke="var(--emerald)" strokeWidth={3} dot={{ r: 4, strokeWidth: 0, fill: 'var(--emerald)' }} activeDot={{ r: 6 }} name="Revenue" />
                </LineChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
              No trend data available.
            </div>
          )}
        </div>
      </div>

      {/* Regional Performance */}
      <div className="chart-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '12px' }}>
          <h4 className="chart-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            Territory Sales Performance
            <Info size={14} className="text-muted" style={{ cursor: 'help', opacity: 0.7 }} title="Compares sales revenue across geographic territories over selected periods." />
          </h4>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="period-select"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            >
              <option value="All">All Territories</option>
              <option value="North">North</option>
              <option value="South">South</option>
              <option value="East">East</option>
              <option value="West">West</option>
              <option value="Hyderabad">Hyderabad</option>
              <option value="Bangalore">Bangalore</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Chennai">Chennai</option>
            </select>
            <select 
              value={timeFilter} 
              onChange={(e) => setTimeFilter(e.target.value)}
              className="period-select"
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-sidebar)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '0.82rem',
                fontWeight: '500',
                cursor: 'pointer',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="halfYearly">Half-Yearly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        {/* Dynamic Leaderboard Rankings */}
        {regionRanks.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginRight: '4px' }}>Ranks:</span>
            {regionRanks.map((item, index) => {
              const isTop = index === 0;
              const labelText = isTop ? `#1 Best: ${item.name}` : `#${index + 1} ${item.name}`;
              const pillColor = isTop ? 'var(--emerald)' : index === regionRanks.length - 1 ? 'var(--rose)' : 'var(--text-secondary)';
              const pillBg = isTop ? 'rgba(16, 185, 129, 0.08)' : index === regionRanks.length - 1 ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.02)';
              const pillBorder = isTop ? 'rgba(16, 185, 129, 0.15)' : index === regionRanks.length - 1 ? 'rgba(244, 63, 94, 0.15)' : 'var(--border-color)';
              
              return (
                <span 
                  key={item.name}
                  style={{ 
                    padding: '2px 8px', 
                    borderRadius: '6px', 
                    color: pillColor, 
                    background: pillBg, 
                    border: `1px solid ${pillBorder}`,
                    fontWeight: '600'
                  }}
                >
                  {labelText} ({new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', compactDisplay: 'short' }).format(item.revenue)})
                </span>
              );
            })}
          </div>
        )}

        <div className="chart-container" style={{ minHeight: '300px' }}>
          {regionalTrendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={regionalTrendData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
                <XAxis dataKey="period" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                <YAxis tickFormatter={formatCurrency} stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomRegionalTooltip />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                {regionsToRender.map(reg => (
                  <Bar 
                    key={reg} 
                    dataKey={reg} 
                    fill={regionColors[reg] || '#64748b'} 
                    radius={[4, 4, 0, 0]} 
                    name={`${reg} Region`} 
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
              No regional trend data available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Custom tooltips rendering both Revenue and Units Sold
const CustomRegionalTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div 
        className="glass-panel" 
        style={{ 
          padding: '12px', 
          background: 'var(--bg-sidebar)', 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px', 
          fontSize: '0.8rem',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)'
        }}
      >
        <p style={{ fontWeight: '700', marginBottom: '6px', color: 'var(--text-primary)' }}>{label}</p>
        {payload.map((pld, index) => {
          const regName = pld.dataKey; // e.g. "North"
          const revenue = pld.value;
          const units = pld.payload[regName + '_units'] || 0;
          return (
            <div key={index} style={{ marginBottom: '8px', borderBottom: index < payload.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', paddingBottom: index < payload.length - 1 ? '6px' : '0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', color: pld.fill }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pld.fill }} />
                {pld.name}
              </div>
              <div style={{ paddingLeft: '12px', marginTop: '2px', color: 'var(--text-secondary)' }}>
                <div>Revenue: <strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(revenue)}</strong></div>
                <div>Units Sold: <strong>{new Intl.NumberFormat('en-IN').format(units)}</strong></div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default SalesCharts;
