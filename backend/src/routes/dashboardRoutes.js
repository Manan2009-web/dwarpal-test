const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const validateRequest = require('../middleware/validateRequest');
const dashboardController = require('../controllers/dashboardController');
const { dashboardQueryValidation } = require('../validators/queryValidators');

const router = express.Router();

router.get('/summary', protect, dashboardQueryValidation, validateRequest, dashboardController.getSummary);

module.exports = router;
