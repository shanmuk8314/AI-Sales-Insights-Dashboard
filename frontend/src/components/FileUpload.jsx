import { useState, useRef } from 'react';
import axios from 'axios';
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

function FileUpload({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: '' }
  
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        setStatus(null);
      } else {
        setStatus({ type: 'error', message: 'Only CSV files are supported.' });
      }
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setStatus(null);
      } else {
        setStatus({ type: 'error', message: 'Only CSV files are supported.' });
      }
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success) {
        setStatus({
          type: 'success',
          message: res.data.message || 'File uploaded successfully!',
        });
        const uploadedFile = file;
        setFile(null);
        if (onUploadSuccess) {
          onUploadSuccess(res.data.summary, uploadedFile);
        }
      } else {
        setStatus({
          type: 'error',
          message: res.data.message || 'Upload failed.',
        });
      }
    } catch (err) {
      console.error(err);
      setStatus({
        type: 'error',
        message: err.response?.data?.message || 'Server error occurred during upload.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container glass-panel animate-slide-up">
      <h3 style={{ marginBottom: '16px', fontSize: '1.25rem' }}>Upload Sales Ledger</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
        Import sales records from your local CSV spreadsheet. Ensure the sheet includes Date, Product, Category, Region, UnitsSold, and UnitPrice columns.
      </p>

      {status && (
        <div className={`alert ${status.type === 'success' ? 'alert-success' : 'alert-error'}`}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{status.message}</span>
        </div>
      )}

      <form 
        onDragEnter={handleDrag} 
        onSubmit={(e) => e.preventDefault()}
        style={{ position: 'relative' }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden-input"
          style={{ display: 'none' }}
          accept=".csv"
          onChange={handleChange}
          disabled={loading}
        />

        <div
          className={`dropzone ${dragActive ? 'active' : ''}`}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
        >
          <div className="upload-icon">
            {loading ? (
              <Loader2 className="spinner" size={32} style={{ color: 'var(--primary)' }} />
            ) : (
              <UploadCloud size={32} />
            )}
          </div>
          
          {file ? (
            <div>
              <p style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{file.name}</p>
              <span style={{ fontSize: '0.75rem' }}>
                {(file.size / 1024).toFixed(2)} KB
              </span>
            </div>
          ) : (
            <div>
              <p>Drag and drop your CSV file here, or <span style={{ color: 'var(--primary)', fontWeight: '600' }}>browse</span></p>
              <span>Supports only .csv files</span>
            </div>
          )}
        </div>
      </form>

      {file && (
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={handleUpload}
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? 'Processing...' : 'Upload & Parse CSV'}
          </button>
        </div>
      )}
    </div>
  );
}

export default FileUpload;
