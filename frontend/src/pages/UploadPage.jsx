import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../config/api';
import FileUpload from '../components/FileUpload';
import { CheckCircle2, X, Clock, ArrowRight, Database } from 'lucide-react';

function UploadPage({ onUploadSuccess }) {
  const [latestSummary, setLatestSummary] = useState(null); // { summary: {}, fileName: '' }
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedUpload, setSelectedUpload] = useState(null); // for viewing details of previous upload

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('en-IN').format(val);
  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const fetchHistory = async () => {
    const res = await axios.get(`${API_URL}/api/upload-history`);
    if (res.data.success) {
      return res.data.history;
    } else {
      throw new Error('Failed to retrieve upload history.');
    }
  };

  useEffect(() => {
    let active = true;
    fetchHistory()
      .then(historyData => {
        if (active) {
          setHistory(historyData);
          setHistoryLoading(false);
        }
      })
      .catch(err => {
        console.error(err);
        if (active) {
          setHistoryLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleUploadSuccess = (summaryData, fileObj) => {
    setLatestSummary({
      summary: summaryData,
      fileName: fileObj ? fileObj.name : 'Sales Ledger CSV'
    });
    setHistoryLoading(true);
    fetchHistory()
      .then(historyData => {
        setHistory(historyData);
        setHistoryLoading(false);
      })
      .catch(err => {
        console.error(err);
        setHistoryLoading(false);
      });
  };

  const handleViewDetails = (item) => {
    setSelectedUpload({
      fileName: item.fileName,
      timestamp: item.timestamp,
      summary: {
        recordsCount: item.recordsCount,
        revenue: item.revenue,
        topProduct: item.summary?.topProduct || 'N/A',
        bestTerritory: item.summary?.bestTerritory || 'N/A',
        lowestTerritory: item.summary?.needsAttention || 'N/A',
        startDate: item.summary?.startDate,
        endDate: item.summary?.endDate
      }
    });
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">CSV Ledger Import</h2>
        <p className="page-subtitle">Upload company sales data sheets to populate your analytics database</p>
      </div>

      {latestSummary ? (
        /* SUCCESS SUMMARY CARD */
        <div 
          className="glass-panel animate-slide-up" 
          style={{ 
            padding: '32px', 
            borderRadius: '16px', 
            maxWidth: '750px', 
            margin: '0 auto 32px auto', 
            border: '1px solid rgba(16, 185, 129, 0.25)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={24} style={{ color: 'var(--emerald)' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--text-primary)', fontWeight: '600' }}>File Uploaded Successfully</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Source: {latestSummary.fileName}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', tracking: '0.05em' }}>Records Imported</span>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{formatNumber(latestSummary.summary.recordsCount)}</p>
            </div>
            <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', tracking: '0.05em' }}>Revenue Generated</span>
              <p style={{ fontSize: '1.25rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--emerald)' }}>{formatCurrency(latestSummary.summary.revenue)}</p>
            </div>
            <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', tracking: '0.05em' }}>Top Product</span>
              <p style={{ fontSize: '1rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{latestSummary.summary.topProduct}</p>
            </div>
            <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', tracking: '0.05em' }}>Best Territory</span>
              <p style={{ fontSize: '1rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--emerald)' }}>{latestSummary.summary.bestTerritory}</p>
            </div>
            <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600', tracking: '0.05em' }}>Lowest Territory</span>
              <p style={{ fontSize: '1rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--rose)' }}>{latestSummary.summary.lowestTerritory}</p>
            </div>
            <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', tracking: '0.05em', fontWeight: '600' }}>Date Range</span>
              <p style={{ fontSize: '0.85rem', fontWeight: '700', margin: '6px 0 0 0', color: 'var(--text-primary)' }}>
                {formatDate(latestSummary.summary.startDate)} to {formatDate(latestSummary.summary.endDate)}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button 
              className="btn" 
              onClick={() => setLatestSummary(null)} 
              style={{ border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)' }}
            >
              Upload Another File
            </button>
            <button className="btn btn-primary" onClick={onUploadSuccess}>
              View Dashboard <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* FILE UPLOAD DRAG/DROP */
        <FileUpload onUploadSuccess={handleUploadSuccess} />
      )}

      {/* UPLOAD HISTORY LIST */}
      <div className="table-card animate-slide-up delay-1" style={{ marginTop: '32px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} className="text-blue" /> CSV Upload History
        </h4>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Track previously uploaded CSV spreadsheets and drill down to inspect their calculated metrics.
        </p>

        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading upload history...</div>
        ) : history.length > 0 ? (
          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>File Name</th>
                  <th>Records Count</th>
                  <th>Revenue Generated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={item._id || index}>
                    <td>
                      {new Date(item.timestamp).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </td>
                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {item.fileName}
                    </td>
                    <td>{formatNumber(item.recordsCount)}</td>
                    <td style={{ color: 'var(--emerald)', fontWeight: '600' }}>
                      {formatCurrency(item.revenue)}
                    </td>
                    <td>
                      <button 
                        className="btn"
                        onClick={() => handleViewDetails(item)}
                        style={{ 
                          padding: '6px 12px', 
                          fontSize: '0.8rem', 
                          background: 'rgba(99, 102, 241, 0.08)',
                          border: '1px solid rgba(99, 102, 241, 0.15)',
                          color: 'var(--primary)',
                          borderRadius: '6px'
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '12px', border: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Database size={18} /> No files have been uploaded to the database yet.
          </div>
        )}
      </div>

      {/* DETAIL MODAL FOR HISTORIC UPLOAD */}
      {selectedUpload && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(5px)'
          }}
          onClick={() => setSelectedUpload(null)}
        >
          <div 
            className="glass-panel animate-slide-up" 
            style={{
              padding: '32px',
              width: '90%',
              maxWidth: '650px',
              borderRadius: '16px',
              border: '1px solid var(--border-color)',
              position: 'relative',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)'
            }}
            onClick={(e) => e.stopPropagation()} // prevent close on card click
          >
            <button 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              onClick={() => setSelectedUpload(null)}
            >
              <X size={20} />
            </button>

            <h3 style={{ marginBottom: '8px', fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={20} className="text-blue" /> Upload Details
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
              File Name: <strong>{selectedUpload.fileName}</strong>
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>Records Imported</span>
                <p style={{ fontSize: '1.15rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{formatNumber(selectedUpload.summary.recordsCount)}</p>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>Revenue Generated</span>
                <p style={{ fontSize: '1.15rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--emerald)' }}>{formatCurrency(selectedUpload.summary.revenue)}</p>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>Top Product</span>
                <p style={{ fontSize: '0.95rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedUpload.summary.topProduct}</p>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>Best Territory</span>
                <p style={{ fontSize: '0.95rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--emerald)' }}>{selectedUpload.summary.bestTerritory}</p>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>Lowest Territory</span>
                <p style={{ fontSize: '0.95rem', fontWeight: '700', margin: '4px 0 0 0', color: 'var(--rose)' }}>{selectedUpload.summary.lowestTerritory}</p>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.01)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: '600' }}>Date Range</span>
                <p style={{ fontSize: '0.8rem', fontWeight: '700', margin: '6px 0 0 0', color: 'var(--text-primary)' }}>
                  {formatDate(selectedUpload.summary.startDate)} to {formatDate(selectedUpload.summary.endDate)}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                className="btn" 
                onClick={() => setSelectedUpload(null)}
                style={{ border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
