/**
 * Helper to check if Gemini API key is configured.
 */
const isConfigured = () => {
  return !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'placeholder' && process.env.GEMINI_API_KEY.trim() !== '';
};

/**
 * Generates structured business insights from raw sales data using Google Gemini API.
 * @param {Object} analyticsData - The aggregated sales data.
 * @returns {Promise<Object>} The structured insights matching the frontend requirements.
 */
const generateInsightsFromData = async (analyticsData) => {
  if (!isConfigured()) {
    throw new Error('Gemini API key is not configured.');
  }

  const model = "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `
You are a senior pharmaceutical sales analyst. Your job is to analyze the following sales performance dataset and write professional, structured business insights for executives and pharmacy owners.

### Sales Performance Indicators (JSON):
${JSON.stringify(analyticsData, null, 2)}

### Writing Guidelines (CRITICAL):
1. Write in clear, professional English suitable for pharmaceutical business executives.
2. Avoid all corporate buzzwords like "velocity", "spearheaded", "portfolio leadership", "contraction", "optimization".
3. DO NOT simply repeat raw numbers, revenue values, or percentages from the dataset. Focus instead on qualitative business drivers (e.g., physician prescribing patterns, regional distributor networks, localized marketing campaigns, stock availability, and competitor actions). Stating numbers is not analysis!
4. Specifically, for the "reason", "observation", "suggestion", "recommendation", and "executiveSummary" fields, DO NOT start or fill sentences by quoting the KPI revenue values or growth percentages. The numbers are already rendered separately in the UI. Provide strategic interpretations and qualitative explanations.
5. Keep paragraphs and descriptions concise, clear, and business-focused.

### Output Requirements:
1. Return a single JSON object containing exactly these five keys: "executiveSummary", "productAnalysis", "territoryAnalysis", "trendAnalysis", and "recommendations". Do not include any other top-level keys.
2. The JSON schema must match exactly the following structure:
   {
     "executiveSummary": (String) A concise 2-3 sentence overview of business performance (e.g. comparing month-over-month sales, top product drivers, and region highlights).
     "productAnalysis": {
       "topProduct": {
         "productName": (String) Name of top-selling product by revenue,
         "revenue": (String) Total revenue and percentage of portfolio (e.g. "₹2.67L (45.3%)"),
         "reason": (String) Explaining the business reason for strong performance,
         "recommendation": (String) Sales strategy or stock plan going forward
       },
       "moderateProduct": {
         "productName": (String) Name of moderate performing product,
         "revenue": (String) Total revenue and percentage of portfolio,
         "reason": (String) Explaining why performance is moderate,
         "suggestion": (String) Actionable suggestion to boost growth
       },
       "weakProduct": {
         "productName": (String) Name of lowest performing product,
         "revenue": (String) Total revenue and percentage of portfolio,
         "reason": (String) Explaining why performance is lagging,
         "suggestion": (String) Actionable suggestion to improve performance or clear stock
       }
     },
     "territoryAnalysis": {
       "strongTerritory": {
         "territoryName": (String) Name of strongest region/territory by revenue,
         "revenue": (String) Total revenue and regional contribution percentage (e.g. "₹3.5L (59.1%)"),
         "observation": (String) High-level business observation of this market,
         "recommendation": (String) Maintenance or expansion strategy
       },
       "moderateTerritory": {
         "territoryName": (String) Name of moderate region/territory,
         "revenue": (String) Total revenue and regional contribution,
         "observation": (String) Observation of market conditions,
         "recommendation": (String) Growth or partnership strategy to drive sales
       },
       "weakTerritory": {
         "territoryName": (String) Name of weakest region/territory,
         "revenue": (String) Total revenue and regional contribution,
         "observation": (String) Observation of why sales are lagging,
         "recommendation": (String) Recovery plan or clinical sales rep realignment strategy
       }
     },
     "trendAnalysis": {
       "previousMonthRevenue": (String) Formatted revenue of previous month (e.g. "₹6.68L"),
       "currentMonthRevenue": (String) Formatted revenue of current month (e.g. "₹5.92L"),
       "growthPercentage": (String) Formatted growth or decline percentage with prefix (e.g. "+15.0%" or "-11.3%"),
       "insight": (String) Concise interpretation of monthly sales movement and growth indicators (e.g. "Revenue recovered strongly in June after a decline in May, indicating positive business growth.").
     },
     "recommendations": [
       (String) Actionable suggestion 1,
       (String) Actionable suggestion 2,
       (String) Actionable suggestion 3,
       (String) Actionable suggestion 4,
       (String) Actionable suggestion 5 (Generate exactly 4-5 flat bullet-point strings)
     ]
   }
3. Format currency figures in Indian Rupees (INR) using Lakhs/Crores if large (e.g. "₹12.5L" or "₹1.5Cr" or standard "₹50,000").

Generate the JSON response matching the specifications above. Return ONLY the raw JSON string. Do NOT enclose in markdown block ticks.
`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: prompt
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const timeoutDuration = 20000; // 20 seconds timeout

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let status = response.status;
        let message = errorText;
        try {
          const errJson = JSON.parse(errorText);
          if (errJson.error) {
            message = errJson.error.message || errorText;
          }
        } catch (_) {}
        
        const error = new Error(`Gemini API returned status ${status}: ${message}`);
        error.status = status;
        throw error;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned an empty response.');
      }

      // Try parsing the response as JSON
      const parsedData = JSON.parse(text.trim());
      
      // Schema validation
      const requiredKeys = ['executiveSummary', 'productAnalysis', 'territoryAnalysis', 'trendAnalysis', 'recommendations'];
      for (const key of requiredKeys) {
        if (!parsedData[key]) {
          throw new Error(`Invalid response schema: missing top-level key "${key}"`);
        }
      }
      
      // Validate nested structures
      const pKeys = ['topProduct', 'moderateProduct', 'weakProduct'];
      for (const pk of pKeys) {
        const prod = parsedData.productAnalysis[pk];
        if (!prod || !prod.productName || !prod.revenue || !prod.reason || !(prod.recommendation || prod.suggestion)) {
          throw new Error(`Invalid productAnalysis structure for key "${pk}"`);
        }
      }

      const tKeys = ['strongTerritory', 'moderateTerritory', 'weakTerritory'];
      for (const tk of tKeys) {
        const terr = parsedData.territoryAnalysis[tk];
        if (!terr || !terr.territoryName || !terr.revenue || !terr.observation || !terr.recommendation) {
          throw new Error(`Invalid territoryAnalysis structure for key "${tk}"`);
        }
      }

      const trend = parsedData.trendAnalysis;
      if (!trend || !trend.previousMonthRevenue || !trend.currentMonthRevenue || !trend.growthPercentage || !trend.insight) {
        throw new Error(`Invalid trendAnalysis structure`);
      }

      if (!Array.isArray(parsedData.recommendations) || parsedData.recommendations.length < 3) {
        throw new Error(`Invalid recommendations structure`);
      }

      return parsedData;
    } catch (err) {
      clearTimeout(timeoutId);
      
      let errorMsg = err.message;
      let status = err.status || 500;
      let isTimeout = false;

      if (err.name === 'AbortError') {
        errorMsg = `Gemini API request timed out after 20 seconds.`;
        isTimeout = true;
        status = 503; // Treat timeout as 503 for retry eligibility
      }

      // Log detailed error ONLY on the backend
      console.error(`[Gemini API] Attempt ${attempt} failed. Status: ${status}. Detail: ${errorMsg}`);

      // Determine retry eligibility
      let shouldRetry = false;
      if (status === 503 || isTimeout || status === 408) {
        shouldRetry = true;
      }

      // For eligible errors, retry up to 2 times (3 attempts total: 1 initial + 2 retries)
      // For non-eligible errors (429, 401, 403, etc.), stop immediately (1 attempt total)
      const maxAttempts = shouldRetry ? 3 : 1;

      if (attempt >= maxAttempts) {
        throw err;
      }

      const backoffs = [2000, 4000];
      const delay = backoffs[attempt - 1] || 2000;
      console.log(`[Gemini API] Retrying in ${delay}ms due to status ${status}...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

module.exports = {
  isConfigured,
  generateInsightsFromData
};
