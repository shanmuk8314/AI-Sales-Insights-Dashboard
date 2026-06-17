const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const UploadHistorySchema = new mongoose.Schema({
  fileName: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, required: true },
  recordsCount: { type: Number, required: true },
  revenue: { type: Number, required: true },
  uploadId: { type: String, required: true, index: true },
  summary: {
    topProduct: String,
    bestTerritory: String,
    needsAttention: String,
    startDate: Date,
    endDate: Date
  }
}, { timestamps: true });

const RealUploadHistoryModel = mongoose.model('UploadHistory', UploadHistorySchema);

// Fallback JSON-based Mock database path for backup
const dbPath = path.join(__dirname, '../uploads/upload_history.json');

const readDataFromPostgres = async () => {
  try {
    const { pool } = require('../config/postgres');
    const res = await pool.query('SELECT * FROM upload_history ORDER BY timestamp DESC');
    return res.rows.map(row => ({
      _id: String(row.id),
      fileName: row.file_name,
      timestamp: new Date(row.timestamp),
      recordsCount: row.records_count,
      revenue: parseFloat(row.revenue),
      uploadId: row.upload_id,
      summary: row.summary ? {
        topProduct: row.summary.topProduct,
        bestTerritory: row.summary.bestTerritory,
        needsAttention: row.summary.needsAttention,
        startDate: row.summary.startDate ? new Date(row.summary.startDate) : null,
        endDate: row.summary.endDate ? new Date(row.summary.endDate) : null
      } : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.created_at)
    }));
  } catch (err) {
    console.error("Failed to read upload_history from PostgreSQL, falling back to local JSON:", err.message);
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(raw).map(item => ({
        ...item,
        timestamp: new Date(item.timestamp),
        summary: item.summary ? {
          ...item.summary,
          startDate: item.summary.startDate ? new Date(item.summary.startDate) : null,
          endDate: item.summary.endDate ? new Date(item.summary.endDate) : null
        } : null
      }));
    }
    return [];
  }
};

const MockUploadHistoryModel = {
  create: async (doc) => {
    const { pool } = require('../config/postgres');
    const query = `
      INSERT INTO upload_history (file_name, timestamp, records_count, revenue, upload_id, summary)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const res = await pool.query(query, [
      doc.fileName,
      doc.timestamp || new Date(),
      doc.recordsCount,
      doc.revenue,
      doc.uploadId,
      JSON.stringify(doc.summary)
    ]);
    const row = res.rows[0];

    // Local JSON backup
    try {
      const currentJsonData = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : [];
      const newDoc = {
        _id: String(row.id),
        fileName: row.file_name,
        timestamp: row.timestamp,
        recordsCount: row.records_count,
        revenue: parseFloat(row.revenue),
        uploadId: row.upload_id,
        summary: row.summary,
        createdAt: row.created_at,
        updatedAt: row.created_at
      };
      currentJsonData.push(newDoc);
      fs.writeFileSync(dbPath, JSON.stringify(currentJsonData, null, 2), 'utf8');
    } catch (backupErr) {
      console.error("Local JSON backup failed:", backupErr.message);
    }

    return {
      _id: String(row.id),
      fileName: row.file_name,
      timestamp: row.timestamp,
      recordsCount: row.records_count,
      revenue: parseFloat(row.revenue),
      uploadId: row.upload_id,
      summary: row.summary,
      createdAt: row.created_at,
      updatedAt: row.created_at
    };
  },

  find: (query) => {
    let promise = readDataFromPostgres().then(result => {
      let filtered = result;
      if (query && Object.keys(query).length > 0) {
        filtered = filtered.filter(item => {
          for (const key of Object.keys(query)) {
            if (item[key] !== query[key]) return false;
          }
          return true;
        });
      }
      return filtered;
    });

    const queryChain = {
      sort: function(sortObj) {
        promise = promise.then(result => {
          const key = Object.keys(sortObj)[0];
          const order = sortObj[key];
          const sorted = [...result];
          sorted.sort((a, b) => {
            let valA = a[key];
            let valB = b[key];
            if (valA instanceof Date) valA = valA.getTime();
            if (valB instanceof Date) valB = valB.getTime();
            if (valA < valB) return order === -1 ? 1 : -1;
            if (valA > valB) return order === -1 ? -1 : 1;
            return 0;
          });
          return sorted;
        });
        return this;
      },
      limit: function(n) {
        promise = promise.then(result => {
          return result.slice(0, n);
        });
        return this;
      },
      then: function(resolve, reject) {
        return promise.then(resolve, reject);
      }
    };
    return queryChain;
  },

  findOne: (query) => {
    let promise = readDataFromPostgres().then(result => {
      let filtered = result;
      if (query && Object.keys(query).length > 0) {
        filtered = filtered.filter(item => {
          for (const key of Object.keys(query)) {
            if (item[key] !== query[key]) return false;
          }
          return true;
        });
      }
      return filtered;
    });

    const queryChain = {
      then: function(resolve, reject) {
        return promise.then(result => {
          resolve(result[0] || null);
        }, reject);
      }
    };
    return queryChain;
  }
};

module.exports = MockUploadHistoryModel;
