const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Sale = require('../models/Sale');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/postgres');
const UploadHistory = require('../models/UploadHistory');
const { calculateGrowthMetrics } = require('../utils/growthCalculator');

const safeUnlinkSync = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`Failed to delete file at ${filePath}:`, err.message);
  }
};

exports.uploadCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a CSV file.' });
  }

  const filePath = req.file.path;
  const uploadId = uuidv4();
  const salesToInsert = [];
  let rowCount = 0;
  let validationError = null;

  // 1. Pre-validate file size (empty file check)
  try {
    const stats = fs.statSync(filePath);
    if (stats.size === 0) {
      safeUnlinkSync(filePath);
      return res.status(400).json({ success: false, message: 'CSV validation failed. Empty CSV file.' });
    }
  } catch (err) {
    console.error("Error reading file stats:", err.message);
  }

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('headers', (headers) => {
      if (validationError) return;

      if (!headers || headers.length === 0 || (headers.length === 1 && !headers[0].trim())) {
        validationError = 'CSV validation failed. Empty CSV file or missing headers.';
        return;
      }

      // Check duplicate headers
      const seenHeaders = new Set();
      for (const h of headers) {
        const cleanH = h.trim();
        if (!cleanH) continue;
        const lowerH = cleanH.toLowerCase();
        if (seenHeaders.has(lowerH)) {
          validationError = `CSV validation failed. Duplicate header found: "${cleanH}".`;
          return;
        }
        seenHeaders.add(lowerH);
      }

      // Check required columns
      const required = ['Date', 'Product', 'Category', 'Region', 'UnitsSold', 'UnitPrice'];
      const missing = [];

      required.forEach(reqCol => {
        const hasCol = headers.some(h => {
          const cleanH = h.trim().toLowerCase();
          const cleanReq = reqCol.toLowerCase();
          if (cleanH === cleanReq) return true;
          if (cleanReq === 'date' && cleanH === 'dateofsale') return true;
          if (cleanReq === 'unitssold' && (cleanH === 'units_sold' || cleanH === 'units sold')) return true;
          if (cleanReq === 'unitprice' && (cleanH === 'unit_price' || cleanH === 'unit price')) return true;
          return false;
        });

        if (!hasCol) {
          missing.push(reqCol);
        }
      });

      if (missing.length > 0) {
        validationError = `Missing columns: ${missing.join(', ')}`;
      }
    })
    .on('data', (row) => {
      if (validationError) return;
      rowCount++;

      // Clean properties and standardise property names
      const dateStr = row.date || row.Date || row.DATE || row.DateOfSale || row.dateofsale || row['date of sale'];
      const productVal = row.product || row.Product || row.PRODUCT;
      const categoryVal = row.category || row.Category || row.CATEGORY;
      const regionVal = row.region || row.Region || row.REGION;
      const unitsSoldStr = row.unitsSold || row.UnitsSold || row.units_sold || row.Units_Sold || row.UNITS_SOLD || row['units sold'];
      const unitPriceStr = row.unitPrice || row.UnitPrice || row.unit_price || row.Unit_Price || row.UNIT_PRICE || row['unit price'];

      if (!dateStr || !productVal || !categoryVal || !regionVal || !unitsSoldStr || !unitPriceStr) {
        validationError = `CSV validation failed. Row ${rowCount} is missing required data columns.`;
        return;
      }

      // Validate date
      const parsedDate = new Date(dateStr.trim());
      if (isNaN(parsedDate.getTime())) {
        validationError = `CSV validation failed. Row ${rowCount}: Invalid date "${dateStr}".`;
        return;
      }

      // Validate UnitsSold
      const unitsSoldVal = parseInt(unitsSoldStr, 10);
      if (isNaN(unitsSoldVal)) {
        validationError = `CSV validation failed. Row ${rowCount}: UnitsSold must be a valid integer.`;
        return;
      }
      if (unitsSoldVal < 0) {
        validationError = `CSV validation failed. Row ${rowCount}: UnitsSold cannot be negative (${unitsSoldStr}).`;
        return;
      }

      // Validate UnitPrice
      const unitPriceVal = parseFloat(unitPriceStr);
      if (isNaN(unitPriceVal)) {
        validationError = `CSV validation failed. Row ${rowCount}: UnitPrice must be a valid decimal number.`;
        return;
      }
      if (unitPriceVal < 0) {
        validationError = `CSV validation failed. Row ${rowCount}: UnitPrice cannot be negative (${unitPriceStr}).`;
        return;
      }

      const calculatedRevenue = unitsSoldVal * unitPriceVal;

      salesToInsert.push({
        date: parsedDate,
        product: productVal.trim(),
        category: categoryVal.trim(),
        region: regionVal.trim(),
        unitsSold: unitsSoldVal,
        unitPrice: unitPriceVal,
        revenue: calculatedRevenue,
        uploadId
      });
    })
    .on('end', async () => {
      try {
        if (!validationError && rowCount === 0) {
          validationError = 'CSV validation failed. Empty CSV file or no data rows found.';
        }

        if (validationError) {
          safeUnlinkSync(filePath);
          if (res.headersSent) return;
          return res.status(400).json({ success: false, message: validationError });
        }

        if (salesToInsert.length === 0) {
          safeUnlinkSync(filePath);
          if (res.headersSent) return;
          return res.status(400).json({ success: false, message: 'No valid sales data found in CSV.' });
        }

        // 1. Fetch existing sales from PostgreSQL to check for duplicates
        const existingRes = await pool.query('SELECT sale_date, product, region, units_sold, revenue FROM sales');
        const makeKey = (date, product, region, unitsSold, revenue) => {
          const d = new Date(date);
          const time = isNaN(d.getTime()) ? 0 : d.getTime();
          return `${time}_${product.trim().toLowerCase()}_${region.trim().toLowerCase()}_${unitsSold}_${parseFloat(revenue).toFixed(2)}`;
        };

        const existingKeys = new Set(existingRes.rows.map(row => 
          makeKey(row.sale_date, row.product, row.region, row.units_sold, row.revenue)
        ));

        // 2. Filter out duplicates from salesToInsert
        const uniqueSalesToInsert = [];
        const seenInCsv = new Set();
        let skippedDbDuplicates = 0;
        let skippedCsvDuplicates = 0;

        for (const sale of salesToInsert) {
          const rowKey = makeKey(sale.date, sale.product, sale.region, sale.unitsSold, sale.revenue);
          if (existingKeys.has(rowKey)) {
            skippedDbDuplicates++;
            continue;
          }
          if (seenInCsv.has(rowKey)) {
            skippedCsvDuplicates++;
            continue;
          }
          seenInCsv.add(rowKey);
          uniqueSalesToInsert.push(sale);
        }

        if (uniqueSalesToInsert.length === 0) {
          safeUnlinkSync(filePath);
          if (res.headersSent) return;
          return res.status(400).json({ 
            success: false, 
            message: 'CSV upload rejected. All records in this file already exist in the database (duplicate file upload).' 
          });
        }

        // Bulk insert only unique records
        await Sale.insertMany(uniqueSalesToInsert);

        // Clean up file
        safeUnlinkSync(filePath);

        // Calculate upload summary dynamically from the unique records
        const revenue = uniqueSalesToInsert.reduce((sum, item) => sum + item.revenue, 0);
        
        const prodMap = {};
        uniqueSalesToInsert.forEach(s => {
          prodMap[s.product] = (prodMap[s.product] || 0) + s.revenue;
        });
        let topProductName = 'N/A';
        let topProductRev = 0;
        for (const p of Object.keys(prodMap)) {
          if (prodMap[p] > topProductRev) {
            topProductRev = prodMap[p];
            topProductName = p;
          }
        }

        const regMap = {};
        uniqueSalesToInsert.forEach(s => {
          regMap[s.region] = (regMap[s.region] || 0) + s.revenue;
        });
        let bestRegName = 'N/A';
        let bestRegRev = -Infinity;
        let worstRegName = 'N/A';
        let worstRegRev = Infinity;
        for (const r of Object.keys(regMap)) {
          if (regMap[r] > bestRegRev) {
            bestRegRev = regMap[r];
            bestRegName = r;
          }
          if (regMap[r] < worstRegRev) {
            worstRegRev = regMap[r];
            worstRegName = r;
          }
        }
        if (bestRegRev === -Infinity) bestRegName = 'N/A';
        if (worstRegRev === Infinity) worstRegName = 'N/A';

        let minDate = uniqueSalesToInsert[0].date;
        let maxDate = uniqueSalesToInsert[0].date;
        uniqueSalesToInsert.forEach(s => {
          if (s.date < minDate) minDate = s.date;
          if (s.date > maxDate) maxDate = s.date;
        });

        const summary = {
          topProduct: topProductName,
          bestTerritory: bestRegName,
          needsAttention: worstRegName,
          startDate: minDate,
          endDate: maxDate
        };

        // Save Upload History
        await UploadHistory.create({
          fileName: req.file.originalname,
          timestamp: new Date(),
          recordsCount: uniqueSalesToInsert.length,
          revenue,
          uploadId,
          summary
        });

        // Invalidate AI Insights cache since data has changed
        try {
          await pool.query('DELETE FROM ai_insights_cache');
          console.log('AI Insights cache invalidated successfully.');
        } catch (cacheErr) {
          console.error('Failed to invalidate AI Insights cache:', cacheErr.message);
        }

        let successMsg = `Successfully uploaded and parsed CSV file. Inserted ${uniqueSalesToInsert.length} new records.`;
        if (skippedDbDuplicates > 0 || skippedCsvDuplicates > 0) {
          successMsg += ` Skipped ${skippedDbDuplicates} duplicate records already in database, and ${skippedCsvDuplicates} duplicate records within the CSV file itself.`;
        }

        if (res.headersSent) return;
        return res.status(200).json({
          success: true,
          message: successMsg,
          uploadId,
          summary: {
            recordsCount: uniqueSalesToInsert.length,
            revenue,
            topProduct: topProductName,
            bestTerritory: bestRegName,
            lowestTerritory: worstRegName,
            startDate: minDate.toISOString().split('T')[0],
            endDate: maxDate.toISOString().split('T')[0]
          }
        });
      } catch (error) {
        safeUnlinkSync(filePath);
        if (res.headersSent) {
          console.error('Error occurred after response sent:', error);
          return;
        }
        return res.status(500).json({ success: false, message: 'Database saving failed.', error: error.message });
      }
    })
    .on('error', (error) => {
      safeUnlinkSync(filePath);
      if (res.headersSent) {
        console.error('Stream error occurred after response sent:', error);
        return;
      }
      return res.status(500).json({ success: false, message: 'CSV parsing failed.', error: error.message });
    });
};

