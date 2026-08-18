#!/usr/bin/env node

/**
 * DwarPal Clean Gatepass Data Reset Script
 * 
 * This script connects to the configured MongoDB database using existing models
 * and deletes only gatepass-related data (Gatepasses, GatepassCounters, Gatepass notifications, and Gatepass audit logs).
 * It preserves all user accounts, faculty leave requests, pending registrations, and non-gatepass audit logs.
 */

const path = require('path');
const mongoose = require('mongoose');

// Load environment config first
const env = require('../src/config/env');
const connectDatabase = require('../src/config/db');

// Load models
const Gatepass = require('../src/models/Gatepass');
const GatepassCounter = require('../src/models/GatepassCounter');
const Notification = require('../src/models/Notification');
const AuditLog = require('../src/models/AuditLog');
const User = require('../src/models/User');
const FacultyLeaveRequest = require('../src/models/FacultyLeaveRequest');

// Notification query for gatepass events
const gatepassNotificationFilter = {
  $or: [
    { recordType: 'gatepass' },
    { gatepass: { $ne: null } },
    {
      type: {
        $in: [
          'gatepass_submitted',
          'gatepass_forwarded',
          'gatepass_escalated',
          'gatepass_approved',
          'gatepass_cancelled',
          'gatepass_ready_for_security',
          'gatepass_out',
          'gatepass_returned',
          'qr_generated',
          'gatepass_rejected',
          'hod_action',
          'coordinator_action',
          'security_verified'
        ]
      }
    }
  ]
};

// AuditLog query for gatepass events
const gatepassAuditLogFilter = { resourceType: 'gatepass' };

