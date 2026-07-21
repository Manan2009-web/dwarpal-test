const express = require('express');
const env = require('../config/env');
const dbConnectMiddleware = require('../middleware/dbConnectMiddleware');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const gatepassRoutes = require('./gatepassRoutes');
const facultyLeaveRoutes = require('./facultyLeaveRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const adminRoutes = require('./adminRoutes');
const debugRoutes = require('./debugRoutes');
const notificationRoutes = require('./notificationRoutes');
const publicRoutes = require('./publicRoutes');
const visitorRoutes = require('./visitorRoutes');
const coordinatorRoutes = require('./coordinatorRoutes');

const router = express.Router();

// Ensure DB is connected before any API route handler runs.
// This is critical for Vercel serverless — each function invocation
// starts cold and needs an explicit connect before any Mongoose query.
router.use(dbConnectMiddleware);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/gatepasses', gatepassRoutes);
router.use('/faculty-leaves', facultyLeaveRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);
router.use('/public', publicRoutes);
router.use('/visitors', visitorRoutes);
router.use('/coordinator', coordinatorRoutes);

if (env.isDevelopment) {
  router.use('/debug', debugRoutes);
}

module.exports = router;
