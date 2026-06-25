const { pool } = require('../config/postgres');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../uploads/sales_db.json');

function buildWhereClause(baseQuery, params, filters) {
  let query = baseQuery;
  const newParams = [...params];
  
  if (filters.region && filters.region !== 'All') {
    newParams.push(filters.region);
    query += ` AND region = $${newParams.length}`;
  }
  
  if (filters.product && filters.product !== 'All') {
    newParams.push(filters.product);
    query += ` AND product = $${newParams.length}`;
  }
  
  return { query, params: newParams };
}

function getFallbackMetrics(filters = {}) {
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
    let sales = JSON.parse(raw).map(item => ({
      ...item,
      date: new Date(item.date),
      revenue: parseFloat(item.revenue),
      unitsSold: parseInt(item.unitsSold || item.units_sold, 10),
      unitPrice: parseFloat(item.unitPrice || item.unit_price)
    }));

    // Apply basic filters
    if (filters.region && filters.region !== 'All') {
      sales = sales.filter(s => s.region === filters.region);
    }
    if (filters.product && filters.product !== 'All') {
      sales = sales.filter(s => s.product === filters.product);
    }

    if (sales.length === 0) {
      return defaultPayload;
    }

    let latestDate, thirtyDaysAgo, sixtyDaysAgo;
    let recentStart, recentEnd, previousStart, previousEnd;

    if (filters.month && filters.month !== 'All') {
      const [yearStr, monthStr] = filters.month.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      recentStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
      recentEnd = new Date(year, month, 0, 23, 59, 59, 999);
      latestDate = recentEnd;
      thirtyDaysAgo = recentStart;

      const prevYear = month - 1 === 0 ? year - 1 : year;
      const prevMonth = month - 1 === 0 ? 12 : month - 1;
      previousStart = new Date(prevYear, prevMonth - 1, 1, 0, 0, 0, 0);
      previousEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);
      sixtyDaysAgo = previousStart;
    } else {
      // Find max date in filtered list
      let maxDateVal = sales[0].date;
      sales.forEach(s => {
        if (s.date > maxDateVal) maxDateVal = s.date;
      });

      latestDate = new Date(maxDateVal);
      thirtyDaysAgo = new Date(latestDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      sixtyDaysAgo = new Date(latestDate);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      recentStart = thirtyDaysAgo;
      recentEnd = latestDate;
      previousStart = sixtyDaysAgo;
      previousEnd = thirtyDaysAgo; // exclusive in non-month mode
    }

    // All time (or selected month if month filter active)
    let allTimeSales = sales;
    if (filters.month && filters.month !== 'All') {
      allTimeSales = sales.filter(s => s.date >= recentStart && s.date <= recentEnd);
    }
    const totalRevenue = allTimeSales.reduce((sum, s) => sum + s.revenue, 0);
    const totalUnitsSold = allTimeSales.reduce((sum, s) => sum + s.unitsSold, 0);
    const totalTransactions = allTimeSales.length;
    const avgOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    // Recent period
    const recentSales = sales.filter(s => s.date >= recentStart && s.date <= recentEnd);
    const recentRevenue = recentSales.reduce((sum, s) => sum + s.revenue, 0);
    const recentUnitsSold = recentSales.reduce((sum, s) => sum + s.unitsSold, 0);
    const recentTransactions = recentSales.length;
    const recentAvgOrderValue = recentTransactions > 0 ? recentRevenue / recentTransactions : 0;

    // Previous period
    const previousSales = sales.filter(s => {
      if (filters.month && filters.month !== 'All') {
        return s.date >= previousStart && s.date <= previousEnd;
      } else {
        return s.date >= previousStart && s.date < previousEnd;
      }
    });
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

async function calculateGrowthMetrics(filters = {}) {
  try {
    let latestDate, thirtyDaysAgo, sixtyDaysAgo;
    let recentStart, recentEnd, previousStart, previousEnd;

    if (filters.month && filters.month !== 'All') {
      const [yearStr, monthStr] = filters.month.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      recentStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
      recentEnd = new Date(year, month, 0, 23, 59, 59, 999);
      latestDate = recentEnd;
      thirtyDaysAgo = recentStart;

      const prevYear = month - 1 === 0 ? year - 1 : year;
      const prevMonth = month - 1 === 0 ? 12 : month - 1;
      previousStart = new Date(prevYear, prevMonth - 1, 1, 0, 0, 0, 0);
      previousEnd = new Date(prevYear, prevMonth, 0, 23, 59, 59, 999);
      sixtyDaysAgo = previousStart;
    } else {
      // Find latest date from database with region/product filters
      let baseMax = 'SELECT MAX(sale_date) as max_date FROM sales WHERE 1=1';
      let maxParams = [];
      let { query: maxQuery, params: maxParamsFinal } = buildWhereClause(baseMax, maxParams, filters);
      
      const maxDateRes = await pool.query(maxQuery, maxParamsFinal);
      const maxDateVal = maxDateRes.rows[0]?.max_date;
      
      if (!maxDateVal) {
        // If PostgreSQL is empty, check fallback JSON
        return getFallbackMetrics(filters);
      }

      latestDate = new Date(maxDateVal);
      thirtyDaysAgo = new Date(latestDate);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      sixtyDaysAgo = new Date(latestDate);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      recentStart = thirtyDaysAgo;
      recentEnd = latestDate;
      previousStart = sixtyDaysAgo;
      previousEnd = thirtyDaysAgo;
    }

    // 2. Query all-time stats (or month stats if filtered)
    let baseAllTime = `
      SELECT 
        COALESCE(SUM(revenue), 0) as total_revenue,
        COALESCE(SUM(units_sold), 0) as total_units_sold,
        COUNT(*) as total_transactions
      FROM sales
      WHERE 1=1
    `;
    let allTimeParams = [];
    if (filters.month && filters.month !== 'All') {
      allTimeParams.push(recentStart, recentEnd);
      baseAllTime += ` AND sale_date >= $1 AND sale_date <= $2`;
    }
    
    let { query: allTimeQuery, params: allTimeParamsFinal } = buildWhereClause(baseAllTime, allTimeParams, filters);
    const allTimeRes = await pool.query(allTimeQuery, allTimeParamsFinal);
    const totalRevenue = parseFloat(allTimeRes.rows[0].total_revenue);
    const totalUnitsSold = parseInt(allTimeRes.rows[0].total_units_sold, 10);
    const totalTransactions = parseInt(allTimeRes.rows[0].total_transactions, 10);
    const avgOrderValue = totalTransactions > 0 ? Math.round(totalRevenue / totalTransactions) : 0;

    // 3. Query recent period stats
    let baseRecent = `
      SELECT 
        COALESCE(SUM(revenue), 0) as revenue,
        COALESCE(SUM(units_sold), 0) as units_sold,
        COUNT(*) as transactions
      FROM sales
      WHERE sale_date >= $1 AND sale_date <= $2
    `;
    let { query: recentQuery, params: recentParamsFinal } = buildWhereClause(baseRecent, [recentStart, recentEnd], filters);
    const recentRes = await pool.query(recentQuery, recentParamsFinal);
    const recentRevenue = parseFloat(recentRes.rows[0].revenue);
    const recentUnitsSold = parseInt(recentRes.rows[0].units_sold, 10);
    const recentTransactions = parseInt(recentRes.rows[0].transactions, 10);
    const recentAvgOrderValue = recentTransactions > 0 ? recentRevenue / recentTransactions : 0;

    // 4. Query previous period stats
    let basePrevious = `
      SELECT 
        COALESCE(SUM(revenue), 0) as revenue,
        COALESCE(SUM(units_sold), 0) as units_sold,
        COUNT(*) as transactions
      FROM sales
      WHERE sale_date >= $1 AND sale_date ${filters.month && filters.month !== 'All' ? '<=' : '<'} $2
    `;
    let { query: previousQuery, params: previousParamsFinal } = buildWhereClause(basePrevious, [previousStart, previousEnd], filters);
    const previousRes = await pool.query(previousQuery, previousParamsFinal);
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
    return getFallbackMetrics(filters);
  }
}

module.exports = {
  calculateGrowthMetrics
};
