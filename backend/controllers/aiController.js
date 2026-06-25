const { pool } = require('../config/postgres');
const geminiService = require('../services/geminiService');
const insightsService = require('../services/insightsService');
const { calculateGrowthMetrics } = require('../utils/growthCalculator');


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

exports.getAiInsights = async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const { region, product, month } = req.query;
    const filters = { region, product, month };
    const hasFilters = (region && region !== 'All') || (product && product !== 'All') || (month && month !== 'All');

    // 1. Get current count of filtered sales records from PostgreSQL
    let countQuery = 'SELECT COUNT(*) FROM sales WHERE 1=1';
    let countParams = [];
    if (filters.month && filters.month !== 'All') {
      const [yearStr, monthStr] = filters.month.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      countParams.push(start, end);
      countQuery += ` AND sale_date >= $1 AND sale_date <= $2`;
    }
    
    let { query: countQueryFinal, params: countParamsFinal } = buildWhereClause(countQuery, countParams, filters);
    const countRes = await pool.query(countQueryFinal, countParamsFinal);
    const currentSalesCount = parseInt(countRes.rows[0].count, 10);

    if (currentSalesCount === 0) {
      return res.status(200).json({
        success: true,
        insights: null,
        metadata: {
          totalRecords: 0,
          lastUpdated: new Date().toISOString()
        },
        message: 'No sales records found matching the active filters.'
      });
    }

    // 2. Unless force refresh or active filters are requested, check the cache first
    if (!forceRefresh && !hasFilters) {
      const cacheRes = await pool.query('SELECT * FROM ai_insights_cache ORDER BY updated_at DESC LIMIT 1');
      if (cacheRes.rows.length > 0) {
        const cache = cacheRes.rows[0];
        console.log('Serving AI insights from PostgreSQL cache.');
        return res.status(200).json({
          success: true,
          insights: cache.insights,
          metadata: {
            totalRecords: cache.records_count,
            lastUpdated: cache.updated_at
          },
          cached: true
        });
      }
    }

    console.log('Generating fresh AI insights (cache miss, active filters, or force refresh)...');

    // 3. Gather aggregates using PostgreSQL
    const metrics = await calculateGrowthMetrics(filters);
    const {
      latestDate,
      thirtyDaysAgo,
      sixtyDaysAgo,
      recentRevenue: recentTotal,
      recentTransactions: recentCount,
      previousRevenue: previousTotal,
      previousTransactions: previousCount,
      totalRevenueGrowth: growthRate
    } = metrics;

    // Recent product sales
    let recentProductsQuery = `
      SELECT product, SUM(revenue) as revenue, SUM(units_sold) as units 
      FROM sales 
      WHERE sale_date >= $1 AND sale_date <= $2
    `;
    let { query: rpq, params: rpp } = buildWhereClause(recentProductsQuery, [thirtyDaysAgo, latestDate], filters);
    rpq += ` GROUP BY product ORDER BY revenue DESC`;
    const recentProductsRes = await pool.query(rpq, rpp);

    // Previous product sales
    let previousProductsQuery = `
      SELECT product, SUM(revenue) as revenue 
      FROM sales 
      WHERE sale_date >= $1 AND sale_date < $2
    `;
    let { query: ppq, params: ppp } = buildWhereClause(previousProductsQuery, [sixtyDaysAgo, thirtyDaysAgo], filters);
    ppq += ` GROUP BY product`;
    const previousProductsRes = await pool.query(ppq, ppp);

    // Recent region sales
    let regionSalesQuery = `
      SELECT region, SUM(revenue) as revenue 
      FROM sales 
      WHERE sale_date >= $1 AND sale_date <= $2
    `;
    let { query: rsq, params: rsp } = buildWhereClause(regionSalesQuery, [thirtyDaysAgo, latestDate], filters);
    rsq += ` GROUP BY region ORDER BY revenue ASC`;
    const regionSalesRes = await pool.query(rsq, rsp);

    // Recent category sales
    let categorySalesQuery = `
      SELECT category, SUM(revenue) as revenue, SUM(units_sold) as units 
      FROM sales 
      WHERE sale_date >= $1 AND sale_date <= $2
    `;
    let { query: csq, params: csp } = buildWhereClause(categorySalesQuery, [thirtyDaysAgo, latestDate], filters);
    csq += ` GROUP BY category ORDER BY revenue DESC`;
    const categorySalesRes = await pool.query(csq, csp);

    // Declining products logic
    const recentProdMap = new Map(recentProductsRes.rows.map(row => [row.product, parseFloat(row.revenue)]));
    const productDecline = [];
    previousProductsRes.rows.forEach(row => {
      const prevRevenue = parseFloat(row.revenue);
      const recentRevenue = recentProdMap.get(row.product) || 0;
      const dropAmount = prevRevenue - recentRevenue;
      if (dropAmount > 0 && prevRevenue > 0) {
        const dropPercentage = (dropAmount / prevRevenue) * 100;
        productDecline.push({
          product: row.product,
          revenueDecline: dropAmount,
          declinePercent: dropPercentage
        });
      }
    });
    productDecline.sort((a, b) => b.revenueDecline - a.revenueDecline);

    const analyticsData = {
      recentRevenue: recentTotal,
      previousRevenue: previousTotal,
      revenueGrowthRate: growthRate,
      recentTransactions: recentCount,
      previousTransactions: previousCount,
      products: recentProductsRes.rows.map(r => ({
        name: r.product,
        revenue: parseFloat(r.revenue),
        units: parseInt(r.units || 0, 10)
      })),
      territories: regionSalesRes.rows.map(r => ({
        name: r.region,
        revenue: parseFloat(r.revenue)
      })),
      decliningProducts: productDecline.slice(0, 3).map(d => ({
        product: d.product,
        revenueDecline: d.revenueDecline,
        declinePercent: d.declinePercent
      })),
      categoryPerformance: categorySalesRes.rows.map(row => ({
        category: row.category,
        revenue: parseFloat(row.revenue),
        unitsSold: parseInt(row.units || 0, 10)
      }))
    };

    let insights = null;

    if (!geminiService.isConfigured()) {
      console.warn("Gemini API key is not configured.");
      throw new Error("Gemini API key is not configured.");
    }

    // Call Gemini to get the fresh insights
    insights = await geminiService.generateInsightsFromData(analyticsData);
    
    // Save successfully generated insights to PostgreSQL cache only if no filters are active
    if (!hasFilters) {
      try {
        await pool.query('DELETE FROM ai_insights_cache');
        await pool.query(
          'INSERT INTO ai_insights_cache (insights, records_count, updated_at) VALUES ($1, $2, NOW())',
          [JSON.stringify(insights), currentSalesCount]
        );
        console.log('Saved successfully generated insights to PostgreSQL cache.');
      } catch (cacheWriteErr) {
        console.error('Failed to write to ai_insights_cache:', cacheWriteErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      insights,
      metadata: {
        totalRecords: currentSalesCount,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    console.error('Core error in getAiInsights:', error.message);
    const status = error.status || 503;
    return res.status(status).json({
      success: false,
      message: 'AI Insights temporarily unavailable.',
      error: error.message
    });
  }
};
