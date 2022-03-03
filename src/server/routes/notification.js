const { Subscription } = require('../models/subscriptionModel');
const { onReceiveNotification } = require('../handlers/notificationHandler');

async function notification(req, res) {
  console.log(JSON.stringify(req.body, null, 2));
  try {
    const message = req.body.message;
    const formId = message.attributes.formId;
    const subscriptions = await Subscription.findAll({
      where: {
        formId,
      },
    });
    if (subscriptions.length === 0) {
      res.status(403);
      res.send('Unknown form id');
      return;
    }
    await onReceiveNotification(formId, subscriptions, message.publishTime);
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
