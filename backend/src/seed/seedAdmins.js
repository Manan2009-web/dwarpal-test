const connectDatabase = require('../config/db');
const { seedDefaultAdmins } = require('../services/adminService');

async function runSeed() {
  await connectDatabase();
  const result = await seedDefaultAdmins();
  console.log('System account seed completed:', result);
  process.exit(0);
}

runSeed().catch((error) => {
  console.error('System account seed failed:', error);
  process.exit(1);
});
