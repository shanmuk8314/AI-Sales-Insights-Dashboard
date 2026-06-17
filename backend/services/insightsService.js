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
exports.generateSalesInsights = async () => {
  // Find latest date in database to anchor our 30-day windows
  const maxDateRecord = await Sale.findOne().sort({ date: -1 });
  
  if (!maxDateRecord) {
    return {
      executiveSummary: [
        {
          title: 'Revenue',
          text: 'No sales records found. Please upload a CSV file to show sales numbers.',
          status: 'yellow',
          highlight: 'No Data'
        },
        {
          title: 'Total Invoices',
          text: 'Upload sales records to track invoices and billing numbers.',
          status: 'yellow',
          highlight: 'No Data'
        }
      ],
      topProducts: [
        {
          title: 'Top Product',
          text: 'Upload sales records to see your best-selling product lines.',
          status: 'green',
          highlight: 'No Data'
        },
        {
          title: 'Top Shipped Packs',
          text: 'Track product shipments across different items.',
          status: 'green',
          highlight: 'No Data'
        }
      ],
      weakTerritories: [
        {
          title: 'Weak Region',
          text: 'Please upload sales records to identify weak regions.',
          status: 'red',
          highlight: 'No Data'
        }
      ],
      decliningProducts: [
        {
          title: 'Sales Drop',
          text: 'No product details found. Upload a CSV file to monitor sales drops.',
          status: 'green',
          highlight: 'No Data'
        }
      ],
      recommendations: [
        {
          title: 'Recommended Action',
          text: 'Upload sales records to get sales recommendations.',
          status: 'yellow',
          highlight: 'Audit Needed'
        }
      ]
    };
  }

  const metrics = await calculateGrowthMetrics();
  const {
    latestDate,
    thirtyDaysAgo,
    sixtyDaysAgo,
    recentRevenue: recentTotal,
    recentTransactions: recentCount,
    previousRevenue: previousTotal,
    previousTransactions: previousCount
  } = metrics;

  const execSummary = [];

  // Card 1: Revenue
  if (previousTotal === 0) {
    execSummary.push({
      title: 'Revenue',
      text: `Sales reached **${formatCurrency(recentTotal)}** over the last 30 days. We need more data to compare trends.`,
      status: 'green',
      highlight: formatCurrency(recentTotal)
    });
  } else {
    const diff = recentTotal - previousTotal;
    const changePct = (diff / previousTotal) * 100;
    
    if (diff > 0) {
      execSummary.push({
        title: 'Revenue',
        text: `Sales reached **${formatCurrency(recentTotal)}**. This is a **${changePct.toFixed(1)}%** growth compared to last month. Sales are growing steadily.`,
        status: 'green',
        highlight: `+${changePct.toFixed(1)}%`
      });
    } else {
      const dropPct = Math.abs(changePct);
      const statusLevel = dropPct > 15 ? 'red' : 'yellow';
      execSummary.push({
        title: 'Revenue',
        text: `Sales fell by **${dropPct.toFixed(1)}%** to **${formatCurrency(recentTotal)}**. We should focus on increasing sales.`,
        status: statusLevel,
        highlight: `-${dropPct.toFixed(1)}%`
      });
    }
  }

  // Card 2: Total Invoices
  if (previousCount === 0) {
    execSummary.push({
      title: 'Total Invoices',
      text: `We processed **${formatNumber(recentCount)} invoices** in the last 30 days. This is our starting point.`,
      status: 'green',
      highlight: `${recentCount} Invoices`
    });
  } else {
    const diff = recentCount - previousCount;
    const changePct = (diff / previousCount) * 100;
    
    if (diff >= 0) {
      execSummary.push({
        title: 'Total Invoices',
        text: `Invoices grew by **${changePct.toFixed(1)}%** to **${formatNumber(recentCount)}**. We are getting more customers.`,
        status: 'green',
        highlight: `+${changePct.toFixed(1)}%`
      });
    } else {
      const dropPct = Math.abs(changePct);
      execSummary.push({
        title: 'Total Invoices',
        text: `Processed invoices fell by **${dropPct.toFixed(1)}%** to **${formatNumber(recentCount)}**. Sales activity is down.`,
        status: 'yellow',
        highlight: `-${dropPct.toFixed(1)}%`
      });
    }
  }

  // --- 2. TOP PRODUCTS SECTION ---
  const recentProductSales = await Sale.aggregate([
    { $match: { date: { $gte: thirtyDaysAgo, $lte: latestDate } } },
    { $group: { _id: '$product', revenue: { $sum: '$revenue' }, units: { $sum: '$unitsSold' } } },
    { $sort: { revenue: -1 } }
  ]);

  const topProducts = [];
  if (recentProductSales.length > 0) {
    const topRevenueProd = recentProductSales[0];
    const portfolioShare = recentTotal > 0 ? (topRevenueProd.revenue / recentTotal) * 100 : 0;
    topProducts.push({
      title: 'Top Product',
      text: `**${topRevenueProd._id}** made **${formatCurrency(topRevenueProd.revenue)}** (**${portfolioShare.toFixed(1)}%** of sales). It is our best-selling product.`,
      status: 'green',
      highlight: topRevenueProd._id
    });

    // Top units sold product
    const unitSorted = [...recentProductSales].sort((a, b) => b.units - a.units);
    const topUnitsProd = unitSorted[0];
    topProducts.push({
      title: 'Top Shipped Packs',
      text: `**${topUnitsProd._id}** shipped **${formatNumber(topUnitsProd.units)} packs**. Sales are strong.`,
      status: 'green',
      highlight: topUnitsProd._id
    });
  } else {
    topProducts.push({
      title: 'Top Product',
      text: 'No product sales recorded in this period.',
      status: 'yellow',
      highlight: 'N/A'
    });
  }

  // --- 3. WEAK TERRITORIES SECTION ---
  const regionSales = await Sale.aggregate([
    { $match: { date: { $gte: thirtyDaysAgo, $lte: latestDate } } },
    { $group: { _id: '$region', revenue: { $sum: '$revenue' } } },
    { $sort: { revenue: 1 } } // ascending, first is lowest
  ]);

  const weakTerritories = [];
  if (regionSales.length > 0) {
    const weakestReg = regionSales[0];
    const regionalShare = recentTotal > 0 ? (weakestReg.revenue / recentTotal) * 100 : 0;
    weakTerritories.push({
      title: 'Weak Region',
      text: `The **${weakestReg._id}** region has low sales. It made **${formatCurrency(weakestReg.revenue)}** (**${regionalShare.toFixed(1)}%** of sales).`,
      status: 'red',
      highlight: weakestReg._id
    });

    if (regionSales.length > 1) {
      const secondWeakestReg = regionSales[1];
      const secondShare = recentTotal > 0 ? (secondWeakestReg.revenue / recentTotal) * 100 : 0;
      weakTerritories.push({
        title: 'Secondary Weak Region',
        text: `The **${secondWeakestReg._id}** region has flat growth. It made **${formatCurrency(secondWeakestReg.revenue)}** (**${secondShare.toFixed(1)}%** of sales).`,
        status: 'yellow',
        highlight: secondWeakestReg._id
      });
    }
  } else {
    weakTerritories.push({
      title: 'Weak Region',
      text: 'No regional sales data available.',
      status: 'yellow',
      highlight: 'N/A'
    });
  }

  // --- 4. DECLINING PRODUCTS SECTION ---
  const previousProductSales = await Sale.aggregate([
    { $match: { date: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } } },
    { $group: { _id: '$product', revenue: { $sum: '$revenue' } } }
  ]);

  const productDecline = [];
  const recentProdMap = new Map(recentProductSales.map(item => [item._id, item.revenue]));

  previousProductSales.forEach(item => {
    const prevRevenue = item.revenue;
    const recentRevenue = recentProdMap.get(item._id) || 0;
    const dropAmount = prevRevenue - recentRevenue;
    
    if (dropAmount > 0 && prevRevenue > 0) {
      const dropPercentage = (dropAmount / prevRevenue) * 100;
      productDecline.push({
        product: item._id,
        dropAmount,
        dropPercentage
      });
    }
  });

  productDecline.sort((a, b) => b.dropAmount - a.dropAmount);

  const decliningProducts = [];
  if (productDecline.length > 0) {
    const worstDecline = productDecline[0];
    const statusLevel = worstDecline.dropPercentage > 15 ? 'red' : 'yellow';
    decliningProducts.push({
      title: 'Sales Drop',
      text: `**${worstDecline.product}** sales dropped by **${worstDecline.dropPercentage.toFixed(1)}%**. This is a loss of **${formatCurrency(worstDecline.dropAmount)}**.`,
      status: statusLevel,
      highlight: worstDecline.product
    });

    if (productDecline.length > 1) {
      const secondDecline = productDecline[1];
      decliningProducts.push({
        title: 'Other Sales Drop',
        text: `**${secondDecline.product}** sales fell by **${secondDecline.dropPercentage.toFixed(1)}%**. This is a slight drop.`,
        status: 'yellow',
        highlight: secondDecline.product
      });
    } else {
      decliningProducts.push({
        title: 'Other Sales Drop',
        text: 'All other products have stable sales.',
        status: 'green',
        highlight: 'Stable'
      });
    }
  } else {
    decliningProducts.push({
      title: 'Sales Drop',
      text: 'All product lines have stable or growing sales.',
      status: 'green',
      highlight: 'Stable'
    });
  }

  // --- 5. RECOMMENDATIONS SECTION ---
  const recommendations = [];

  // Recommended Action
  if (productDecline.length > 0 && productDecline[0].dropPercentage > 15) {
    recommendations.push({
      title: 'Recommended Action',
      text: `Start promotions for **${productDecline[0].product}** to stop the **${productDecline[0].dropPercentage.toFixed(1)}%** drop.`,
      status: 'red',
      highlight: 'Promotional Push'
    });
  } else if (regionSales.length > 0) {
    recommendations.push({
      title: 'Recommended Action',
      text: `Check stock levels in the **${regionSales[0]._id}** region.`,
      status: 'red',
      highlight: 'Supply Check'
    });
  } else {
    recommendations.push({
      title: 'Recommended Action',
      text: 'Keep the current sales plan. Check for new sales updates.',
      status: 'green',
      highlight: 'Maintain Status'
    });
  }

  // Sales Strategy
  if (recentProductSales.length > 0 && regionSales.length > 0) {
    const topRevenueProd = recentProductSales[0];
    const weakestReg = regionSales[0]._id;
    recommendations.push({
      title: 'Sales Strategy',
      text: `Offer discounts for **${topRevenueProd._id}** in the **${weakestReg}** region.`,
      status: 'yellow',
      highlight: 'Expand Reach'
    });
  } else {
    recommendations.push({
      title: 'Sales Strategy',
      text: 'Look into expanding product categories as we get more data.',
      status: 'green',
      highlight: 'Scale Strategy'
    });
  }

  return {
    executiveSummary: execSummary,
    topProducts,
    weakTerritories,
    decliningProducts,
    recommendations
  };
};
