const fs = require('fs');
const path = require('path');

// Fallback JSON-based Mock database path for backup
const dbPath = path.join(__dirname, '../uploads/sales_db.json');

const readDataFromPostgres = async () => {
  try {
    const { pool } = require('../config/postgres');
    const res = await pool.query('SELECT * FROM sales ORDER BY sale_date DESC');
    return res.rows.map(row => ({
      _id: String(row.id),
      date: new Date(row.sale_date),
      product: row.product,
      category: row.category,
      region: row.region,
      unitsSold: row.units_sold,
      unitPrice: parseFloat(row.unit_price),
      revenue: parseFloat(row.revenue),
      uploadId: row.upload_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.created_at)
    }));
  } catch (err) {
    console.error("Failed to read sales from PostgreSQL, falling back to local JSON:", err.message);
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(raw).map(item => ({
        ...item,
        date: new Date(item.date)
      }));
    }
    return [];
  }
};

// Date utilities for ISO weeks
const getISOWeek = (d) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

const getISOYear = (d) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  return date.getFullYear();
};

const evalExpr = (expr, item) => {
  if (typeof expr === 'number') return expr;
  if (typeof expr === 'string') {
    if (expr.startsWith('$')) {
      return item[expr.substring(1)];
    }
    return expr;
  }
  if (typeof expr === 'object' && expr !== null) {
    if (expr.$cond) {
      const condObj = expr.$cond[0];
      const isTrue = evalExpr(condObj, item);
      return isTrue ? evalExpr(expr.$cond[1], item) : evalExpr(expr.$cond[2], item);
    }
    if (expr.$gt) {
      return evalExpr(expr.$gt[0], item) > evalExpr(expr.$gt[1], item);
    }
    if (expr.$lte) {
      return evalExpr(expr.$lte[0], item) <= evalExpr(expr.$lte[1], item);
    }
    if (expr.$month) {
      const dateVal = evalExpr(expr.$month, item);
      if (dateVal instanceof Date) {
        return dateVal.getMonth() + 1;
      }
      return 0;
    }
    if (expr.$multiply) {
      return evalExpr(expr.$multiply[0], item) * evalExpr(expr.$multiply[1], item);
    }
    if (expr.$divide) {
      const denom = evalExpr(expr.$divide[1], item);
      return denom !== 0 ? evalExpr(expr.$divide[0], item) / denom : 0;
    }
    if (expr.$concat) {
      return expr.$concat.map(subExpr => String(evalExpr(subExpr, item))).join('');
    }
    if (expr.$dateToString) {
      const format = expr.$dateToString.format;
      const dateVal = evalExpr(expr.$dateToString.date, item);
      if (dateVal instanceof Date) {
        const y = dateVal.getFullYear();
        const m = String(dateVal.getMonth() + 1).padStart(2, '0');
        if (format === '%Y-%m') {
          return `${y}-${m}`;
        }
        if (format === '%Y') {
          return `${y}`;
        }
        if (format === '%G') {
          return String(getISOYear(dateVal));
        }
        if (format === '%V') {
          return String(getISOWeek(dateVal)).padStart(2, '0');
        }
      }
      return String(dateVal);
    }
  }
  return 0;
};

const evalGroupKey = (expr, item) => {
  if (expr === null) return 'null';
  return String(evalExpr(expr, item));
};

