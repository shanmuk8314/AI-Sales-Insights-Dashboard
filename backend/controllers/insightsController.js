const insightsService = require('../services/insightsService');

exports.generateInsights = async (req, res) => {
  try {
    const insights = await insightsService.generateSalesInsights();
    
    return res.status(200).json({
      success: true,
      insights
    });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to generate insights.', 
      error: error.message 
    });
  }
};
