const { Subscription } = require('../models/subscriptionModel');
const { onReceiveNotification } = require('../handlers/notificationHandler');
const { errorLogger } = require('../lib/logger');

async function notification(req, res) {
  // console.log(JSON.stringify(req.body, null, 2));
  try {
    const message = req.body.message;
    if (!message || !message.publishTime || !message.attributes || !message.attributes.watchId) {
      res.status(400);
      res.send('Invalid message');
      return;
    }
    const watchId = message.attributes.watchId;
    const subscription = await Subscription.findByPk(watchId);
    if (!subscription) {
      res.status(404);
      res.send('Unknown watch id');
      return;
    }
    await onReceiveNotification(subscription, message.publishTime);
    res.status(200);
    res.json({
      result: 'ok',
    });
  } catch (e) {
    errorLogger(e);
    res.status(200);
    res.json({
      result: 'error',
    });
  }
}

exports.notification = notification;
