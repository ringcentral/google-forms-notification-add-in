const { User } = require('../models/userModel');
const { Subscription } = require('../models/subscriptionModel');
const { GoogleClient } = require('../lib/GoogleClient');

async function onAuthorize(accessToken, refreshToken, expires) {
  const googleClient = new GoogleClient({ token: accessToken });
  const userInfoResponse = await googleClient.getUserInfo();
  const userId = userInfoResponse.sub; // [REPLACE] this line with user id from actual response

  let user = await User.findByPk(userId);
  if (!user) {
    user = await User.create({
      id: userId,
      accessToken: accessToken,
      refreshToken: refreshToken,
      tokenExpiredAt: expires,
      name: userInfoResponse.name,
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

async function onUnauthorize(user) {
  const googleClient = new GoogleClient({ token: user.accessToken });
  const subscriptions = user.subscriptions;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await googleClient.deleteWatch(subscription.formId, subscription.id);
      await Subscription.destroy({ where: { id: subscription.id } });
    } catch (e) {
      console.error('Failed to delete watch: ', subscription.id);
      console.error(e);
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