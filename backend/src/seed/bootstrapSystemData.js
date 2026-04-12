const connectDatabase = require('../config/db');
const { seedDefaultAdmins } = require('../services/adminService');
const { repairStudentGatepassRoutingRecords } = require('../services/gatepassService');

async function runBootstrap() {
  await connectDatabase();

  const seedResult = await seedDefaultAdmins();
  const repairResult = await repairStudentGatepassRoutingRecords();

  console.log('System bootstrap completed:', {
    seedResult,
    repairResult
  });

  process.exit(0);
}

runBootstrap().catch((error) => {
  console.error('System bootstrap failed:', error);
  process.exit(1);
});
