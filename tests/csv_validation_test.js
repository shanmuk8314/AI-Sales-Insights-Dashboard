const fs = require('fs');
const path = require('path');
module.paths.push(path.join(__dirname, '../backend/node_modules'));
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { pool, testConnection } = require('../backend/config/postgres');
const { uploadCSV } = require('../backend/controllers/salesController');

const tempDir = path.join(__dirname, '../backend/uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Mock Express response object
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  return res;
};

// Create a temp file with content
const createTempFile = (fileName, content) => {
  const filePath = path.join(tempDir, fileName);
  fs.writeFileSync(filePath, content);
  return filePath;
};

async function runValidationTests() {
  console.log('--- STARTING CSV VALIDATION TESTS ---');
  await testConnection();
  try {
    await pool.query("DELETE FROM sales WHERE product = 'MediCure Beta'");
  } catch (err) {
    console.error('Failed to clean up validation test records:', err.message);
  }
  let passedCount = 0;
  let failedCount = 0;

  const testCases = [
    {
      name: 'Valid CSV file',
      content: 'Date,Product,Category,Region,UnitsSold,UnitPrice\n2026-05-01,MediCure Beta,Antibiotics,North,150,12.50\n',
      expectedStatus: 200,
      expectedMessageCheck: (msg) => true // we don't care about success message as long as it's 200
    },
    {
      name: 'Empty CSV file (0 bytes)',
      content: '',
      expectedStatus: 400,
      expectedMessageCheck: (msg) => msg && msg.includes('Empty CSV file')
    },
    {
      name: 'Missing columns: Category, UnitsSold',
      content: 'Date,Product,Region,UnitPrice\n2026-05-01,MediCure Beta,North,12.50\n',
      expectedStatus: 400,
      expectedMessageCheck: (msg) => msg && msg.includes('Missing columns: Category, UnitsSold')
    },
    {
      name: 'Duplicate headers',
      content: 'Date,Product,Category,Region,UnitsSold,UnitPrice,Product\n2026-05-01,MediCure Beta,Antibiotics,North,150,12.50,MediCure Beta\n',
      expectedStatus: 400,
      expectedMessageCheck: (msg) => msg && msg.includes('Duplicate header found')
    },
    {
      name: 'Negative UnitsSold',
      content: 'Date,Product,Category,Region,UnitsSold,UnitPrice\n2026-05-01,MediCure Beta,Antibiotics,North,-150,12.50\n',
      expectedStatus: 400,
      expectedMessageCheck: (msg) => msg && msg.includes('UnitsSold cannot be negative')
    },
    {
      name: 'Negative UnitPrice',
      content: 'Date,Product,Category,Region,UnitsSold,UnitPrice\n2026-05-01,MediCure Beta,Antibiotics,North,150,-12.50\n',
      expectedStatus: 400,
      expectedMessageCheck: (msg) => msg && msg.includes('UnitPrice cannot be negative')
    },
    {
      name: 'Invalid date',
      content: 'Date,Product,Category,Region,UnitsSold,UnitPrice\ninvalid-date,MediCure Beta,Antibiotics,North,150,12.50\n',
      expectedStatus: 400,
      expectedMessageCheck: (msg) => msg && msg.includes('Invalid date')
    }
  ];

  for (const tc of testCases) {
    const filePath = createTempFile(`test_${Date.now()}.csv`, tc.content);
    const req = {
      file: {
        path: filePath,
        originalname: path.basename(filePath)
      }
    };
    const res = mockResponse();

    try {
      // Run the controller function
      await uploadCSV(req, res);

      // Wait a little bit for stream completion
      await new Promise(resolve => setTimeout(resolve, 300));

      const status = res.statusCode || 200; // defaults to 200 if not set in mock
      const body = res.jsonData || {};

      const statusMatches = status === tc.expectedStatus;
      const msgMatches = tc.expectedMessageCheck(body.message);

      if (statusMatches && msgMatches) {
        console.log(`✔ [PASS] ${tc.name}`);
        passedCount++;
      } else {
        console.error(`✖ [FAIL] ${tc.name}: Expected status ${tc.expectedStatus}, got ${status}. Expected msg check to pass, got message: "${body.message}"`);
        failedCount++;
      }
    } catch (err) {
      console.error(`✖ [ERROR] ${tc.name} threw error:`, err);
      failedCount++;
    } finally {
      // Clean up temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  console.log(`\n--- TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ---`);
  await pool.end();
  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runValidationTests();
