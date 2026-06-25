import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

function RecentSalesTable({ recentSales = [], loading = false }) {
  if (loading) {
    return (
      <div className="table-card animate-pulse" style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ height: '18px', width: '180px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}></div>
          <div style={{ height: '14px', width: '100px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '20px', padding: '14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          {[1, 2, 3].map((idx) => (
            <div key={idx}>
              <div style={{ height: '10px', width: '40%', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', marginBottom: '6px' }}></div>
              <div style={{ height: '30px', width: '100%', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}></div>
            </div>
          ))}
        </div>
        <div className="table-wrapper">
          <table className="custom-table" style={{ opacity: 0.6 }}>
            <thead>
              <tr>
                {['Date', 'Product Name', 'Therapeutic Category', 'Sales Territory', 'Packs Sold', 'Price per Pack', 'Invoice Value'].map((h, idx) => (
                  <th key={idx}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((rowIdx) => (
                <tr key={rowIdx}>
                  {[1, 2, 3, 4, 5, 6, 7].map((colIdx) => (
                    <td key={colIdx}>
                      <div style={{ height: '12px', width: colIdx === 2 ? '80%' : '50%', background: 'rgba(255,255,255,0.04)', borderRadius: '4px' }}></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPageNum] = useState(1);
  const itemsPerPage = 10;

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val);

  // Multi-Filter Memo
  const filteredSales = useMemo(() => {
    let filtered = recentSales;
    
    // Unified Search: matches on Product Name, Territory (Region), or Category
    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      filtered = filtered.filter(sale => 
        (sale.product && sale.product.toLowerCase().includes(term)) ||
        (sale.region && sale.region.toLowerCase().includes(term)) ||
        (sale.category && sale.category.toLowerCase().includes(term))
      );
    }
    
    // Date range filter
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter(sale => new Date(sale.date) >= start);
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(sale => new Date(sale.date) <= end);
    }

    return filtered;
  }, [recentSales, searchQuery, startDate, endDate]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedSales = useMemo(() => {
    const start = (safeCurrentPage - 1) * itemsPerPage;
    return filteredSales.slice(start, start + itemsPerPage);
  }, [filteredSales, safeCurrentPage]);

  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredSales.length);

  const filterInputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-sidebar)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-primary)',
    fontSize: '0.82rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  return (
    <div className="table-card animate-slide-up delay-2">
      {/* Header and summary count */}
      <div className="table-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Recent Transactions</h4>
          <span className="badge badge-info">{filteredSales.length} Matches</span>
        </div>
        
        {/* Record count info */}
        {filteredSales.length > 0 && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{startIndex + 1}</strong> - <strong>{endIndex}</strong> of <strong>{formatNumber(filteredSales.length)}</strong> records
          </span>
        )}
      </div>

      {/* Simplified, Clean Search & Filtering Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '20px', padding: '14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Search Transactions</label>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              placeholder="Search transactions..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPageNum(1);
              }}
              style={{
                ...filterInputStyle,
                paddingLeft: '32px'
              }}
            />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Start Date</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setCurrentPageNum(1);
            }}
            style={filterInputStyle}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>End Date</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setCurrentPageNum(1);
            }}
            style={filterInputStyle}
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="table-wrapper">
        {paginatedSales.length > 0 ? (
          <table className="custom-table">
            <thead>
              <tr>
                <th title="Date when the transaction occurred">Date</th>
                <th title="Name of the pharmaceutical product item">Product Name</th>
                <th title="Therapeutic categorization of the drug">Therapeutic Category</th>
                <th title="Sales territory region">Sales Territory</th>
                <th title="Quantity of product packs sold">Packs Sold</th>
                <th title="Price per individual pack">Price per Pack</th>
                <th title="Gross sales revenue value for this transaction">Invoice Value</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSales.map((sale, index) => (
                <tr key={sale._id || index}>
                  <td>{formatDate(sale.date)}</td>
                  <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{sale.product}</td>
                  <td>
                    <span className="badge badge-warning">{sale.category}</span>
                  </td>
                  <td>{sale.region}</td>
                  <td>{formatNumber(sale.unitsSold)}</td>
                  <td>{formatCurrency(sale.unitPrice)}</td>
                  <td style={{ fontWeight: '600', color: 'var(--emerald)' }}>
                    {formatCurrency(sale.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No transaction records match the current filters. Clear search or date filters to see all records.
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {filteredSales.length > itemsPerPage && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <button 
            onClick={() => setCurrentPageNum(Math.max(safeCurrentPage - 1, 1))} 
            disabled={safeCurrentPage === 1}
            className="btn"
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              background: safeCurrentPage === 1 ? 'transparent' : 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid var(--border-color)', 
              color: safeCurrentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Page <strong>{safeCurrentPage}</strong> of <strong>{totalPages}</strong>
          </span>
          
          <button 
            onClick={() => setCurrentPageNum(Math.min(safeCurrentPage + 1, totalPages))} 
            disabled={safeCurrentPage === totalPages}
            className="btn"
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              background: safeCurrentPage === totalPages ? 'transparent' : 'rgba(255, 255, 255, 0.02)', 
              border: '1px solid var(--border-color)', 
              color: safeCurrentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
              cursor: safeCurrentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default RecentSalesTable;
