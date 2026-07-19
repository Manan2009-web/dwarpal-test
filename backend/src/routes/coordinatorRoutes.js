'use strict';

const express = require('express');
const { protect, requireVerifiedEmail } = require('../middleware/authMiddleware');
const coordinatorController = require('../controllers/coordinatorController');

const router = express.Router();

// Require authentication and email verification for all coordinator operations
router.use(protect, requireVerifiedEmail);

router.post('/assign', coordinatorController.assignCoordinator);
router.post('/resign', coordinatorController.resignCoordinator);

module.exports = router;
