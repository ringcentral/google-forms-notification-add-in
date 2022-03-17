const Sequelize = require('sequelize');
const { sequelize } = require('./sequelize');

// Model for User data
const User = sequelize.define('users', {
  id: {
    type: Sequelize.STRING,
    primaryKey: true,
  },
  refreshToken: {
    type: Sequelize.STRING,
  },
  tokenExpiredAt:{
    type: Sequelize.DATE
  },
  email: {
    type: Sequelize.STRING,
  },
  name: {
    type: Sequelize.STRING,
  },
  rcUserId: {
    type: Sequelize.STRING,
  },
  accessToken: {
    type: Sequelize.STRING,
  },
  subscriptions: {
    // Save subscriptions reference to better performance for dynamodb
    type: Sequelize.JSON,
  },
});

exports.User = User;
