const { Subscription } = require('../models/subscriptionModel');
const crypto = require('crypto');
const { onReceiveNotification } = require('../handlers/notificationHandler');

async function notification(req, res) {
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
    await onReceiveNotification(formId, subscriptions);
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


async function interactiveMessages(req, res) {
  // Shared secret can be found on RingCentral developer portal, under your app Settings
  const SHARED_SECRET = process.env.IM_SHARED_SECRET;
  if (SHARED_SECRET) {
    const signature = req.get('X-Glip-Signature', 'sha1=');
    const encryptedBody =
      crypto.createHmac('sha1', SHARED_SECRET).update(JSON.stringify(req.body)).digest('hex');
    if (encryptedBody !== signature) {
      res.status(401).send();
      return;
    }
  }
  const body = req.body;
  console.log(`Incoming interactive message: ${JSON.stringify(body, null, 2)}`);
  if (!body.data || !body.user) {
    res.status(400);
    res.send('Params error');
    return;
  }
  res.status(200);
  res.json('OK');
}

exports.notification = notification;
exports.interactiveMessages = interactiveMessages;