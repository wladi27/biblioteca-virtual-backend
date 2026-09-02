const express = require('express');
const router = express.Router();
const { getSummaryData, getAdminDashboardOverview } = require('../controllers/summaryController');
const authMiddleware = require('../middleware/authMiddleware');

// Endpoint Consolidado: Métricas globales + últimos retiros en 1 sola llamada HTTP
router.get('/admin-dashboard', authMiddleware, getAdminDashboardOverview);

// Endpoint de resumen general
router.get('/', authMiddleware, getSummaryData);

module.exports = router;
