import { jsPDF } from 'jspdf';
import axios from 'axios';
import { API_URL } from '../config/api';
import { toast } from 'react-hot-toast';

const formatCurrency = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val);
};

const formatPercent = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0.0%';
  const prefix = val >= 0 ? '+' : '';
  return `${prefix}${val.toFixed(1)}%`;
};

const formatNumber = (val) => {
  if (val === undefined || val === null || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-IN').format(val);
};

export const exportPdfReport = async (filters = {}) => {
  try {
    // 1. Fetch latest dashboard data and AI insights in parallel using the active filters
    const queryParams = new URLSearchParams();
    if (filters.region && filters.region !== 'All') queryParams.append('region', filters.region);
    if (filters.product && filters.product !== 'All') queryParams.append('product', filters.product);
    if (filters.month && filters.month !== 'All') queryParams.append('month', filters.month);

    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const [dbRes, aiRes] = await Promise.all([
      axios.get(`${API_URL}/api/dashboard${queryString}`),
      axios.get(`${API_URL}/api/ai-insights${queryString}`)
    ]);

    const dashboardData = dbRes.data.success ? dbRes.data : null;
    const aiData = aiRes.data.success && aiRes.data.insights ? aiRes.data.insights : null;

    if (!dashboardData) {
      throw new Error('Failed to retrieve sales data for PDF export.');
    }

    const kpis = dashboardData.kpis || {};
    
    // 2. Initialize jsPDF (A4, vertical, mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageW = 210;
    const pageH = 297;
    const margin = 15;
    const usableW = pageW - 2 * margin;

    // 3. Draw Background (#0b0f19)
    doc.setFillColor(11, 15, 25);
    doc.rect(0, 0, pageW, pageH, 'F');

    // 4. Header Banner
    // Company Title (indigo accent #818cf8)
    doc.setFontSize(13);
    doc.setTextColor(129, 140, 248);
    doc.setFont('helvetica', 'bold');
    doc.text('MEDIWAVE LIFE SCIENCES', margin, margin + 4);

    // Title
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('AI SALES PERFORMANCE REPORT', margin, margin + 12);

    // Subheader details
    const today = new Date();
    const pad = (num) => String(num).padStart(2, '0');
    const formattedDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // #94a3b8
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated Date: ${formattedDate}`, margin, margin + 18);

    // Filters text
    const filterText = `Filters: Region: ${filters.region || 'All'} | Product: ${filters.product || 'All'} | Month: ${filters.month || 'All'}`;
    doc.text(filterText, margin + 80, margin + 18);

    // Divider Line
    doc.setDrawColor(30, 41, 59); // #1e293b
    doc.setLineWidth(0.5);
    doc.line(margin, margin + 22, margin + usableW, margin + 22);

    // 5. KPI Cards Grid (2 rows x 3 columns)
    const cardH = 22;
    const cardW = (usableW - 8) / 3;
    const gapX = 4;
    const gapY = 4;
    const startY = margin + 26;

    const drawKpiCard = (x, y, label, value, valueColor) => {
      // Card Container
      doc.setFillColor(30, 41, 59); // #1e293b
      doc.setDrawColor(51, 65, 85); // #334155
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

      // Card Label
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184); // #94a3b8
      doc.setFont('helvetica', 'bold');
      doc.text(label.toUpperCase(), x + 4, y + 6);

      // Card Value
      doc.setFontSize(10.5);
      doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
      doc.setFont('helvetica', 'bold');
      
      const textW = doc.getTextWidth(value);
      const displayVal = textW > cardW - 8 ? value.substring(0, 18) + '..' : value;
      doc.text(displayVal, x + 4, y + 15);
    };

    // Color definitions
    const green = [52, 211, 153];  // #34d399 (emerald)
    const rose = [248, 113, 113];  // #f87171 (rose)
    const white = [255, 255, 255];
    const indigo = [165, 180, 252]; // #a5b4fc

    // Row 1
    const revGrowthText = kpis.totalRevenueGrowth !== undefined ? formatPercent(kpis.totalRevenueGrowth) : '0.0%';
    const growthColor = (kpis.totalRevenueGrowth || 0) >= 0 ? green : rose;

    drawKpiCard(margin, startY, 'Total Revenue', formatCurrency(kpis.totalRevenue), green);
    drawKpiCard(margin + cardW + gapX, startY, 'Revenue Growth (MoM)', revGrowthText, growthColor);
    drawKpiCard(margin + 2 * (cardW + gapX), startY, 'Total Invoices', formatNumber(kpis.totalTransactions), white);

    // Row 2
    const topProdName = kpis.topProduct?.name || 'N/A';
    const weakProdName = kpis.weakProduct?.name || 'N/A';

    drawKpiCard(margin, startY + cardH + gapY, 'Total Units Sold', formatNumber(kpis.totalUnitsSold), white);
    drawKpiCard(margin + cardW + gapX, startY + cardH + gapY, 'Top Product', topProdName, indigo);
    drawKpiCard(margin + 2 * (cardW + gapX), startY + cardH + gapY, 'Weak Product', weakProdName, rose);

    // 6. Executive Summary Section
    const summaryY = startY + 2 * (cardH + gapY) + 4;
    const summaryH = 75;

    // Card Container
    doc.setFillColor(30, 41, 59); // #1e293b
    doc.setDrawColor(51, 65, 85); // #334155
    doc.roundedRect(margin, summaryY, usableW, summaryH, 2, 2, 'FD');

    // Title
    doc.setFontSize(10);
    doc.setTextColor(129, 140, 248); // #818cf8
    doc.setFont('helvetica', 'bold');
    doc.text('EXECUTIVE SUMMARY', margin + 6, summaryY + 7);

    // Text Content
    let summaryText = 'No summary analysis generated. Populate database sales records to trigger AI insights.';
    if (aiData && aiData.executiveSummary) {
      summaryText = aiData.executiveSummary;
    }

    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    
    // Split text with word-wrap
    const splitSummary = doc.splitTextToSize(summaryText, usableW - 12);
    let currentTextY = summaryY + 14;
    splitSummary.forEach(line => {
      if (currentTextY < summaryY + summaryH - 6) {
        doc.text(line, margin + 6, currentTextY);
        currentTextY += 5.5; // line height
      }
    });

    // 7. Business Recommendations Section
    const recY = summaryY + summaryH + 4;
    const recH = 100;

    // Card Container
    doc.setFillColor(30, 41, 59); // #1e293b
    doc.setDrawColor(51, 65, 85); // #334155
    doc.roundedRect(margin, recY, usableW, recH, 2, 2, 'FD');

    // Title
    doc.setFontSize(10);
    doc.setTextColor(129, 140, 248); // #818cf8
    doc.setFont('helvetica', 'bold');
    doc.text('STRATEGIC BUSINESS RECOMMENDATIONS', margin + 6, recY + 7);

    // Bullet points
    let recommendations = [
      'No recommendations available. Please upload a comprehensive sales CSV ledger.',
      'Ensure standard product margins are preserved across distribution territories.',
      'Audit lowest performing products and consider bundling strategies to boost stock clearance.'
    ];

    if (aiData && Array.isArray(aiData.recommendations) && aiData.recommendations.length > 0) {
      recommendations = aiData.recommendations;
    }

    let bulletY = recY + 15;
    recommendations.forEach((rec, index) => {
      if (bulletY < recY + recH - 8) {
        // Draw Bullet Indicator (Indigo circle)
        doc.setFillColor(129, 140, 248);
        doc.circle(margin + 8, bulletY - 1, 1, 'F');

        // Draw Recommendation text
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'normal');
        
        const splitRec = doc.splitTextToSize(rec, usableW - 18);
        splitRec.forEach(line => {
          if (bulletY < recY + recH - 6) {
            doc.text(line, margin + 14, bulletY);
            bulletY += 5.2; // line spacing inside bullet
          }
        });
        bulletY += 2; // spacing between bullets
      }
    });

    // 8. Footer
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // #64748b
    doc.setFont('helvetica', 'italic');
    doc.text('Confidential - Internal Pharma Sales Strategy Report', margin, pageH - margin);
    doc.text('Powered by Mediwave Life Sciences Dashboard', pageW - margin - 65, pageH - margin);

    // 9. Download the PDF
    const downloadDate = formattedDate.replace(/-/g, '_');
    doc.save(`AI_Sales_Report_${downloadDate}.pdf`);

  } catch (error) {
    console.error('PDF generation failed:', error);
    toast.error('Failed to generate PDF Report: ' + error.message);
  }
};
