const { GoogleClient } = require('../lib/GoogleClient');
const { Subscription } = require('../models/subscriptionModel');

async function onSubscribe(user, rcWebhookId, rcWebhookUri, formIds) {
  let userSubscriptions = [...user.subscriptions];
  const existedSubscriptions = userSubscriptions.filter(sub => (
    sub.rcWebhookId === rcWebhookId
  ));
  const googleClient = new GoogleClient({ token: user.accessToken });
  await Promise.all(formIds.map(async (formId) => {
    try {
      const existedSubscription = existedSubscriptions.find((sub) => sub.formId === formId);
      if (existedSubscription) {
        const subscription = await Subscription.findByPk(existedSubscription.id);
        if (subscription) {
          const watchExpiredAt = new Date(subscription.watchExpiredAt);
          if (watchExpiredAt.getTime() > Date.now()) {
            const { expireTime } = await googleClient.renewWatch(formId, subscription.id);
            subscription.watchExpiredAt = new Date(expireTime);
            subscription.rcWebhookUri = rcWebhookUri;
            subscription.messageReceivedAt = new Date();
            await subscription.save();
            return;
          }
          await subscription.destroy();
        }
        userSubscriptions = userSubscriptions.filter(sub => sub.id !== existedSubscription.id);
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
      userSubscriptions.push({
        id,
        formId,
        rcWebhookId,
      });
    } catch (e) {
      console.error(`Subscription error for user ${user.id} and form ${formId}`);
      console.error(e);
    }
  }));
  user.subscriptions = userSubscriptions;
  await user.save();
}

async function onDeleteSubscription(user, rcWebhookId, formId) {
  let userSubscriptions = user.subscriptions || [];
  const existedSubscriptions = userSubscriptions.filter(sub => (
    sub.rcWebhookId === rcWebhookId &&
    sub.formId === formId
  ));
  const googleClient = new GoogleClient({ token: user.accessToken });
  await Promise.all(existedSubscriptions.map(async (sub) => {
    const subscription = await Subscription.findByPk(sub.id);
    if (subscription) {
      const watchExpiredAt = new Date(subscription.watchExpiredAt);
      if (watchExpiredAt.getTime() > Date.now()) {
        await googleClient.deleteWatch(formId, subscription.id);
      }
      await subscription.destroy();
    }
    userSubscriptions = userSubscriptions.filter(userSub => userSub.id !== sub.id);
  }));
  user.subscriptions = userSubscriptions;
  await user.save();
}
exports.onSubscribe = onSubscribe;
exports.onDeleteSubscription = onDeleteSubscription;
