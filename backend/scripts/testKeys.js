const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../config/postgres');

async function test() {
  try {
    const res = await pool.query('SELECT sale_date, product, region, units_sold, revenue FROM sales LIMIT 5');
    const makeKey = (date, product, region, unitsSold, revenue) => {
      const d = new Date(date);
      const time = isNaN(d.getTime()) ? 0 : d.getTime();
      return `${time}_${product.trim().toLowerCase()}_${region.trim().toLowerCase()}_${unitsSold}_${parseFloat(revenue).toFixed(2)}`;
    };

    console.log('Database Keys:');
    res.rows.forEach(row => {
      console.log('Raw Row Date:', row.sale_date, typeof row.sale_date);
      const key = makeKey(row.sale_date, row.product, row.region, row.units_sold, row.revenue);
      console.log('Key:', key);
    });

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

test();
