const { User } = require('../models/userModel');
const { sendAdaptiveCardMessage } = require('../lib/messageHelper');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const { formatGoogleFormResponseIntoCard } = require('../lib/formatGoogleFormResponse');
const { GoogleClient } = require('../lib/GoogleClient');

async function onReceiveNotification(subscription, messageTime) {
  const userId = subscription.userId;
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
  const formId = subscription.formId;
  let form;
  let responses;
  try {
    form = await googleClient.getForm(formId);
    // console.log(JSON.stringify(form, null, 2));
    responses = await googleClient.getFormResponses(formId, subscription.messageReceivedAt);
    // console.log(JSON.stringify(responses, null, 2));
  } catch (e) {
    if (e.response && e.response.status === 401) {
      user.accessToken = '';
      await user.save();
      return;
    }
    throw e;
  }

  const messageCards = responses.map((response) => formatGoogleFormResponseIntoCard(form, response));
  await Promise.all(messageCards.map(async messageCard => {
    await sendAdaptiveCardMessage(
      subscription.rcWebhookUri,
      messageCard
    );
    subscription.messageReceivedAt = new Date(messageTime);
    await subscription.save();
  }));
}

exports.onReceiveNotification = onReceiveNotification;
