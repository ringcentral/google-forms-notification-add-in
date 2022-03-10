const { Subscription } = require('../models/subscriptionModel');
const { onReceiveNotification } = require('../handlers/notificationHandler');

async function notification(req, res) {
  // console.log(JSON.stringify(req.body, null, 2));
  try {
    const message = req.body.message;
    const watchId = message.attributes.watchId;
    const subscription = await Subscription.findByPk(watchId);
    if (!subscription) {
      res.status(403);
      res.send('Unknown watch id');
      return;
    }
    await onReceiveNotification(subscription, message.publishTime);
    res.status(200);
    res.json({
      result: 'ok',
    });
  } catch (e) {
    console.error(e);
    res.status(200);
    res.json({
      result: 'error',
    });
  }
}

exports.notification = notification;
