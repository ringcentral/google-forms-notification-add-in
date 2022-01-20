const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for Subscription data
exports.Subscription = sequelize.define('subscriptions', {
  // Google Form watch Id
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  formId: {
    type: Sequelize.STRING,
  },
  userId: {
    type: Sequelize.STRING
  },
  rcWebhookUri:{
    type: Sequelize.STRING
  },
  messageReceivedAt: {
    type: Sequelize.DATE,
  },
  watchedExpiredAt: {
    type: Sequelize.DATE,
  },
  watchType: {
    type: Sequelize.STRING,
    defaultValue: 'RESPONSES',
  },
  active: {
    type: Sequelize.BOOLEAN,
    defaultValue: true
  }
});
