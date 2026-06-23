/**
 * DwarPal — Clear All Users from Atlas
 * Run: node clear_all_users.js
 * 
 * This permanently deletes every document in the "users" collection
 * on the configured Atlas database. Use only when you want a true fresh start.
 */
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

console.log('Connecting to Atlas...');
console.log('URI:', uri.replace(/:\/\/[^@]+@/, '://***:***@'));

mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
  .then(async () => {
    console.log('\n✅ Connected to:', mongoose.connection.name, 'on', mongoose.connection.host);

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log('Collections found:', collectionNames.join(', ') || '(none)');

    if (!collectionNames.includes('users')) {
      console.log('\n"users" collection does not exist — already empty!');
      await mongoose.disconnect();
      process.exit(0);
    }

    const UserSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const countBefore = await User.countDocuments();
    console.log('\nUsers found before deletion:', countBefore);

    if (countBefore === 0) {
      console.log('Database is already empty — nothing to delete.');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Show what will be deleted
    const users = await User.find({}, { email: 1, phone: 1, employeeId: 1, role: 1, _id: 0 }).lean();
    console.log('\nUsers to be deleted:');
    users.forEach((u, i) => {
      console.log(`  [${i+1}] role=${u.role || 'N/A'} | email=${u.email || 'N/A'} | phone=${u.phone || 'N/A'}`);
    });

    const result = await User.deleteMany({});
    console.log('\n✅ Deleted', result.deletedCount, 'user(s).');

    const countAfter = await User.countDocuments();
    console.log('Users remaining:', countAfter);

    await mongoose.disconnect();
    console.log('\n✅ Done. Database is now empty. You can register fresh accounts.');
    process.exit(0);
  })
  .catch(e => {
    console.error('\n❌ FAILED:', e.message);
    if (e.message.includes('querySrv') || e.message.includes('ECONNREFUSED')) {
      console.error('\n⚠️  Cannot reach Atlas from this network.');
      console.error('Your ISP/router is blocking SRV DNS records (port 53 UDP).');
      console.error('Solutions:');
      console.error('  1. Switch to mobile hotspot and try again.');
      console.error('  2. Use MongoDB Compass on a working network to manually delete the users collection.');
      console.error('  3. Delete the users from the MongoDB Atlas web UI directly.');
    }
    process.exit(1);
  });
