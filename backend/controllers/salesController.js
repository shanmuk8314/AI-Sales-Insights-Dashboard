const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const Sale = require('../models/Sale');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/postgres');
const UploadHistory = require('../models/UploadHistory');
const { calculateGrowthMetrics } = require('../utils/growthCalculator');


exports.uploadCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Please upload a CSV file.' });
  }

  const filePath = req.file.path;
  const uploadId = uuidv4();
  const salesToInsert = [];
  let parsedCount = 0;

  let validationError = null;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('headers', (headers) => {
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
        validationError = `CSV validation failed. Missing required columns: ${missing.join(', ')}.`;
      }
    })
    .on('data', (row) => {
      if (validationError) return;

      // Clean properties and standardise property names
      const dateVal = row.date || row.Date || row.DATE || row.DateOfSale;
      const productVal = row.product || row.Product || row.PRODUCT;
      const categoryVal = row.category || row.Category || row.CATEGORY;
      const regionVal = row.region || row.Region || row.REGION;
      
      const unitsSoldStr = row.unitsSold || row.UnitsSold || row.units_sold || row.Units_Sold || row.UNITS_SOLD;
      const unitPriceStr = row.unitPrice || row.UnitPrice || row.unit_price || row.Unit_Price || row.UNIT_PRICE;

      const unitsSoldVal = parseInt(unitsSoldStr, 10);
      const unitPriceVal = parseFloat(unitPriceStr);

      if (dateVal && productVal && categoryVal && regionVal && !isNaN(unitsSoldVal) && !isNaN(unitPriceVal)) {
        const calculatedRevenue = unitsSoldVal * unitPriceVal;
        
        salesToInsert.push({
          date: new Date(dateVal),
          product: productVal.trim(),
          category: categoryVal.trim(),
          region: regionVal.trim(),
          unitsSold: unitsSoldVal,
          unitPrice: unitPriceVal,
          revenue: calculatedRevenue,
          uploadId
        });
        parsedCount++;
      }
    })
    .on('end', async () => {
      try {
        if (validationError) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return res.status(400).json({ success: false, message: validationError });
        }

        if (salesToInsert.length === 0) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
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
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return res.status(400).json({ 
            success: false, 
            message: 'CSV upload rejected. All records in this file already exist in the database (duplicate file upload).' 
          });
        }

        // Bulk insert only unique records
        await Sale.insertMany(uniqueSalesToInsert);

        // Clean up file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

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
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return res.status(500).json({ success: false, message: 'Database saving failed.', error: error.message });
      }
    })
    .on('error', (error) => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(500).json({ success: false, message: 'CSV parsing failed.', error: error.message });
    });
};

exports.getDashboardData = async (req, res) => {
  try {
    // 1. KPI Cards data and growth rates using the unified growth calculator
    const metrics = await calculateGrowthMetrics();
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
    ]);

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
    ]);

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
    ]);

    const topProduct = topProductAggr[0]
      ? { name: topProductAggr[0]._id, revenue: topProductAggr[0].revenue }
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
    ]);

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
    ]);

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
    ]);

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
    ]);

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
    ]);

    // 5. Recent sales transactions
    const recentSales = await Sale.find({})
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
    const history = await UploadHistory.find({})
      .sort({ timestamp: -1 })
      .limit(10);
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
