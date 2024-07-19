require('dotenv').config();

const { GoogleClient } = require('./server/lib/GoogleClient');
const { checkAndRefreshAccessToken } = require('./server/lib/oauth');
const { Subscription } = require('./server/models/subscriptionModel');
const { User } = require('./server/models/userModel');
const { errorLogger } = require('./server/lib/logger');

async function refreshSubscription() {
  const currentTime = new Date();
  const expiredIn3Day = new Date(currentTime);
  expiredIn3Day.setDate(currentTime.getDate() + 3);
  let lastKey = null;
  const lastKeyRecord = await Subscription.findByPk('SYSTEM_LAST_KEY');
  if (lastKeyRecord && lastKeyRecord.formId) {
    lastKey = lastKeyRecord.formId;
  }
  const findAllQuery = {
    limit: 100,
  };
  if (lastKey) {
    findAllQuery.lastKey = {
      id: lastKey,
    };
  }
  const subscriptions = await Subscription.findAll(findAllQuery);
  if (subscriptions.lastKey) {
    if (!lastKeyRecord) {
      await Subscription.create({
        id: 'SYSTEM_LAST_KEY',
        formId: subscriptions.lastKey.id,
      });
    } else {
      lastKeyRecord.formId = subscriptions.lastKey.id;
      await lastKeyRecord.save();
    }
  } else if (lastKeyRecord) {
    lastKeyRecord.formId = '';
    await lastKeyRecord.save();
  }
  const users = {};
  for (const subscription of subscriptions) {
    if (subscription.id === 'SYSTEM_LAST_KEY') {
      continue;
    }
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
          user.name = '';
          await user.save();
          console.log('refreshing subscription failed: access token expired: ', user.id);
          return;
        }
        throw e;
      }
    } catch (e) {
      console.error('refreshing error subscription: ', subscription.id);
      errorLogger(e);
    }
  }
}

exports.refresh = refreshSubscription;
