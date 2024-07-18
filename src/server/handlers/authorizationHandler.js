const { User } = require('../models/userModel');
const { Subscription } = require('../models/subscriptionModel');
const { GoogleClient } = require('../lib/GoogleClient');
const { errorLogger } = require('../lib/logger');

async function onAuthorize(accessToken, refreshToken, expires) {
  const googleClient = new GoogleClient({ token: accessToken });
  const userInfoResponse = await googleClient.getUserInfo();
  const userId = userInfoResponse.sub;

  let user = await User.findByPk(userId);
  if (!user) {
    user = await User.create({
      id: userId,
      accessToken: accessToken,
      refreshToken: refreshToken,
      tokenExpiredAt: expires,
      name: '',
      subscriptions: [],
    });
  }
  else {
    user.accessToken = accessToken;
    if (refreshToken) {
      user.refreshToken = refreshToken;
    }
    user.tokenExpiredAt = expires;
    await user.save();
  }

  return userId;
}

function getUniqueSubscriptions(subscriptions) {
  const data = {};
  subscriptions.forEach((subscription) => {
    data[subscription.id] = subscription;
  });
  return Object.keys(data).map((key) => data[key]);
}

async function onUnauthorize(user) {
  const googleClient = new GoogleClient({ token: user.accessToken });
  const subscriptions = user.subscriptions;
  const uniqueSubscriptions = getUniqueSubscriptions(subscriptions);
  await Promise.all(uniqueSubscriptions.map(async (subscription) => {
    try {
      await googleClient.deleteWatch(subscription.formId, subscription.id);
      await Subscription.destroy({ where: { id: subscription.id } });
    } catch (e) {
      console.error('Failed to delete watch: ', subscription.id);
      errorLogger(e);
    }
  }));
  await googleClient.revokeToken(user.refreshToken || user.accessToken);
  user.accessToken = '';
  user.refreshToken = '';
  user.subscriptions = [];
  await user.save();
}

exports.onAuthorize = onAuthorize;
exports.onUnauthorize = onUnauthorize;