const { pool } = require('../config/postgres');

const salesRepository = {
  /**
   * Retrieve all sales transactions, sorted by sale_date descending.
   */
  async getAllSales() {
    const res = await pool.query('SELECT * FROM sales ORDER BY sale_date DESC');
    return res.rows.map(row => ({
      id: row.id,
      date: row.sale_date,
      product: row.product,
      category: row.category,
      region: row.region,
      unitsSold: row.units_sold,
      unitPrice: parseFloat(row.unit_price),
      revenue: parseFloat(row.revenue),
      uploadId: row.upload_id,
      createdAt: row.created_at
    }));
  },

  /**
   * Retrieve sales aggregated by region, or detailed sales filtered by a specific region.
   */
  async getSalesByRegion(region = null) {
    if (region) {
      const res = await pool.query('SELECT * FROM sales WHERE region = $1 ORDER BY sale_date DESC', [region]);
      return res.rows.map(row => ({
        id: row.id,
        date: row.sale_date,
        product: row.product,
        category: row.category,
        region: row.region,
        unitsSold: row.units_sold,
        unitPrice: parseFloat(row.unit_price),
        revenue: parseFloat(row.revenue),
        uploadId: row.upload_id,
        createdAt: row.created_at
      }));
    } else {
      const res = await pool.query('SELECT region, SUM(revenue) as revenue, SUM(units_sold) as units_sold FROM sales GROUP BY region ORDER BY revenue DESC');
      return res.rows.map(row => ({
        region: row.region,
        revenue: parseFloat(row.revenue),
        unitsSold: parseInt(row.units_sold, 10)
      }));
    }
  },

  /**
   * Retrieve sales aggregated by category, or detailed sales filtered by a specific category.
   */
  async getSalesByCategory(category = null) {
    if (category) {
      const res = await pool.query('SELECT * FROM sales WHERE category = $1 ORDER BY sale_date DESC', [category]);
      return res.rows.map(row => ({
        id: row.id,
        date: row.sale_date,
        product: row.product,
        category: row.category,
        region: row.region,
        unitsSold: row.units_sold,
        unitPrice: parseFloat(row.unit_price),
        revenue: parseFloat(row.revenue),
        uploadId: row.upload_id,
        createdAt: row.created_at
      }));
    } else {
      const res = await pool.query('SELECT category, SUM(revenue) as revenue, SUM(units_sold) as units_sold FROM sales GROUP BY category ORDER BY revenue DESC');
      return res.rows.map(row => ({
        category: row.category,
        revenue: parseFloat(row.revenue),
        unitsSold: parseInt(row.units_sold, 10)
      }));
    }
  },

  /**
   * Retrieve high-level revenue summary KPI metrics.
   */
  async getRevenueSummary() {
    const res = await pool.query('SELECT COALESCE(SUM(revenue), 0) as total_revenue, COALESCE(SUM(units_sold), 0) as total_units_sold, COUNT(*) as total_transactions FROM sales');
    const row = res.rows[0];
    return {
      totalRevenue: parseFloat(row.total_revenue),
      totalUnitsSold: parseInt(row.total_units_sold, 10),
      totalTransactions: parseInt(row.total_transactions, 10)
    };
  },

  /**
   * Retrieve upload history logs, sorted by timestamp descending.
   */
  async getUploadHistory() {
    const res = await pool.query('SELECT * FROM upload_history ORDER BY timestamp DESC');
    return res.rows.map(row => ({
      id: row.id,
      fileName: row.file_name,
      timestamp: row.timestamp,
      recordsCount: row.records_count,
      revenue: parseFloat(row.revenue),
      uploadId: row.upload_id,
      summary: row.summary,
      createdAt: row.created_at
    }));
  }
};

module.exports = salesRepository;
