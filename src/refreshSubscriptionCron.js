require('dotenv').config();

const { GoogleClient } = require('./server/lib/GoogleClient');
const { checkAndRefreshAccessToken } = require('./server/lib/oauth');
const { Subscription } = require('./server/models/subscriptionModel');
const { User } = require('./server/models/userModel');

async function refreshSubscription() {
  const currentTime = new Date();
  const expiredIn3Day = new Date(currentTime);
  expiredIn3Day.setDate(currentTime.getDate() + 3);
  const subscriptions = await Subscription.findAll();
  const users = {};
  for (const subscription of subscriptions) {
    if (subscription.watchExpiredAt < currentTime) {
      continue;
    }
    if (subscription.watchExpiredAt > expiredIn3Day) {
      continue;
    }
    try {
      console.log('refreshing subscription:', subscription.id);
      if (!users[subscription.userId]) {
        users[subscription.userId] = await User.findByPk(subscription.userId);
      }
      const user = users[subscription.userId];
      if (!user || !user.accessToken) {
        return;
      }
      try {
        await checkAndRefreshAccessToken(user);
        const googleClient = new GoogleClient({ token: user.accessToken });
        const { expireTime } = await googleClient.renewWatch(subscription.formId, subscription.id);
        subscription.watchExpiredAt = new Date(expireTime);
        await subscription.save();
        console.log(`refreshing subscription ${subscription.id} successfully`);
      } catch (e) {
        if (e.response && e.response.status === 401) {
          user.accessToken = '';
          await user.save();
          console.log('refreshing subscription failed: access token expired: ', user.id);
          return;
        }
        throw e;
      }
    } catch (e) {
      console.error('refreshing error subscription: ', subscription.id);
      console.error(e && e.message);
    }
  }
}

exports.refresh = refreshSubscription;
