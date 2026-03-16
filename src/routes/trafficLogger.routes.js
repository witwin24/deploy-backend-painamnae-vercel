const express = require('express');
const trafficLogController = require('../controllers/trafficLogger.controller');
const { protect, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// GET /api/traffic-logs/admin
router.get(
    '/admin',
    protect,
    requireAdmin,
    trafficLogController.getTrafficLogs
);

// GET /api/traffic-logs/admin/export
router.get(
    '/admin/export', 
    protect, 
    requireAdmin, 
    trafficLogController.exportTrafficLogs
);

module.exports = router;