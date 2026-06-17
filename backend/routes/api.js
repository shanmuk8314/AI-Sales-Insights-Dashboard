const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const salesController = require('../controllers/salesController');
const insightsController = require('../controllers/insightsController');
const aiController = require('../controllers/aiController');

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// CSV File filter
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed.'), false);
  }
};

const upload = multer({ storage, fileFilter });

const { pool } = require('../config/postgres');

// API routes
router.post('/upload', upload.single('file'), salesController.uploadCSV);
router.get('/dashboard', salesController.getDashboardData);
router.get('/insights', insightsController.generateInsights);
router.get('/ai-insights', aiController.getAiInsights);
router.get('/upload-history', salesController.getUploadHistory);

// Temporary endpoints for PostgreSQL migration verification
router.get('/test-postgres', async (req, res) => {
  try {
    const salesCountRes = await pool.query('SELECT COUNT(*) FROM sales');
    const uploadHistoryCountRes = await pool.query('SELECT COUNT(*) FROM upload_history');
    
    return res.status(200).json({
      success: true,
      salesCount: parseInt(salesCountRes.rows[0].count, 10),
      uploadHistoryCount: parseInt(uploadHistoryCountRes.rows[0].count, 10)
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/database-status', async (req, res) => {
  try {
    const salesCountRes = await pool.query('SELECT COUNT(*) FROM sales');
    const uploadHistoryCountRes = await pool.query('SELECT COUNT(*) FROM upload_history');
    
    return res.status(200).json({
      activeDatabase: "postgresql",
      postgresConnected: true,
      salesCount: parseInt(salesCountRes.rows[0].count, 10),
      uploadHistoryCount: parseInt(uploadHistoryCountRes.rows[0].count, 10)
    });
  } catch (error) {
    return res.status(500).json({
      activeDatabase: "postgresql",
      postgresConnected: false,
      salesCount: 0,
      uploadHistoryCount: 0,
      error: error.message
    });
  }
});

module.exports = router;
