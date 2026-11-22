const path = require('path');
const dns = require('dns');

require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

const dnsServers = (process.env.DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers.length > 0) dns.setServers(dnsServers);

async function run() {
  await mongoose.connect(process.env.MONGO_URL);

  const email = 'admin@fundraise.com';
  const already = await User.findOne({ email });
  if (already) {
    console.log('Admin already exists');
    await mongoose.disconnect();
    return;
  }

  const password = await bcrypt.hash('admin123', 10);
  await User.create({ name: 'Admin', email, password, role: 'admin' });

  console.log('Admin created!');
  console.log('email: admin@fundraise.com');
  console.log('password: admin123');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
