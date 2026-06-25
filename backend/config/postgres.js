const { Pool } = require('pg');

const rawPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

rawPool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

let isConnected = false;
let lastAttempt = 0;
const COOLDOWN_MS = 30000; // 30 seconds cooldown after connection failure

const testConnection = async () => {
  try {
    lastAttempt = Date.now();
    const res = await rawPool.query('SELECT NOW()');
    console.log(`PostgreSQL Connected: ${res.rows[0].now}`);
    isConnected = true;
    return true;
  } catch (error) {
    console.error(`PostgreSQL Connection Error: ${error.message}`);
    isConnected = false;
    return false;
  }
};

// Intercept queries with a proxy to avoid repeated connection delays when DB is down
const poolProxy = new Proxy(rawPool, {
  get(target, prop) {
    if (prop === 'query') {
      return async function(text, params) {
        if (!isConnected && (Date.now() - lastAttempt < COOLDOWN_MS)) {
          throw new Error('PostgreSQL is offline (cooldown active)');
        }
        try {
          lastAttempt = Date.now();
          const res = await target.query(text, params);
          if (!isConnected) {
            console.log('PostgreSQL connection restored.');
            isConnected = true;
          }
          return res;
        } catch (err) {
          if (isConnected) {
            console.error(`PostgreSQL connection lost: ${err.message}`);
            isConnected = false;
          }
          throw err;
        }
      };
    }
    // Bind functions to avoid 'this' context issues
    const value = target[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

module.exports = {
  pool: poolProxy,
  testConnection
};
