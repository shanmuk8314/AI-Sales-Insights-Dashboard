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
You are an experienced sales manager explaining sales performance to a business owner with basic English knowledge.
Analyze the following sales dataset and write simple, structured insights.

### Sales Dataset (JSON):
${JSON.stringify(analyticsData, null, 2)}

### WRITING RULES (CRITICAL):
1. Use simple English. Write naturally, as if speaking to a person.
2. Use short sentences. Maximum 15–20 words per sentence.
3. Do NOT use business jargon or technical AI language.
4. Do NOT use any of these forbidden words:
   - leverage
   - optimize
   - facilitate
   - strategic
   - robust
   - sophisticated
   - comprehensive
   - trajectory
   - penetration
   - maximize
   - substantial
   - utilization
   - implementation
5. Instead, use simple words like:
   - increase
   - improve
   - sell
   - buy
   - check
   - review
   - keep
   - grow
   - support
   - focus
6. Do NOT simply repeat raw numbers or percentages from the dataset. Focus on the simple business reasons. Do NOT start or fill sentences by quoting the exact revenue values or growth percentages because they are already shown elsewhere.

### Writing Examples:
- Instead of "Revenue demonstrated positive month-over-month trajectory." -> Write "Sales increased compared to last month."
- Instead of "Optimize inventory." -> Write "Keep enough stock."
- Instead of "Expand distribution network." -> Write "Add more dealers."
- Instead of "This territory has weak market penetration." -> Write "Sales are low in this region."

Every field in the response ("executiveSummary", all "reason", "suggestion", "recommendation", and "observation" fields in "productAnalysis" and "territoryAnalysis", the "insight" in "trendAnalysis", and all items in "recommendations") MUST follow this writing style.

### Output Requirements:
1. Return a single JSON object containing exactly these five keys: "executiveSummary", "productAnalysis", "territoryAnalysis", "trendAnalysis", and "recommendations". Do not include any other top-level keys.
2. The JSON schema must match exactly the following structure:
   {
     "executiveSummary": (String) A concise 2-3 sentence overview of business performance using the simple style.
     "productAnalysis": {
       "topProduct": {
         "productName": (String) Name of top-selling product,
         "revenue": (String) Total revenue and percentage of portfolio (e.g. "₹2.67L (45.3%)"),
         "reason": (String) Simple explanation of why it sold well,
         "recommendation": (String) Simple strategy for stock or sales going forward
       },
       "moderateProduct": {
         "productName": (String) Name of moderate performing product,
         "revenue": (String) Total revenue and percentage of portfolio,
         "reason": (String) Simple explanation of why it sold okay,
         "suggestion": (String) Simple idea to sell more of this product
       },
       "weakProduct": {
         "productName": (String) Name of lowest performing product,
         "revenue": (String) Total revenue and percentage of portfolio,
         "reason": (String) Simple explanation of why it sold poorly,
         "suggestion": (String) Simple idea to clear stock or sell more
       }
     },
     "territoryAnalysis": {
       "strongTerritory": {
         "territoryName": (String) Name of strongest region by revenue,
         "revenue": (String) Total revenue and regional contribution percentage (e.g. "₹3.5L (59.1%)"),
         "observation": (String) Simple observation about this region,
         "recommendation": (String) Simple plan to keep sales high here
       },
       "moderateTerritory": {
         "territoryName": (String) Name of moderate region,
         "revenue": (String) Total revenue and regional contribution,
         "observation": (String) Simple observation about this region,
         "recommendation": (String) Simple plan to grow sales in this region
       },
       "weakTerritory": {
         "territoryName": (String) Name of weakest region,
         "revenue": (String) Total revenue and regional contribution,
         "observation": (String) Simple explanation of why sales are low here,
         "recommendation": (String) Simple plan to help sales grow here
       }
     },
     "trendAnalysis": {
       "previousMonthRevenue": (String) Formatted revenue of previous month (e.g. "₹6.68L"),
       "currentMonthRevenue": (String) Formatted revenue of current month (e.g. "₹5.92L"),
       "growthPercentage": (String) Formatted growth or decline percentage with prefix (e.g. "+15.0%" or "-11.3%"),
       "insight": (String) Simple explanation of monthly sales movement and growth using the simple style.
     },
     "recommendations": [
       (String) Simple recommendation 1,
       (String) Simple recommendation 2,
       (String) Simple recommendation 3,
       (String) Simple recommendation 4,
       (String) Simple recommendation 5 (Generate exactly 4-5 simple flat bullet-point strings)
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

  const timeoutDuration = 15000; // 15 seconds timeout

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

      // Determine retry eligibility: Retry only for 503 or Network Timeout
      let shouldRetry = false;
      if (status === 503 || isTimeout || status === 408) {
        shouldRetry = true;
      } else if (err instanceof TypeError || err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        // Handle common network-level connection failures
        shouldRetry = true;
      }

      // Explicitly block retry for 429 (quota exceeded), 401 (unauthorized), and 403 (forbidden)
      if (status === 429 || status === 401 || status === 403) {
        shouldRetry = false;
      }

      // For eligible errors, retry up to 2 times (3 attempts total: 1 initial + 2 retries)
      // For non-eligible errors, stop immediately (1 attempt total)
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
