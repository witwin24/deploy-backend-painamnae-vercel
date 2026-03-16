const express                        = require('express');
const router                         = express.Router();
const { exportLogs, createExportLog } = require('../controllers/logExport.controller'); 
const { protect, requireAdmin }      = require('../middlewares/auth');

// GET /api/export-logs/admin
router.get(
    '/admin',  
    protect, 
    requireAdmin, 
    exportLogs);

// POST /api/export-logs/admin
router.post(
    '/admin', 
    protect, 
    requireAdmin, 
    createExportLog);

module.exports = router;