const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const dns = require('dns');

// Force public DNS resolvers
dns.setServers(['8.8.8.8', '1.1.1.1']);

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI not found');
  process.exit(1);
}

mongoose.connect(uri)
  .then(async () => {
    console.log('Connected to DB');
    const GatepassSchema = new mongoose.Schema({}, { strict: false });
    const Gatepass = mongoose.models.Gatepass || mongoose.model('Gatepass', GatepassSchema);

    const count = await Gatepass.countDocuments();
    console.log('Total gatepasses:', count);

    const passes = await Gatepass.find({}).lean();
    passes.forEach((p, i) => {
      console.log(`[${i+1}] ID=${p.passNumber || p.gatepassId || 'N/A'} | status=${p.status} | createdBy=${p.createdBy} | forwardedTo=${p.forwardedTo} | reason="${p.reason}"`);
    });

    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
