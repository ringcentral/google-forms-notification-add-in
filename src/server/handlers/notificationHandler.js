const { User } = require('../models/userModel');
const { sendAdaptiveCardMessage } = require('../lib/messageHelper');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const { formatGoogleFormResponse } = require('../lib/formatGoogleFormResponse');
const { GoogleClient } = require('../lib/GoogleClient');

const responseTemplate = require('../adaptiveCardPayloads/response.json');

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

async function onReceiveNotification(formId, subscriptions) {
  const groupedSubscriptions = groupSubscriptionsWithUserId(subscriptions);
  await Promise.all(Object.keys(groupedSubscriptions).map(async (userId) => {
    const currentUserSubscriptions = groupedSubscriptions[userId];
    const user = await User.findByPk(userId);
    if (!user || !user.accessToken) {
      return;
    }
    await checkAndRefreshAccessToken(user);
    const googleClient = new GoogleClient({ token: user.accessToken });
    const form = await googleClient.getForm(formId);
    const responses = await googleClient.getFormResponses(formId);
    const messageCards = responses.map((response) => formatGoogleFormResponse(form, response));
    await Promise.all(messageCards.map(async messageCard => {
      await Promise.all(currentUserSubscriptions.map(async (subscription) => {
        await sendAdaptiveCardMessage(
          subscription.rcWebhookUri,
          responseTemplate,
          messageCard,
        );
      }));
    }));
  }));
}

async function onReceiveInteractiveMessage(incomingMessageData, user) {
  // Below tis the section for your customized actions handling
  // testActionType is from adaptiveCard.js - getSampleCard()
  if (incomingMessageData.action === 'testActionType') {
    // [INSERT] API call to perform action on 3rd party platform 
  }
}

exports.onReceiveNotification = onReceiveNotification;
exports.onReceiveInteractiveMessage = onReceiveInteractiveMessage;