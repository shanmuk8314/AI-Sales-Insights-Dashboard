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

  const model = "gemini-flash-latest";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const prompt = `
You are a pharmaceutical sales manager explaining sales results to pharmacy owners and sales managers. Your job is to analyze the following sales performance dataset and write simple, direct business insights.

### Sales Performance Indicators (JSON):
${JSON.stringify(analyticsData, null, 2)}

### Writing Guidelines (CRITICAL):
1. Write in plain, simple English suitable for non-technical users.
2. Use short, direct sentences. Write a maximum of 2 sentences per card.
3. Avoid all corporate jargon, technical terms, complex words, and any formatting characters. 
4. DO NOT use the words: "velocity", "spearheaded", "intervention", "portfolio leadership", "contraction", "optimization".
5. Write direct statements. For example:
   - Instead of "Revenue velocity increased significantly", write "Sales increased by 106.6% compared to last month."
   - Instead of "The West territory is underperforming", write "Sales in the West region are lower than other regions and need attention."
   - Instead of "Immediate intervention is required", write "This region needs attention."
   - Instead of "Portfolio leadership is spearheaded by CardioVit", write "CardioVit is the best-selling product."
6. Explain insights like talking to a pharmacy owner, not a data scientist.
7. In the "weakTerritories" section, avoid repeating the same information (e.g., do NOT repeat "West region is the slowest region" and "The West region has low sales"). Keep each observation unique and distinct.
8. DO NOT write long paragraphs. Keep each card text under 20-25 words.

### Output Requirements:
1. Return a single JSON object containing exactly these five keys: "executiveSummary", "topProducts", "weakTerritories", "decliningProducts", and "recommendations". Do not include any other top-level keys.
2. Each key must point to an array of objects. Each object in these arrays MUST have the following schema:
   - "title": (String) A short card title (e.g., "Revenue", "Top Product", "Weak Region", "Sales Drop", "Action Needed", "Sales Strategy").
   - "text": (String) Exactly ONE concise, jargon-free explanation or action. The text MUST be under 20-25 words (maximum 2 lines of text when rendered). Do NOT use any markdown formatting, asterisks (**), or bullet points. Write only clean, plain text.
   - "status": (String) Must be either "green" (positive performance/low risk), "yellow" (moderate concern/stable), or "red" (high priority issue/severe decline).
   - "highlight": (String) A short focus label (1-3 words max, e.g., product name, region name, percentage change, or category) that represents the core focal point of the card. Do NOT use markdown.
3. Format currency figures in Indian Rupees (INR) using Lakhs/Crores if large, or standard formatting (e.g., "₹50,000" or "₹12.5L" or "₹1.5Cr").
4. Content specific rules:
   - "executiveSummary": Generate 2 cards (typically "Revenue" and "Total Invoices").
   - "topProducts": Generate 2 cards (typically "Top Product" and "Top Shipped Packs").
   - "weakTerritories": Generate 1-2 cards (typically "Weak Region" and "Secondary Weak Region"). Ensure unique details for each.
   - "decliningProducts": Generate 1-2 cards highlighting sales drops or product volume slides.
   - "recommendations": Generate 2 cards (typically "Recommended Action" and "Sales Strategy") outlining concrete recommended actions based on the weak regions or declining products identified.

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

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
      throw new Error(`Gemini API returned status ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini API returned an empty response.');
    }

    // Try parsing the response as JSON
    const parsedData = JSON.parse(text.trim());
    
    // Simple schema validation
    const keys = ['executiveSummary', 'topProducts', 'weakTerritories', 'decliningProducts', 'recommendations'];
    for (const key of keys) {
      if (!parsedData[key] || !Array.isArray(parsedData[key])) {
        throw new Error(`Invalid response schema: missing or invalid key "${key}"`);
      }
      for (const item of parsedData[key]) {
        if (!item.title || !item.text || !item.status || !item.highlight) {
          throw new Error(`Invalid item in "${key}": missing required fields (title, text, status, highlight)`);
        }
      }
    }

    return parsedData;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Gemini API request timed out after 8 seconds.');
    }
    console.error('Error in geminiService:', err);
    throw err;
  }
};

module.exports = {
  isConfigured,
  generateInsightsFromData
};
