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

async function onUnauthorize(userId) {
  const user = await User.findByPk(userId);
  if (user && user.accessToken) {
    const googleClient = new GoogleClient({ token: user.accessToken });
    const subscriptions = await Subscription.findAll({
      where: {
        userId: user.id,
      },
    });
    await Promise.all(subscriptions.map(async (subscription) => {
      await googleClient.deleteWatch(subscription.formId, subscription.id)
      await subscription.destroy();
    }));
    await googleClient.revokeToken();
    user.accessToken = '';
    user.refreshToken = '';
    await user.save();
  }
}

exports.onAuthorize = onAuthorize;
exports.onUnauthorize = onUnauthorize;