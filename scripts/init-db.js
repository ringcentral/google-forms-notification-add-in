require('dotenv').config();
const { User } = require('../src/server/models/userModel');
const { Subscription } = require('../src/server/models/subscriptionModel');

async function initDB() {
  await User.sync({ alter: true });
  await Subscription.sync({ alter: true });
}

initDB();
