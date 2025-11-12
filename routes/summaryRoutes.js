const express = require('express');
const router = express.Router();
const { getSummaryData } = require('../controllers/summaryController');
const protect = require('../middleware/authMiddleware'); // Assuming you want to protect this route

console.log('getSummaryData in summaryRoutes:', getSummaryData);

router.get('/', getSummaryData);

module.exports = router;
