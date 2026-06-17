const { pool } = require('../config/postgres');
const geminiService = require('../services/geminiService');
const insightsService = require('../services/insightsService');
const { calculateGrowthMetrics } = require('../utils/growthCalculator');


exports.getAiInsights = async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    // 1. Get current count of sales records from PostgreSQL
    const countRes = await pool.query('SELECT COUNT(*) FROM sales');
    const currentSalesCount = parseInt(countRes.rows[0].count, 10);

    if (currentSalesCount === 0) {
      return res.status(200).json({
        success: true,
        insights: null,
        metadata: {
          totalRecords: 0,
          lastUpdated: new Date().toISOString()
        },
        message: 'No sales records found in system.'
      });
    }

    // 2. Unless force refresh is requested, check the cache first
    if (!forceRefresh) {
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

    console.log('Generating fresh AI insights (cache miss or force refresh)...');

    // 3. Gather aggregates using PostgreSQL
    const metrics = await calculateGrowthMetrics();
    const {
      latestDate,
      thirtyDaysAgo,
      sixtyDaysAgo,
      recentRevenue: recentTotal,
      recentTransactions: recentCount,
      previousRevenue: previousTotal,
      totalRevenueGrowth: growthRate
    } = metrics;

    // Recent product sales
    const recentProductsRes = await pool.query(`
      SELECT product, SUM(revenue) as revenue, SUM(units_sold) as units 
      FROM sales 
      WHERE sale_date >= $1 AND sale_date <= $2
      GROUP BY product
      ORDER BY revenue DESC
    `, [thirtyDaysAgo, latestDate]);

    // Previous product sales
    const previousProductsRes = await pool.query(`
      SELECT product, SUM(revenue) as revenue 
      FROM sales 
      WHERE sale_date >= $1 AND sale_date < $2
      GROUP BY product
    `, [sixtyDaysAgo, thirtyDaysAgo]);

    // Recent region sales
    const regionSalesRes = await pool.query(`
      SELECT region, SUM(revenue) as revenue 
      FROM sales 
      WHERE sale_date >= $1 AND sale_date <= $2
      GROUP BY region
      ORDER BY revenue ASC
    `, [thirtyDaysAgo, latestDate]);

    // Recent category sales
    const categorySalesRes = await pool.query(`
      SELECT category, SUM(revenue) as revenue, SUM(units_sold) as units 
      FROM sales 
      WHERE sale_date >= $1 AND sale_date <= $2
      GROUP BY category
      ORDER BY revenue DESC
    `, [thirtyDaysAgo, latestDate]);

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

    const topProduct = recentProductsRes.rows[0]
      ? { name: recentProductsRes.rows[0].product, revenue: parseFloat(recentProductsRes.rows[0].revenue) }
      : { name: 'N/A', revenue: 0 };

    const bestTerritory = regionSalesRes.rows.length > 0
      ? { name: regionSalesRes.rows[regionSalesRes.rows.length - 1].region, revenue: parseFloat(regionSalesRes.rows[regionSalesRes.rows.length - 1].revenue) }
      : { name: 'N/A', revenue: 0 };

    const weakTerritory = regionSalesRes.rows.length > 0
      ? { name: regionSalesRes.rows[0].region, revenue: parseFloat(regionSalesRes.rows[0].revenue) }
      : { name: 'N/A', revenue: 0 };

    const analyticsData = {
      totalRevenue: recentTotal,
      growthRate: growthRate,
      topProduct: topProduct,
      bestTerritory: bestTerritory,
      weakTerritory: weakTerritory,
      decliningProducts: productDecline.slice(0, 3).map(d => ({
        product: d.product,
        revenueDecline: d.revenueDecline,
        declinePercent: d.declinePercent
      })),
      categoryPerformance: categorySalesRes.rows.map(row => ({
        category: row.category,
        revenue: parseFloat(row.revenue),
        unitsSold: parseInt(row.units, 10)
      }))
    };

    let insights;
    let fallback = false;

    if (!geminiService.isConfigured()) {
      console.warn("Gemini API key is not configured. Falling back to rule-based insights.");
      insights = await insightsService.generateSalesInsights();
      fallback = true;
    } else {
      try {
        insights = await geminiService.generateInsightsFromData(analyticsData);
      } catch (apiError) {
        console.warn("Gemini AI API error or timeout. Falling back to rule-based insights. Error:", apiError.message);
        insights = await insightsService.generateSalesInsights();
        fallback = true;
      }
    }

    // 4. Save generated insights to PostgreSQL cache
    try {
      await pool.query('DELETE FROM ai_insights_cache');
      await pool.query(
        'INSERT INTO ai_insights_cache (insights, records_count, updated_at) VALUES ($1, $2, NOW())',
        [JSON.stringify(insights), currentSalesCount]
      );
      console.log('Saved generated insights to PostgreSQL cache.');
    } catch (cacheWriteErr) {
      console.error('Failed to write to ai_insights_cache:', cacheWriteErr.message);
    }

    // Get the timestamp from the database row to align exactly
    const finalCacheRes = await pool.query('SELECT updated_at FROM ai_insights_cache ORDER BY updated_at DESC LIMIT 1');
    const lastUpdated = finalCacheRes.rows[0]?.updated_at || new Date();

    return res.status(200).json({
      success: true,
      insights,
      metadata: {
        totalRecords: currentSalesCount,
        lastUpdated
      },
      fallback
    });

  } catch (error) {
    console.error('Core error in getAiInsights:', error);
    try {
      const ruleBased = await insightsService.generateSalesInsights();
      return res.status(200).json({
        success: true,
        insights: ruleBased,
        metadata: {
          totalRecords: 0,
          lastUpdated: new Date()
        },
        fallback: true,
        error: error.message
      });
    } catch (fallbackError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate insights.',
        error: fallbackError.message
      });
    }
  }
};
