const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const dns = require('dns');

// Force reliable public DNS resolvers for mongodb+srv lookups
dns.setServers(['8.8.8.8', '1.1.1.1']);

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('ERROR: MONGO_URI not found in .env');
  process.exit(1);
}

console.log('Connecting to:', uri.replace(/:\/\/[^@]+@/, '://***:***@'));

mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
  .then(async () => {
    console.log('\n✅ CONNECTED');
    console.log('Database name:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);

    const UserSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const count = await User.countDocuments();
    console.log('\nTotal users in "' + mongoose.connection.name + '":', count);

    if (count > 0) {
      const users = await User.find({}, { email: 1, phone: 1, employeeId: 1, role: 1, _id: 0 }).lean();
      console.log('\nAll users:');
      users.forEach((u, i) => {
        console.log(`  [${i+1}] role=${u.role || 'N/A'} | email=${u.email || 'N/A'} | phone=${u.phone || 'N/A'} | employeeId=${u.employeeId || 'N/A'}`);
      });
    } else {
      console.log('\nDatabase is empty - no users found.');
    }

    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(e => {
    console.error('\n❌ CONNECTION FAILED:', e.message);
    if (e.message.includes('querySrv') || e.message.includes('ECONNREFUSED') || e.message.includes('ENOTFOUND')) {
      console.error('\n⚠️  DNS/Network issue with mongodb+srv:// URI.');
      console.error('Your network may be blocking SRV DNS records.');
      console.error('Try switching to a hotspot or different network.');
    }
    process.exit(1);
  });
