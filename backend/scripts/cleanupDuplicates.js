const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../config/postgres');

const cleanup = async () => {
  try {
    console.log('Connecting to PostgreSQL for duplicate cleanup...');

    // 1. Count duplicates before deleting
    const countQuery = `
      SELECT COUNT(*) as duplicate_count FROM (
        SELECT id, ROW_NUMBER() OVER (
          PARTITION BY sale_date, product, region, units_sold, revenue 
          ORDER BY id
        ) as rn
        FROM sales
      ) t
      WHERE t.rn > 1
    `;
    const countRes = await pool.query(countQuery);
    const duplicatesFound = parseInt(countRes.rows[0].duplicate_count, 10);
    console.log(`Duplicate records found: ${duplicatesFound}`);

    // 2. Perform the deletion
    let deletedCount = 0;
    if (duplicatesFound > 0) {
      const deleteQuery = `
        DELETE FROM sales WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (
              PARTITION BY sale_date, product, region, units_sold, revenue 
              ORDER BY id
            ) as rn
            FROM sales
          ) t
          WHERE t.rn > 1
        )
      `;
      const deleteRes = await pool.query(deleteQuery);
      deletedCount = deleteRes.rowCount;
      console.log(`Successfully deleted ${deletedCount} duplicate records.`);
    } else {
      console.log('No duplicates to delete.');
    }

    // 3. Get final record count
    const finalCountRes = await pool.query('SELECT COUNT(*) as final_count FROM sales');
    const finalCount = parseInt(finalCountRes.rows[0].final_count, 10);
    console.log(`Final sales record count in PostgreSQL: ${finalCount}`);

    // 4. Invalidate cache since database was modified
    await pool.query('DELETE FROM ai_insights_cache');
    console.log('AI Insights cache invalidated.');

    console.log('\n--- Cleanup Report ---');
    console.log(`Duplicate Count Found: ${duplicatesFound}`);
    console.log(`Records Removed: ${deletedCount}`);
    console.log(`Final Sales Count: ${finalCount}`);
    
  } catch (error) {
    console.error('Cleanup failed with error:', error.message);
  } finally {
    await pool.end();
  }
};

cleanup();
