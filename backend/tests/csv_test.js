const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');

// Mock Environment
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/sales_insights_test';

const Sale = require('../models/Sale');

async function runTest() {
  console.log('--- STARTING SALES DASHBOARD INTEGRATION TEST ---');

  // 1. Connect database
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✔ MongoDB Connected Successfully.');
  } catch (err) {
    console.error('✖ Database Connection Failed:', err.message);
    process.exit(1);
  }

  // Clear previous test records
  await Sale.deleteMany({});
  console.log('✔ Cleaned test database collection.');

  // 2. Parse mock CSV file
  const csvFilePath = path.join(__dirname, '../../scratch/sample_sales.csv');
  if (!fs.existsSync(csvFilePath)) {
    console.error(`✖ Test CSV file not found at: ${csvFilePath}`);
    process.exit(1);
  }

  console.log(`Starting parsing of: ${csvFilePath}`);
  const salesToInsert = [];
  const uploadId = 'test-upload-uuid-12345';

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (row) => {
      const dateVal = row.date || row.Date || row.DATE;
      const productVal = row.product || row.Product || row.PRODUCT;
      const categoryVal = row.category || row.Category || row.CATEGORY;
      const regionVal = row.region || row.Region || row.REGION;
      
      const unitsSoldVal = parseInt(row.unitsSold || row.UnitsSold || row.units_sold, 10);
      const unitPriceVal = parseFloat(row.unitPrice || row.UnitPrice || row.unit_price);

      if (dateVal && productVal && categoryVal && regionVal && !isNaN(unitsSoldVal) && !isNaN(unitPriceVal)) {
        salesToInsert.push({
          date: new Date(dateVal),
          product: productVal.trim(),
          category: categoryVal.trim(),
          region: regionVal.trim(),
          unitsSold: unitsSoldVal,
          unitPrice: unitPriceVal,
          revenue: unitsSoldVal * unitPriceVal,
          uploadId
        });
      }
    })
    .on('end', async () => {
      try {
        console.log(`Parsed ${salesToInsert.length} lines. Saving to MongoDB...`);
        
        // Save
        const result = await Sale.insertMany(salesToInsert);
        console.log(`✔ Successfully inserted ${result.length} sales records into MongoDB.`);

        // 3. Test Dashboard Aggregations
        console.log('Testing Dashboard aggregate pipelines...');
        
        const kpiData = await Sale.aggregate([
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$revenue' },
              totalUnitsSold: { $sum: '$unitsSold' },
              totalTransactions: { $sum: 1 }
            }
          }
        ]);
        const kpis = kpiData[0] || { totalRevenue: 0, totalUnitsSold: 0, totalTransactions: 0 };
        kpis.avgOrderValue = kpis.totalTransactions > 0 ? kpis.totalRevenue / kpis.totalTransactions : 0;
        console.log('✔ KPIs calculated:', kpis);

        const salesByRegion = await Sale.aggregate([
          { $group: { _id: '$region', revenue: { $sum: '$revenue' } } },
          { $sort: { revenue: -1 } }
        ]);
        console.log('✔ Sales by Region:', salesByRegion);

        // 4. Test Insights Aggregations
        console.log('Testing Declining Products calculation...');
        const maxDateRecord = await Sale.findOne().sort({ date: -1 });
        const latestDate = maxDateRecord.date;
        const thirtyDaysAgo = new Date(latestDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const sixtyDaysAgo = new Date(latestDate);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const recentProductSales = await Sale.aggregate([
          { $match: { date: { $gte: thirtyDaysAgo, $lte: latestDate } } },
          { $group: { _id: '$product', recentRevenue: { $sum: '$revenue' } } }
        ]);

        const previousProductSales = await Sale.aggregate([
          { $match: { date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
          { $group: { _id: '$product', previousRevenue: { $sum: '$revenue' } } }
        ]);

        const decliningProducts = [];
        const recentMap = new Map(recentProductSales.map(item => [item._id, item.recentRevenue]));
        
        previousProductSales.forEach(item => {
          const prevRevenue = item.previousRevenue;
          const recentRevenue = recentMap.get(item._id) || 0;
          if (recentRevenue < prevRevenue && prevRevenue > 0) {
            const dropAmount = prevRevenue - recentRevenue;
            const dropPercentage = (dropAmount / prevRevenue) * 100;
            if (dropPercentage > 10) {
              decliningProducts.push({
                name: item._id,
                previousRevenue: prevRevenue,
                recentRevenue,
                dropAmount,
                dropPercentage
              });
            }
          }
        });

        console.log('✔ Declining Products found (>10% drop):', decliningProducts);

        // Clean up test data and exit
        await Sale.deleteMany({});
        await mongoose.disconnect();
        console.log('✔ Cleaned up database and disconnected.');
        console.log('--- INTEGRATION TEST PASSED SUCCESSFULLY ---');
        process.exit(0);
      } catch (err) {
        console.error('✖ Integration test failed:', err);
        await mongoose.disconnect();
        process.exit(1);
      }
    })
    .on('error', (err) => {
      console.error('✖ File streaming error:', err);
      process.exit(1);
    });
}

runTest();
