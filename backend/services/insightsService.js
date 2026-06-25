const Sale = require('../models/Sale');
const { calculateGrowthMetrics } = require('../utils/growthCalculator');


/**
 * Helper to format currency for Indian Rupee (INR) with no decimal points.
 */
const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

/**
 * Helper to format numbers in Indian locale.
 */
const formatNumber = (val) => {
  return new Intl.NumberFormat('en-IN').format(val);
};

/**
 * Generates structured performance insights for non-technical pharmaceutical executives.
 * Groups outputs into 5 distinct business-focused sections:
 * - executiveSummary
 * - topProducts
 * - weakTerritories
 * - decliningProducts
 * - recommendations
 */
exports.generateSalesInsights = async (filters = {}) => {
  // Find latest date in database to anchor our 30-day windows
  const maxDateRecord = await Sale.findOne({}, filters).sort({ date: -1 });
  
  const emptyPayload = {
    executiveSummary: 'No sales records found. Please upload a CSV file to show sales numbers.',
    productAnalysis: {
      topProduct: { productName: 'N/A', revenue: 'N/A', reason: 'No product data.', recommendation: 'Upload sales records.' },
      moderateProduct: { productName: 'N/A', revenue: 'N/A', reason: 'No product data.', suggestion: 'Upload sales records.' },
      weakProduct: { productName: 'N/A', revenue: 'N/A', reason: 'No product data.', suggestion: 'Upload sales records.' }
    },
    territoryAnalysis: {
      strongTerritory: { territoryName: 'N/A', revenue: 'N/A', observation: 'No territory data.', recommendation: 'Upload sales records.' },
      moderateTerritory: { territoryName: 'N/A', revenue: 'N/A', observation: 'No territory data.', recommendation: 'Upload sales records.' },
      weakTerritory: { territoryName: 'N/A', revenue: 'N/A', observation: 'No territory data.', recommendation: 'Upload sales records.' }
    },
    trendAnalysis: {
      previousMonthRevenue: '₹0',
      currentMonthRevenue: '₹0',
      growthPercentage: '0%',
      insight: 'Upload sales records to see monthly performance trends.'
    },
    recommendations: [
      'Upload sales records to get sales recommendations.'
    ]
  };

  if (!maxDateRecord) {
    return emptyPayload;
  }

  const metrics = await calculateGrowthMetrics(filters);
  const {
    latestDate,
    thirtyDaysAgo,
    sixtyDaysAgo,
    recentRevenue: recentTotal,
    recentTransactions: recentCount,
    previousRevenue: previousTotal,
    previousTransactions: previousCount
  } = metrics;

  // --- 1. PRODUCT ANALYSIS SECTION ---
  const recentProductSales = await Sale.aggregate([
    { $match: { date: { $gte: thirtyDaysAgo, $lte: latestDate } } },
    { $group: { _id: '$product', revenue: { $sum: '$revenue' }, units: { $sum: '$unitsSold' } } },
    { $sort: { revenue: -1 } }
  ], filters);

  if (recentProductSales.length === 0) {
    return emptyPayload;
  }

  const topProductObj = recentProductSales[0];
  const weakProductObj = recentProductSales.length > 1 ? recentProductSales[recentProductSales.length - 1] : null;
  const moderateProductObj = recentProductSales.length > 2 ? recentProductSales[Math.floor(recentProductSales.length / 2)] : null;

  const topProdName = topProductObj._id;
  const topProdRevStr = `${formatCurrency(topProductObj.revenue)} (${((topProductObj.revenue / recentTotal) * 100).toFixed(1)}%)`;
  
  const modProdName = moderateProductObj ? moderateProductObj._id : 'N/A';
  const modProdRevStr = moderateProductObj ? `${formatCurrency(moderateProductObj.revenue)} (${((moderateProductObj.revenue / recentTotal) * 100).toFixed(1)}%)` : 'N/A';

  const weakProdName = weakProductObj ? weakProductObj._id : 'N/A';
  const weakProdRevStr = weakProductObj ? `${formatCurrency(weakProductObj.revenue)} (${((weakProductObj.revenue / recentTotal) * 100).toFixed(1)}%)` : 'N/A';

  // --- 2. TERRITORY ANALYSIS SECTION ---
  const regionSales = await Sale.aggregate([
    { $match: { date: { $gte: thirtyDaysAgo, $lte: latestDate } } },
    { $group: { _id: '$region', revenue: { $sum: '$revenue' } } },
    { $sort: { revenue: 1 } } // ascending, first is lowest
  ], filters);

  const weakRegObj = regionSales[0];
  const strongRegObj = regionSales.length > 1 ? regionSales[regionSales.length - 1] : null;
  const moderateRegObj = regionSales.length > 2 ? regionSales[Math.floor(regionSales.length / 2)] : null;

  const strongTerrName = strongRegObj ? strongRegObj._id : (weakRegObj ? weakRegObj._id : 'N/A');
  const strongTerrRevStr = strongRegObj 
    ? `${formatCurrency(strongRegObj.revenue)} (${((strongRegObj.revenue / recentTotal) * 100).toFixed(1)}%)` 
    : (weakRegObj ? `${formatCurrency(weakRegObj.revenue)} (100.0%)` : 'N/A');

  const modTerrName = moderateRegObj ? moderateRegObj._id : 'N/A';
  const modTerrRevStr = moderateRegObj ? `${formatCurrency(moderateRegObj.revenue)} (${((moderateRegObj.revenue / recentTotal) * 100).toFixed(1)}%)` : 'N/A';

  const weakTerrName = weakRegObj ? weakRegObj._id : 'N/A';
  const weakTerrRevStr = weakRegObj ? `${formatCurrency(weakRegObj.revenue)} (${((weakRegObj.revenue / recentTotal) * 100).toFixed(1)}%)` : 'N/A';

  // --- 3. TREND ANALYSIS SECTION ---
  let growthPercentage = '0.0%';
  let diff = recentTotal - previousTotal;
  let direction = diff >= 0 ? 'increased' : 'decreased';
  if (previousTotal > 0) {
    const changePct = (diff / previousTotal) * 100;
    growthPercentage = `${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`;
  } else {
    growthPercentage = '+100.0%'; // starting growth
  }

  const trendInsight = previousTotal > 0 
    ? `Revenue ${direction} by ${growthPercentage} compared to the previous month. ${topProdName} remained the strongest product. ${strongTerrName} region continued to lead sales while ${weakTerrName} region requires additional focus.`
    : `Initial month tracked. Sales reached ${formatCurrency(recentTotal)} led by ${topProdName} in the ${strongTerrName} region.`;

  // --- 4. EXECUTIVE SUMMARY SECTION ---
  const executiveSummary = previousTotal > 0
    ? `Revenue ${direction} by ${growthPercentage} compared to the previous month. ${topProdName} remained the strongest product. ${strongTerrName} region continued to lead sales while ${weakTerrName} region requires additional focus.`
    : `Mediwave Life Sciences registered total sales revenue of ${formatCurrency(recentTotal)} led by ${topProdName} contributing ${topProdRevStr} of sales.`;

  // Construct complete payload
  return {
    executiveSummary,
    productAnalysis: {
      topProduct: {
        productName: topProdName,
        revenue: topProdRevStr,
        reason: `High clinical adoption and strong prescriber loyalty for ${topProdName} drove outstanding sales.`,
        recommendation: `Maintain steady stock levels to prevent inventory shortage.`
      },
      moderateProduct: {
        productName: modProdName,
        revenue: modProdRevStr,
        reason: moderateProductObj ? `Moderate sales velocity due to regional competitor marketing for ${modProdName}.` : 'Middle-tier items are performing steadily.',
        suggestion: moderateProductObj ? `Introduce promotional bundling with top products to accelerate ${modProdName} sales.` : 'Review pricing strategy.'
      },
      weakProduct: {
        productName: weakProdName,
        revenue: weakProdRevStr,
        reason: weakProductObj ? `Low distributor presence and high unit cost resulted in sluggish ${weakProdName} sales.` : 'Lagging items show low buyer pull.',
        suggestion: weakProductObj ? `Offer regional volume discounts or clinical training to dealers to clear ${weakProdName} inventory.` : 'Assess discontinuing low performing items.'
      }
    },
    territoryAnalysis: {
      strongTerritory: {
        territoryName: strongTerrName,
        revenue: strongTerrRevStr,
        observation: `Excellent dealer coverage and high demand in the ${strongTerrName} territory.`,
        recommendation: `Host distributor engagement events to maintain market dominance.`
      },
      moderateTerritory: {
        territoryName: modTerrName,
        revenue: modTerrRevStr,
        observation: moderateRegObj ? `Stable buying behavior but lacks deep pharmacy penetration in ${modTerrName}.` : 'Mid-tier markets show steady purchase volumes.',
        recommendation: moderateRegObj ? `Establish additional pharmacy direct-delivery schemes in ${modTerrName}.` : 'Audit distributor performance.'
      },
      weakTerritory: {
        territoryName: weakTerrName,
        revenue: weakTerrRevStr,
        observation: weakRegObj ? `Weak sales rep deployment and sluggish order cycles in ${weakTerrName} region.` : 'Lagging regions require strategic realignments.',
        recommendation: weakRegObj ? `Deploy senior field sales agents in the ${weakTerrName} region to recover market share.` : 'Realign field forces.'
      }
    },
    trendAnalysis: {
      previousMonthRevenue: formatCurrency(previousTotal),
      currentMonthRevenue: formatCurrency(recentTotal),
      growthPercentage,
      insight: trendInsight
    },
    recommendations: [
      `Increase inventory buffer for ${topProdName} to leverage high market demand.`,
      weakProductObj ? `Improve regional marketing campaigns and promotions for ${weakProdName}.` : 'Improve marketing campaigns for slow-moving inventory.',
      weakRegObj ? `Expand distributor coverage in the ${weakTerrName} territory to increase reach.` : 'Expand distributor coverage in weak territories.',
      moderateProductObj ? `Monitor ${modProdName} performance for growth and product bundling opportunities.` : 'Monitor mid-tier items for growth opportunities.',
      strongRegObj ? `Maintain successful sales strategies in the ${strongTerrName} territory.` : 'Maintain successful strategies in key regions.'
    ]
  };
};
