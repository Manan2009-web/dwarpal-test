const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '1.1.1.1']);

const uri = process.env.MONGO_URI;

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB');
    const UserSchema = new mongoose.Schema({}, { strict: false });
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const users = await User.find({}).lean();
    users.forEach(u => {
      console.log(`id=${u._id} | role=${u.role} | employeeId=${u.employeeId} | email=${u.email} | fullName=${u.fullName}`);
    });

    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
