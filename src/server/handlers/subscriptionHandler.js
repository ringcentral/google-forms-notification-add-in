const { GoogleClient } = require('../lib/GoogleClient');
const { Subscription } = require('../models/subscriptionModel');

async function onSubscribe(user, rcWebhookId, rcWebhookUri, formIds) {
  const existedSubscriptions = await Subscription.findAll({
    where: {
      userId: user.id,
      formId: formIds,
      rcWebhookId,
    }
  });
  const googleClient = new GoogleClient({ token: user.accessToken });
  await Promise.all(formIds.map(async (formId) => {
    const existedSubscription = existedSubscriptions.find((subscription) => subscription.formId === formId);
    if (existedSubscription) {
      const watchExpiredAt = new Date(existedSubscription.watchExpiredAt);
      if (watchExpiredAt.getTime() > Date.now()) {
        const { expireTime } = await googleClient.renewWatch(formId, existedSubscription.id);
        existedSubscription.watchExpiredAt = new Date(expireTime);
        existedSubscription.rcWebhookUri = rcWebhookUri;
        existedSubscription.messageReceivedAt = new Date();
        await existedSubscription.save();
        return;
      }
      await existedSubscription.destroy();
    }
    const { id, expireTime, createTime } = await googleClient.createWatch(formId);
    await Subscription.create({
      id,
      userId: user.id,
      formId: formId,
      rcWebhookId: rcWebhookId,
      rcWebhookUri: rcWebhookUri,
      watchExpiredAt: new Date(expireTime),
      messageReceivedAt: new Date(createTime),
    });
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
    const watchExpiredAt = new Date(subscription.watchExpiredAt);
    if (watchExpiredAt.getTime() > Date.now()) {
      await googleClient.deleteWatch(formId, subscription.id)
    }
    await subscription.destroy();
  }));
}
exports.onSubscribe = onSubscribe;
exports.onDeleteSubscription = onDeleteSubscription;
