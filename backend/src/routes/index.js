const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const gatepassRoutes = require('./gatepassRoutes');
const facultyLeaveRoutes = require('./facultyLeaveRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const adminRoutes = require('./adminRoutes');
const notificationRoutes = require('./notificationRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/gatepasses', gatepassRoutes);
router.use('/faculty-leaves', facultyLeaveRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);

module.exports = router;
