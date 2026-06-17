const { pool } = require('../config/postgres');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../uploads/sales_db.json');

function getFallbackMetrics() {
  const defaultPayload = {
    latestDate: new Date(),
    thirtyDaysAgo: new Date(),
    sixtyDaysAgo: new Date(),
    totalRevenue: 0,
    totalUnitsSold: 0,
    totalTransactions: 0,
    avgOrderValue: 0,
    recentRevenue: 0,
    recentUnitsSold: 0,
    recentTransactions: 0,
    recentAvgOrderValue: 0,
    previousRevenue: 0,
    previousUnitsSold: 0,
    previousTransactions: 0,
    previousAvgOrderValue: 0,
    totalRevenueGrowth: 0,
    totalUnitsSoldGrowth: 0,
    totalTransactionsGrowth: 0,
    avgOrderValueGrowth: 0
  };

  if (!fs.existsSync(dbPath)) {
    return defaultPayload;
  }

  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const sales = JSON.parse(raw).map(item => ({
      ...item,
      date: new Date(item.date),
      revenue: parseFloat(item.revenue),
      unitsSold: parseInt(item.unitsSold || item.units_sold, 10),
      unitPrice: parseFloat(item.unitPrice || item.unit_price)
    }));

    if (sales.length === 0) {
      return defaultPayload;
    }

    // Find max date
    let maxDateVal = sales[0].date;
    sales.forEach(s => {
      if (s.date > maxDateVal) maxDateVal = s.date;
    });

    const latestDate = new Date(maxDateVal);
    const thirtyDaysAgo = new Date(latestDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(latestDate);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // All time
    const totalRevenue = sales.reduce((sum, s) => sum + s.revenue, 0);
    const totalUnitsSold = sales.reduce((sum, s) => sum + s.unitsSold, 0);
    const totalTransactions = sales.length;
    const avgOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    // Recent 30 days
    const recentSales = sales.filter(s => s.date >= thirtyDaysAgo && s.date <= latestDate);
    const recentRevenue = recentSales.reduce((sum, s) => sum + s.revenue, 0);
    const recentUnitsSold = recentSales.reduce((sum, s) => sum + s.unitsSold, 0);
    const recentTransactions = recentSales.length;
    const recentAvgOrderValue = recentTransactions > 0 ? recentRevenue / recentTransactions : 0;

    // Previous 30 days
    const previousSales = sales.filter(s => s.date >= sixtyDaysAgo && s.date < thirtyDaysAgo);
    const previousRevenue = previousSales.reduce((sum, s) => sum + s.revenue, 0);
    const previousUnitsSold = previousSales.reduce((sum, s) => sum + s.unitsSold, 0);
    const previousTransactions = previousSales.length;
    const previousAvgOrderValue = previousTransactions > 0 ? previousRevenue / previousTransactions : 0;

    const totalRevenueGrowth = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const totalUnitsSoldGrowth = previousUnitsSold > 0 ? ((recentUnitsSold - previousUnitsSold) / previousUnitsSold) * 100 : 0;
    const totalTransactionsGrowth = previousTransactions > 0 ? ((recentTransactions - previousTransactions) / previousTransactions) * 100 : 0;
    const avgOrderValueGrowth = previousAvgOrderValue > 0 ? ((recentAvgOrderValue - previousAvgOrderValue) / previousAvgOrderValue) * 100 : 0;

    return {
      latestDate,
      thirtyDaysAgo,
      sixtyDaysAgo,
      totalRevenue,
      totalUnitsSold,
      totalTransactions,
      avgOrderValue,
      recentRevenue,
      recentUnitsSold,
      recentTransactions,
      recentAvgOrderValue,
      previousRevenue,
      previousUnitsSold,
      previousTransactions,
      previousAvgOrderValue,
      totalRevenueGrowth,
      totalUnitsSoldGrowth,
      totalTransactionsGrowth,
      avgOrderValueGrowth
    };
  } catch (err) {
    console.error('Error processing fallback JSON in growthCalculator:', err.message);
    return defaultPayload;
  }
}

