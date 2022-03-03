const { User } = require('../models/userModel');
const { sendAdaptiveCardMessage } = require('../lib/messageHelper');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const { formatGoogleFormResponseIntoCard } = require('../lib/formatGoogleFormResponse');
const { GoogleClient } = require('../lib/GoogleClient');

function groupSubscriptionsWithUserId(subscriptions) {
  const userIdToSubscriptions = {};
  subscriptions.forEach(subscription => {
    const userId = subscription.userId;
    if (!userIdToSubscriptions[userId]) {
      userIdToSubscriptions[userId] = [];
    }
    userIdToSubscriptions[userId].push(subscription);
  });
  return userIdToSubscriptions;
}

function getLastMessageReceiveTime(subscriptions) {
  let lastMessageReceiveTime = 0;
  subscriptions.forEach((subscription) => {
    const time = (new Date(subscription.messageReceivedAt)).getTime();
    if (time > lastMessageReceiveTime) {
      lastMessageReceiveTime = time;
    }
  });
  return lastMessageReceiveTime;
}

async function onReceiveNotification(formId, subscriptions, messageTime) {
  const groupedSubscriptions = groupSubscriptionsWithUserId(subscriptions);
  await Promise.all(Object.keys(groupedSubscriptions).map(async (userId) => {
    const currentUserSubscriptions = groupedSubscriptions[userId];
    const user = await User.findByPk(userId);
    if (!user || !user.accessToken) {
      return;
    }
    try {
      await checkAndRefreshAccessToken(user);
    } catch (e) {
      if (e.response && e.response.status === 401) {
        user.accessToken = '';
        await user.save();
      }
      console.error(e);
      return;
    }
    const googleClient = new GoogleClient({ token: user.accessToken });
    const form = await googleClient.getForm(formId);
    const responses = await googleClient.getFormResponses(formId, getLastMessageReceiveTime(currentUserSubscriptions));
    const messageCards = responses.map((response) => formatGoogleFormResponseIntoCard(form, response));
    await Promise.all(messageCards.map(async messageCard => {
      await Promise.all(currentUserSubscriptions.map(async (subscription) => {
        await sendAdaptiveCardMessage(
          subscription.rcWebhookUri,
          messageCard
        );
        subscription.messageReceivedAt = new Date(messageTime);
        await subscription.save();
      }));
    }));
  }));
}

exports.onReceiveNotification = onReceiveNotification;
