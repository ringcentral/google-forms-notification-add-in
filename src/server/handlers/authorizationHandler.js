const { User } = require('../models/userModel');
const { Subscription } = require('../models/subscriptionModel');
const { GoogleClient } = require('../lib/GoogleClient');
const { getOAuthApp } = require('../lib/oauth');

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
  // If user exists but logged out, we want to fill in token info
  else if (!user.accessToken) {
    user.accessToken = accessToken;
    user.refreshToken = refreshToken;
    user.tokenExpiredAt = expires;
    await user.save();
  }

  return userId;
}

async function onUnauthorize(userId) {
  const user = await User.findByPk(userId);
  if (user && user.accessToken) {
    const googleClient = new GoogleClient({ token: user.accessToken });
    await googleClient.revokeToken();
    user.accessToken = '';
    user.accessToken = '';
    // TODO: Unsubscribe all webhook and clear subscriptions in db
    // const subscription = await Subscription.findOne({
    //   where: {
    //     userId: userId
    //   }
    // });
    await user.save();
  }
}

exports.onAuthorize = onAuthorize;
exports.onUnauthorize = onUnauthorize;