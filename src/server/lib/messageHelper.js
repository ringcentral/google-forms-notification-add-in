const axios = require('axios');
const { Template } = require('adaptivecards-templating');
const { icon } = require('./constants');

async function sendTextMessage(rcWebhook, message) {
  await axios.post(rcWebhook, {
    title: message,
    activity: 'Google Forms Add-in',
    icon: icon.LOGO,
  }, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  });
}

async function sendAdaptiveCardMessage(rcWebhook, cardTemplate, params) {
  const template = new Template(cardTemplate);
  const card = template.expand({
    $root: params
  });
  const response = await axios.post(rcWebhook, {
    activity: 'Google Forms Add-in',
    icon: icon.LOGO,
    attachments: [
      card,
    ]
  }, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  });
  return response;
}

exports.sendTextMessage = sendTextMessage;
exports.sendAdaptiveCardMessage = sendAdaptiveCardMessage;