async function calculateGrowthMetrics() {
  try {
    // 1. Fetch latest date from database
    const maxDateRes = await pool.query('SELECT MAX(sale_date) as max_date FROM sales');
    const maxDateVal = maxDateRes.rows[0]?.max_date;
    
    if (!maxDateVal) {
      // If PostgreSQL is empty, check fallback JSON
      return getFallbackMetrics();
    }

    const latestDate = new Date(maxDateVal);
    const thirtyDaysAgo = new Date(latestDate);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(latestDate);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 2. Query all-time stats
    const allTimeRes = await pool.query(`
      SELECT 
        COALESCE(SUM(revenue), 0) as total_revenue,
        COALESCE(SUM(units_sold), 0) as total_units_sold,
        COUNT(*) as total_transactions
      FROM sales
    `);
    const totalRevenue = parseFloat(allTimeRes.rows[0].total_revenue);
    const totalUnitsSold = parseInt(allTimeRes.rows[0].total_units_sold, 10);
    const totalTransactions = parseInt(allTimeRes.rows[0].total_transactions, 10);
    const avgOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    // 3. Query recent 30 days stats (inclusive of thirtyDaysAgo and latestDate)
    const recentRes = await pool.query(`
      SELECT 
        COALESCE(SUM(revenue), 0) as revenue,
        COALESCE(SUM(units_sold), 0) as units_sold,
        COUNT(*) as transactions
      FROM sales
      WHERE sale_date >= $1 AND sale_date <= $2
    `, [thirtyDaysAgo, latestDate]);
    const recentRevenue = parseFloat(recentRes.rows[0].revenue);
    const recentUnitsSold = parseInt(recentRes.rows[0].units_sold, 10);
    const recentTransactions = parseInt(recentRes.rows[0].transactions, 10);
    const recentAvgOrderValue = recentTransactions > 0 ? recentRevenue / recentTransactions : 0;

    // 4. Query previous 30 days stats (inclusive of sixtyDaysAgo, exclusive of thirtyDaysAgo)
    const previousRes = await pool.query(`
      SELECT 
        COALESCE(SUM(revenue), 0) as revenue,
        COALESCE(SUM(units_sold), 0) as units_sold,
        COUNT(*) as transactions
      FROM sales
      WHERE sale_date >= $1 AND sale_date < $2
    `, [sixtyDaysAgo, thirtyDaysAgo]);
    const previousRevenue = parseFloat(previousRes.rows[0].revenue);
    const previousUnitsSold = parseInt(previousRes.rows[0].units_sold, 10);
    const previousTransactions = parseInt(previousRes.rows[0].transactions, 10);
    const previousAvgOrderValue = previousTransactions > 0 ? previousRevenue / previousTransactions : 0;

    // Calculate growth percentages
    const totalRevenueGrowth = previousRevenue > 0 ? ((recentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
    const totalUnitsSoldGrowth = previousUnitsSold > 0 ? ((recentUnitsSold - previousUnitsSold) / previousUnitsSold) * 100 : 0;
    const totalTransactionsGrowth = previousTransactions > 0 ? ((recentTransactions - previousTransactions) / previousTransactions) * 100 : 0;
    const avgOrderValueGrowth = previousAvgOrderValue > 0 ? ((recentAvgOrderValue - previousAvgOrderValue) / previousAvgOrderValue) * 100 : 0;

    return {
      latestDate,
      thirtyDaysAgo,
      sixtyDaysAgo,
      totalRevenue,
      totalUnitsSold,
      totalTransactions,
      avgOrderValue,
      recentRevenue,
      recentUnitsSold,
      recentTransactions,
      recentAvgOrderValue,
      previousRevenue,
      previousUnitsSold,
      previousTransactions,
      previousAvgOrderValue,
      totalRevenueGrowth,
      totalUnitsSoldGrowth,
      totalTransactionsGrowth,
      avgOrderValueGrowth
    };
  } catch (error) {
    console.error('Error in calculateGrowthMetrics, falling back to JSON:', error.message);
    return getFallbackMetrics();
  }
}

module.exports = {
  calculateGrowthMetrics
};