async function runReset() {
  try {
    console.log('\n======================================================');
    console.log('   DwarPal Gatepass Clean Data Reset Script (Launch)   ');
    console.log('======================================================\n');

    // Connect to database
    console.log('Connecting to database...');
    const dbState = await connectDatabase();
    
    console.log(`Connected to: ${mongoose.connection.name} on ${mongoose.connection.host}`);
    console.log('------------------------------------------------------\n');

    // 1. Gather Before Counts
    console.log('Step 1: Gathering current document counts...');
    const countsBefore = {
      gatepasses: await Gatepass.countDocuments(),
      gatepassCounters: await GatepassCounter.countDocuments(),
      gatepassNotifications: await Notification.countDocuments(gatepassNotificationFilter),
      totalNotifications: await Notification.countDocuments(),
      gatepassAuditLogs: await AuditLog.countDocuments(gatepassAuditLogFilter),
      totalAuditLogs: await AuditLog.countDocuments(),
      users: await User.countDocuments(),
      facultyLeaveRequests: await FacultyLeaveRequest.countDocuments()
    };

    console.log(`  - Gatepass documents:             ${countsBefore.gatepasses}`);
    console.log(`  - GatepassCounter documents:      ${countsBefore.gatepassCounters}`);
    console.log(`  - Gatepass Notifications:         ${countsBefore.gatepassNotifications} (out of ${countsBefore.totalNotifications} total)`);
    console.log(`  - Gatepass AuditLog entries:      ${countsBefore.gatepassAuditLogs} (out of ${countsBefore.totalAuditLogs} total)`);
    console.log(`  - User accounts (preserve):       ${countsBefore.users}`);
    console.log(`  - Faculty Leave Requests (pres.): ${countsBefore.facultyLeaveRequests}`);
    console.log('\n------------------------------------------------------\n');

    // 2. Perform Deletions
    console.log('Step 2: Performing clean data reset...');

    // Delete Gatepasses
    if (countsBefore.gatepasses > 0) {
      console.log('  Deleting all Gatepass documents...');
      const gatepassDeleteResult = await Gatepass.deleteMany({});
      console.log(`  -> Deleted ${gatepassDeleteResult.deletedCount} documents.`);
    } else {
      console.log('  No Gatepass documents to delete.');
    }

    // Delete GatepassCounters
    if (countsBefore.gatepassCounters > 0) {
      console.log('  Deleting all GatepassCounter documents (resetting sequences)...');
      const counterDeleteResult = await GatepassCounter.deleteMany({});
      console.log(`  -> Deleted ${counterDeleteResult.deletedCount} documents.`);
    } else {
      console.log('  No GatepassCounter documents to delete.');
    }

    // Delete Gatepass-related Notifications
    if (countsBefore.gatepassNotifications > 0) {
      console.log('  Deleting gatepass-related Notifications...');
      const notificationDeleteResult = await Notification.deleteMany(gatepassNotificationFilter);
      console.log(`  -> Deleted ${notificationDeleteResult.deletedCount} notifications.`);
    } else {
      console.log('  No gatepass-related Notifications to delete.');
    }

    // Delete Gatepass-related AuditLogs
    if (countsBefore.gatepassAuditLogs > 0) {
      console.log('  Deleting gatepass-related AuditLog entries...');
      const auditLogDeleteResult = await AuditLog.deleteMany(gatepassAuditLogFilter);
      console.log(`  -> Deleted ${auditLogDeleteResult.deletedCount} audit log entries.`);
    } else {
      console.log('  No gatepass-related AuditLog entries to delete.');
    }

    console.log('\n------------------------------------------------------\n');

    // 3. Gather After Counts
    console.log('Step 3: Gathering updated document counts...');
    const countsAfter = {
      gatepasses: await Gatepass.countDocuments(),
      gatepassCounters: await GatepassCounter.countDocuments(),
      gatepassNotifications: await Notification.countDocuments(gatepassNotificationFilter),
      totalNotifications: await Notification.countDocuments(),
      gatepassAuditLogs: await AuditLog.countDocuments(gatepassAuditLogFilter),
      totalAuditLogs: await AuditLog.countDocuments(),
      users: await User.countDocuments(),
      facultyLeaveRequests: await FacultyLeaveRequest.countDocuments()
    };

    console.log(`  - Gatepass documents:             ${countsAfter.gatepasses} (Expected: 0)`);
    console.log(`  - GatepassCounter documents:      ${countsAfter.gatepassCounters} (Expected: 0)`);
    console.log(`  - Gatepass Notifications:         ${countsAfter.gatepassNotifications} (Expected: 0)`);
    console.log(`  - Gatepass AuditLog entries:      ${countsAfter.gatepassAuditLogs} (Expected: 0)`);
    console.log(`  - Total remaining Notifications:  ${countsAfter.totalNotifications} (Expected: ${countsBefore.totalNotifications - countsBefore.gatepassNotifications})`);
    console.log(`  - Total remaining AuditLog entries: ${countsAfter.totalAuditLogs} (Expected: ${countsBefore.totalAuditLogs - countsBefore.gatepassAuditLogs})`);
    console.log(`  - User accounts:                  ${countsAfter.users} (Expected: ${countsBefore.users})`);
    console.log(`  - Faculty Leave Requests:         ${countsAfter.facultyLeaveRequests} (Expected: ${countsBefore.facultyLeaveRequests})`);

    // 4. Integrity Checks
    console.log('\n------------------------------------------------------\n');
    console.log('Step 4: Database integrity validation...');
    
    let isSuccessful = true;

    if (countsAfter.gatepasses !== 0) {
      console.error('  ❌ ERROR: Gatepass collection is not empty!');
      isSuccessful = false;
    }
    if (countsAfter.gatepassCounters !== 0) {
      console.error('  ❌ ERROR: GatepassCounter collection is not empty!');
      isSuccessful = false;
    }
    if (countsAfter.gatepassNotifications !== 0) {
      console.error('  ❌ ERROR: Gatepass-related notifications still exist!');
      isSuccessful = false;
    }
    if (countsAfter.gatepassAuditLogs !== 0) {
      console.error('  ❌ ERROR: Gatepass-related audit log entries still exist!');
      isSuccessful = false;
    }
    if (countsAfter.users !== countsBefore.users) {
      console.error(`  ❌ ERROR: User collection count changed! (Before: ${countsBefore.users}, After: ${countsAfter.users})`);
      isSuccessful = false;
    }
    if (countsAfter.facultyLeaveRequests !== countsBefore.facultyLeaveRequests) {
      console.error(`  ❌ ERROR: FacultyLeaveRequest collection count changed! (Before: ${countsBefore.facultyLeaveRequests}, After: ${countsAfter.facultyLeaveRequests})`);
      isSuccessful = false;
    }

    if (isSuccessful) {
      console.log('  ✅ SUCCESS: Database clean reset verified. Only gatepass data was deleted.');
    } else {
      console.error('  ❌ FAILURE: Integrity checks failed. Please check errors above.');
    }

    console.log('\nDisconnecting...');
    await connectDatabase.disconnectDatabase();
    console.log('Database disconnected successfully.');
    
    console.log('\n======================================================');
    process.exit(isSuccessful ? 0 : 1);
  } catch (error) {
    console.error('\n❌ UNEXPECTED EXCEPTION OCCURRED DURING RESET:', error);
    try {
      await connectDatabase.disconnectDatabase();
    } catch (_) {}
    process.exit(1);
  }
}

// Execute reset
runReset();
