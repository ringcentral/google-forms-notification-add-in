const { GoogleClient } = require('../lib/GoogleClient');
const { Subscription } = require('../models/subscriptionModel');

async function onSubscribe(user, rcWebhookUri, formIds) {
  const existedSubscriptions = await Subscription.findAll({
    where: {
      userId: user.id,
      formId: formIds,
      rcWebhookUri: rcWebhookUri,
    }
  });
  const googleClient = new GoogleClient({ token: user.accessToken });
  const updateSubscriptionMap = {};
  await Promise.all(formIds.map(async (formId) => {
    const existedSubscription = existedSubscriptions.find((subscription) => subscription.formId === formId);
    if (existedSubscription) {
      updateSubscriptionMap[existedSubscription.id] = 1;
      const { expireTime } = await googleClient.renewWatch(formId, existedSubscription.id);
      existedSubscription.watchExpiredAt = expireTime;
      await existedSubscription.save();
    } else {
      const { id, expireTime } = await googleClient.createWatch(formId);
      await Subscription.create({
        id,
        userId: user.id,
        formId: formId,
        rcWebhookUri: rcWebhookUri,
        watchExpiredAt: expireTime,
      });
    }
  }));
} 

async function onDeleteSubscription(user, rcWebhookUri, formId) {
  const subscriptions = await Subscription.findAll({
    where: {
      userId: user.id,
      formId: formId,
      rcWebhookUri: rcWebhookUri,
    }
  });
  const googleClient = new GoogleClient({ token: user.accessToken });
  await Promise.all(subscriptions.map(async (subscription) => {
    await googleClient.deleteWatch(formId, subscription.id)
    await subscription.destroy();
  }));
}
exports.onSubscribe = onSubscribe;
exports.onDeleteSubscription = onDeleteSubscription;
