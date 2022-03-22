const axios = require('axios');
const { icon } = require('./constants');

// async function sendTextMessage(rcWebhook, message) {
//   await axios.post(rcWebhook, {
//     title: message,
//     activity: 'Google Forms Add-in',
//     icon: icon.LOGO,
//   }, {
//     headers: {
//       Accept: 'application/json',
//       'Content-Type': 'application/json'
//     }
//   });
// }

async function sendAdaptiveCardMessage(rcWebhook, card) {
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

// exports.sendTextMessage = sendTextMessage;
exports.sendAdaptiveCardMessage = sendAdaptiveCardMessage;