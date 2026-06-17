const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`PostgreSQL Connected: ${res.rows[0].now}`);
    return true;
  } catch (error) {
    console.error(`PostgreSQL Connection Error: ${error.message}`);
    return false;
  }
};

module.exports = {
  pool,
  testConnection
};