exports.getDashboardData = async (req, res) => {
  try {
    const { region, product, month } = req.query;
    const filters = { region, product, month };

    // 1. KPI Cards data and growth rates using the unified growth calculator
    const metrics = await calculateGrowthMetrics(filters);
    const {
      totalRevenue,
      totalUnitsSold,
      totalTransactions,
      avgOrderValue,
      totalRevenueGrowth,
      totalUnitsSoldGrowth,
      totalTransactionsGrowth,
      avgOrderValueGrowth
    } = metrics;

    // 2. Sales by Region
    const salesByRegion = await Sale.aggregate([
      {
        $group: {
          _id: '$region',
          revenue: { $sum: '$revenue' },
          unitsSold: { $sum: '$unitsSold' }
        }
      },
      {
        $project: {
          region: '$_id',
          revenue: 1,
          unitsSold: 1,
          _id: 0
        }
      },
      { $sort: { revenue: -1 } }
    ], filters);

    // 3. Sales by Category
    const salesByCategory = await Sale.aggregate([
      {
        $group: {
          _id: '$category',
          revenue: { $sum: '$revenue' },
          unitsSold: { $sum: '$unitsSold' }
        }
      },
      {
        $project: {
          category: '$_id',
          revenue: 1,
          unitsSold: 1,
          _id: 0
        }
      },
      { $sort: { revenue: -1 } }
    ], filters);

    // Calculate top product by revenue
    const topProductAggr = await Sale.aggregate([
      {
        $group: {
          _id: '$product',
          revenue: { $sum: '$revenue' }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 1 }
    ], filters);

    const topProduct = topProductAggr[0]
      ? { name: topProductAggr[0]._id, revenue: topProductAggr[0].revenue }
      : { name: 'N/A', revenue: 0 };

    // Calculate weak product by revenue
    const weakProductAggr = await Sale.aggregate([
      {
        $group: {
          _id: '$product',
          revenue: { $sum: '$revenue' }
        }
      },
      { $sort: { revenue: 1 } },
      { $limit: 1 }
    ], filters);

    const weakProduct = weakProductAggr[0]
      ? { name: weakProductAggr[0]._id, revenue: weakProductAggr[0].revenue }
      : { name: 'N/A', revenue: 0 };

    const bestTerritory = salesByRegion[0]
      ? { name: salesByRegion[0].region, revenue: salesByRegion[0].revenue }
      : { name: 'N/A', revenue: 0 };

    const needsAttention = salesByRegion.length > 0
      ? { name: salesByRegion[salesByRegion.length - 1].region, revenue: salesByRegion[salesByRegion.length - 1].revenue }
      : { name: 'N/A', revenue: 0 };

    // 4. Sales Trends over time (Weekly, Monthly, Half-Yearly, Yearly)
    const weeklyTrends = await Sale.aggregate([
      {
        $group: {
          _id: {
            $concat: [
              { $dateToString: { format: '%G', date: '$date' } },
              '-W',
              { $dateToString: { format: '%V', date: '$date' } },
              '_',
              '$region'
            ]
          },
          revenue: { $sum: '$revenue' },
          unitsSold: { $sum: '$unitsSold' }
        }
      },
      {
        $project: {
          periodRegion: '$_id',
          revenue: 1,
          unitsSold: 1,
          _id: 0
        }
      },
      { $sort: { periodRegion: 1 } }
    ], filters);

    const monthlyTrends = await Sale.aggregate([
      {
        $group: {
          _id: {
            $concat: [
              { $dateToString: { format: '%Y-%m', date: '$date' } },
              '_',
              '$region'
            ]
          },
          revenue: { $sum: '$revenue' },
          unitsSold: { $sum: '$unitsSold' }
        }
      },
      {
        $project: {
          periodRegion: '$_id',
          revenue: 1,
          unitsSold: 1,
          _id: 0
        }
      },
      { $sort: { periodRegion: 1 } }
    ], filters);

    const quarterlyTrends = await Sale.aggregate([
      {
        $group: {
          _id: {
            $concat: [
              { $dateToString: { format: '%Y', date: '$date' } },
              '-Q',
              {
                $cond: [
                  { $lte: [{ $month: '$date' }, 3] },
                  '1',
                  {
                    $cond: [
                      { $lte: [{ $month: '$date' }, 6] },
                      '2',
                      {
                        $cond: [
                          { $lte: [{ $month: '$date' }, 9] },
                          '3',
                          '4'
                        ]
                      }
                    ]
                  }
                ]
              },
              '_',
              '$region'
            ]
          },
          revenue: { $sum: '$revenue' },
          unitsSold: { $sum: '$unitsSold' }
        }
      },
      {
        $project: {
          periodRegion: '$_id',
          revenue: 1,
          unitsSold: 1,
          _id: 0
        }
      },
      { $sort: { periodRegion: 1 } }
    ], filters);

    const halfYearlyTrends = await Sale.aggregate([
      {
        $group: {
          _id: {
            $concat: [
              { $dateToString: { format: '%Y', date: '$date' } },
              '-',
              {
                $cond: [
                  { $lte: [{ $month: '$date' }, 6] },
                  'H1',
                  'H2'
                ]
              },
              '_',
              '$region'
            ]
          },
          revenue: { $sum: '$revenue' },
          unitsSold: { $sum: '$unitsSold' }
        }
      },
      {
        $project: {
          periodRegion: '$_id',
          revenue: 1,
          unitsSold: 1,
          _id: 0
        }
      },
      { $sort: { periodRegion: 1 } }
    ], filters);

    const yearlyTrends = await Sale.aggregate([
      {
        $group: {
          _id: {
            $concat: [
              { $dateToString: { format: '%Y', date: '$date' } },
              '_',
              '$region'
            ]
          },
          revenue: { $sum: '$revenue' },
          unitsSold: { $sum: '$unitsSold' }
        }
      },
      {
        $project: {
          periodRegion: '$_id',
          revenue: 1,
          unitsSold: 1,
          _id: 0
        }
      },
      { $sort: { periodRegion: 1 } }
    ], filters);

    // 5. Recent sales transactions
    const recentSales = await Sale.find({}, filters)
      .sort({ date: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      kpis: {
        totalRevenue,
        totalRevenueGrowth,
        totalUnitsSold,
        totalUnitsSoldGrowth,
        totalTransactions,
        totalTransactionsGrowth,
        avgOrderValue,
        avgOrderValueGrowth,
        topProduct,
        weakProduct,
        bestTerritory,
        needsAttention
      },
      salesByRegion,
      salesByCategory,
      salesTrends: {
        weekly: weeklyTrends,
        monthly: monthlyTrends,
        quarterly: quarterlyTrends,
        halfYearly: halfYearlyTrends,
        yearly: yearlyTrends
      },
      recentSales
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve dashboard data.",
      error: error.message
    });
  }
};

exports.getUploadHistory = async (req, res) => {
  try {
    const { search, sort } = req.query;
    // Pass query and search/sort options
    const history = await UploadHistory.find({}, { search, sort });
    return res.status(200).json({
      success: true,
      history
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve upload history.',
      error: error.message
    });
  }
};

exports.getFilterOptions = async (req, res) => {
  try {
    let regions = [];
    let products = [];
    let months = [];

    try {
      const regionsRes = await pool.query("SELECT DISTINCT region FROM sales WHERE region IS NOT NULL AND region != '' ORDER BY region");
      regions = regionsRes.rows.map(r => r.region);

      const productsRes = await pool.query("SELECT DISTINCT product FROM sales WHERE product IS NOT NULL AND product != '' ORDER BY product");
      products = productsRes.rows.map(p => p.product);

      const monthsRes = await pool.query("SELECT DISTINCT TO_CHAR(sale_date, 'YYYY-MM') as month FROM sales WHERE sale_date IS NOT NULL ORDER BY month DESC");
      months = monthsRes.rows.map(m => m.month);
    } catch (dbErr) {
      console.warn("PostgreSQL connection failed, falling back to local JSON for filter options:", dbErr.message);
      const dbPath = path.join(__dirname, '../uploads/sales_db.json');
      if (fs.existsSync(dbPath)) {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const sales = JSON.parse(raw);
        
        regions = [...new Set(sales.map(s => s.region).filter(Boolean))].sort();
        products = [...new Set(sales.map(s => s.product).filter(Boolean))].sort();
        months = [...new Set(sales.map(s => {
          if (!s.date) return null;
          const d = new Date(s.date);
          if (isNaN(d.getTime())) return null;
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          return `${y}-${m}`;
        }).filter(Boolean))].sort().reverse();
      }
    }

    return res.status(200).json({
      success: true,
      regions,
      products,
      months
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve filter options.',
      error: error.message
    });
  }
};

exports.getAnalyticsSummary = async (req, res) => {
  try {
    let totalUploads = 0;
    let totalProducts = 0;
    let totalRegions = 0;
    let lastUploadDate = null;
    let totalAiReports = 0;

    try {
      const uploadsRes = await pool.query("SELECT COUNT(*) as count FROM upload_history");
      totalUploads = parseInt(uploadsRes.rows[0].count, 10);

      const productsRes = await pool.query("SELECT COUNT(DISTINCT product) as count FROM sales");
      totalProducts = parseInt(productsRes.rows[0].count, 10);

      const regionsRes = await pool.query("SELECT COUNT(DISTINCT region) as count FROM sales");
      totalRegions = parseInt(regionsRes.rows[0].count, 10);

      const lastUploadRes = await pool.query("SELECT MAX(timestamp) as max_time FROM upload_history");
      lastUploadDate = lastUploadRes.rows[0].max_time;

      totalAiReports = totalUploads;
    } catch (dbErr) {
      console.warn("PostgreSQL connection failed, falling back to local JSON for analytics summary:", dbErr.message);
      const dbPath = path.join(__dirname, '../uploads/sales_db.json');
      const historyPath = path.join(__dirname, '../uploads/upload_history.json');
      
      if (fs.existsSync(historyPath)) {
        const rawHistory = fs.readFileSync(historyPath, 'utf8');
        const historyList = JSON.parse(rawHistory);
        totalUploads = historyList.length;
        totalAiReports = totalUploads;
        if (historyList.length > 0) {
          const timestamps = historyList.map(h => new Date(h.timestamp).getTime()).filter(Boolean);
          if (timestamps.length > 0) {
            lastUploadDate = new Date(Math.max(...timestamps)).toISOString();
          }
        }
      }
      
      if (fs.existsSync(dbPath)) {
        const rawSales = fs.readFileSync(dbPath, 'utf8');
        const salesList = JSON.parse(rawSales);
        totalProducts = new Set(salesList.map(s => s.product).filter(Boolean)).size;
        totalRegions = new Set(salesList.map(s => s.region).filter(Boolean)).size;
      }
    }

    return res.status(200).json({
      success: true,
      totalUploads,
      totalAiReports,
      totalProducts,
      totalRegions,
      lastUploadDate
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics summary.',
      error: error.message
    });
  }
};