const MockSaleModel = {
  insertMany: async (docs) => {
    const { pool } = require('../config/postgres');
    const preparedDocs = docs.map(doc => {
      const docObj = doc.toObject ? doc.toObject() : doc;
      return {
        date: docObj.date,
        product: docObj.product,
        category: docObj.category,
        region: docObj.region,
        unitsSold: docObj.unitsSold,
        unitPrice: docObj.unitPrice,
        revenue: docObj.revenue || (docObj.unitsSold * docObj.unitPrice),
        uploadId: docObj.uploadId
      };
    });

    const insertedRows = [];
    const batchSize = 100;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (let i = 0; i < preparedDocs.length; i += batchSize) {
        const batch = preparedDocs.slice(i, i + batchSize);
        const values = [];
        const valuePlaceholders = [];
        let paramIndex = 1;

        for (const sale of batch) {
          values.push(
            new Date(sale.date),
            sale.product,
            sale.category,
            sale.region,
            sale.unitsSold,
            sale.unitPrice,
            sale.revenue,
            sale.uploadId
          );
          valuePlaceholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7})`);
          paramIndex += 8;
        }

        const query = `
          INSERT INTO sales (sale_date, product, category, region, units_sold, unit_price, revenue, upload_id)
          VALUES ${valuePlaceholders.join(', ')}
          RETURNING *
        `;
        const res = await client.query(query, values);
        insertedRows.push(...res.rows);
      }

      await client.query('COMMIT');
    } catch (transactionErr) {
      await client.query('ROLLBACK');
      throw transactionErr;
    } finally {
      client.release();
    }

    // Write to local JSON backup
    try {
      const currentJsonData = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : [];
      const backedUp = [...currentJsonData, ...insertedRows.map(row => ({
        _id: String(row.id),
        date: row.sale_date,
        product: row.product,
        category: row.category,
        region: row.region,
        unitsSold: row.units_sold,
        unitPrice: parseFloat(row.unit_price),
        revenue: parseFloat(row.revenue),
        uploadId: row.upload_id,
        createdAt: row.created_at,
        updatedAt: row.created_at
      }))];
      fs.writeFileSync(dbPath, JSON.stringify(backedUp, null, 2), 'utf8');
    } catch (backupErr) {
      console.error("Local JSON backup failed:", backupErr.message);
    }

    return insertedRows.map(row => ({
      _id: String(row.id),
      date: row.sale_date,
      product: row.product,
      category: row.category,
      region: row.region,
      unitsSold: row.units_sold,
      unitPrice: parseFloat(row.unit_price),
      revenue: parseFloat(row.revenue),
      uploadId: row.upload_id,
      createdAt: row.created_at,
      updatedAt: row.created_at
    }));
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
      then: function(resolve, reject) {
        return promise.then(result => {
          resolve(result[0] || null);
        }, reject);
      }
    };
    return queryChain;
  },

  aggregate: async (pipeline) => {
    let result = await readDataFromPostgres();

    for (const stage of pipeline) {
      if (stage.$match) {
        const match = stage.$match;
        result = result.filter(item => {
          if (match.date) {
            const itemDate = item.date;
            if (match.date.$gte && itemDate < match.date.$gte) return false;
            if (match.date.$lte && itemDate > match.date.$lte) return false;
            if (match.date.$gt && itemDate <= match.date.$gt) return false;
            if (match.date.$lt && itemDate >= match.date.$lt) return false;
          }
          for (const key of Object.keys(match)) {
            if (key !== 'date' && item[key] !== match[key]) {
              return false;
            }
          }
          return true;
        });
      } else if (stage.$group) {
        const group = stage.$group;
        const idExpr = group._id;
        const groups = {};

        for (const item of result) {
          const groupKey = evalGroupKey(idExpr, item);

          if (!groups[groupKey]) {
            groups[groupKey] = [];
          }
          groups[groupKey].push(item);
        }

        result = Object.keys(groups).map(key => {
          const groupedItems = groups[key];
          const output = {};
          if (idExpr === null) {
            output._id = null;
          } else {
            output._id = key;
          }

          for (const field of Object.keys(group)) {
            if (field === '_id') continue;
            const op = group[field];
            if (op.$sum) {
              const valExpr = op.$sum;
              if (valExpr === 1) {
                output[field] = groupedItems.length;
              } else if (typeof valExpr === 'string' && valExpr.startsWith('$')) {
                const valField = valExpr.substring(1);
                output[field] = groupedItems.reduce((sum, item) => sum + (Number(item[valField]) || 0), 0);
              }
            }
          }
          return output;
        });
      } else if (stage.$project) {
        const project = stage.$project;
        result = result.map(item => {
          const output = {};
          for (const field of Object.keys(project)) {
            if (project[field] === 1) {
              output[field] = item[field];
            } else if (typeof project[field] === 'string' && project[field].startsWith('$')) {
              output[field] = item[project[field].substring(1)];
            } else {
              output[field] = evalExpr(project[field], item);
            }
          }
          if (project._id === 0) {
            delete output._id;
          }
          return output;
        });
      } else if (stage.$sort) {
        const sortObj = stage.$sort;
        const key = Object.keys(sortObj)[0];
        const order = sortObj[key];
        result.sort((a, b) => {
          let valA = a[key];
          let valB = b[key];
          if (valA < valB) return order === -1 ? 1 : -1;
          if (valA > valB) return order === -1 ? -1 : 1;
          return 0;
        });
      } else if (stage.$limit) {
        result = result.slice(0, stage.$limit);
      }
    }
    return result;
  }
};

module.exports = MockSaleModel;
