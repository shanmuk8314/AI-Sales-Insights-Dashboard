const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../config/postgres');

const migrate = async () => {
  try {
    console.log('Starting migration to Neon PostgreSQL...');

    // 1. Read and run schema.sql to ensure tables exist
    const schemaSqlPath = path.join(__dirname, '../config/schema.sql');
    if (!fs.existsSync(schemaSqlPath)) {
      throw new Error(`Schema file not found at ${schemaSqlPath}`);
    }
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
    console.log('Creating database schema if it does not exist...');
    await pool.query(schemaSql);
    console.log('Schema synchronized successfully.');

    // 2. Clear existing records to ensure idempotent fresh migration
    console.log('Clearing existing records in sales and upload_history tables...');
    await pool.query('TRUNCATE TABLE sales, upload_history RESTART IDENTITY CASCADE');

    // 3. Load local JSON data
    const salesDbPath = path.join(__dirname, '../uploads/sales_db.json');
    const uploadHistoryPath = path.join(__dirname, '../uploads/upload_history.json');

    const salesJson = fs.existsSync(salesDbPath) ? JSON.parse(fs.readFileSync(salesDbPath, 'utf8')) : [];
    const uploadHistoryJson = fs.existsSync(uploadHistoryPath) ? JSON.parse(fs.readFileSync(uploadHistoryPath, 'utf8')) : [];

    console.log(`Loaded ${salesJson.length} sales and ${uploadHistoryJson.length} upload history records from JSON.`);

    // 4. Migrate Upload History
    console.log('Migrating upload history...');
    for (const upload of uploadHistoryJson) {
      const query = `
        INSERT INTO upload_history (file_name, timestamp, records_count, revenue, upload_id, summary, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
      await pool.query(query, [
        upload.fileName,
        new Date(upload.timestamp),
        upload.recordsCount,
        upload.revenue,
        upload.uploadId,
        JSON.stringify(upload.summary),
        upload.createdAt ? new Date(upload.createdAt) : new Date(upload.timestamp)
      ]);
    }
    console.log('Upload history migrated successfully.');

    // 5. Migrate Sales using batch insertions
    console.log('Migrating sales data...');
    const batchSize = 100;
    for (let i = 0; i < salesJson.length; i += batchSize) {
      const batch = salesJson.slice(i, i + batchSize);
      const values = [];
      const valuePlaceholders = [];
      let paramIndex = 1;

      for (const sale of batch) {
        values.push(
          new Date(sale.date),
          sale.product,
          sale.category,
          sale.region,
          sale.unitsSold,
          sale.unitPrice,
          sale.revenue || (sale.unitsSold * sale.unitPrice),
          sale.uploadId,
          sale.createdAt ? new Date(sale.createdAt) : new Date(sale.date)
        );
        valuePlaceholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8})`);
        paramIndex += 9;
      }

      const query = `
        INSERT INTO sales (sale_date, product, category, region, units_sold, unit_price, revenue, upload_id, created_at)
        VALUES ${valuePlaceholders.join(', ')}
      `;
      await pool.query(query, values);
    }
    console.log('Sales data migrated successfully.');

    // 6. Compare and validate counts
    const salesCountRes = await pool.query('SELECT COUNT(*) FROM sales');
    const uploadHistoryCountRes = await pool.query('SELECT COUNT(*) FROM upload_history');

    const pgSalesCount = parseInt(salesCountRes.rows[0].count, 10);
    const pgUploadHistoryCount = parseInt(uploadHistoryCountRes.rows[0].count, 10);

    const jsonSalesCount = salesJson.length;
    const jsonUploadHistoryCount = uploadHistoryJson.length;

    console.log('\n--- Migration Validation Report ---');
    console.log(`Sales Record Count: JSON = ${jsonSalesCount} | PostgreSQL = ${pgSalesCount}`);
    console.log(`Upload History Record Count: JSON = ${jsonUploadHistoryCount} | PostgreSQL = ${pgUploadHistoryCount}`);

    if (jsonSalesCount !== pgSalesCount || jsonUploadHistoryCount !== pgUploadHistoryCount) {
      console.error('Validation FAILED: Record counts do not match!');
      process.exit(1);
    } else {
      console.log('Validation SUCCESS: Record counts match perfectly!\n');
    }

  } catch (error) {
    console.error('Migration failed with error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

migrate();
