const { decodeJwt } = require('../lib/jwt');
const { User } = require('../models/userModel');
const { onSubscribe } = require('../handlers/subscriptionHandler');
const { GoogleClient } = require('../lib/googleClient');
const { checkAndRefreshAccessToken } = require('../lib/oauth');

async function getFormData(req, res) {
  const jwtToken = req.query.token;
  if (!jwtToken) {
    res.status(403);
    res.send('Error params');
    return;
  }
  const decodedToken = decodeJwt(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  const userId = decodedToken.id;
  let user;
  try {
    user = await User.findByPk(userId);
    if (!user || !user.accessToken) {
      res.status(401);
      res.send('Token invalid.');
      return;
    }
    await checkAndRefreshAccessToken(user);
    let formIds = req.query.formIds;
    if (!formIds) {
      res.status(403);
      res.send('Error params');
      return;
    }
    formIds = formIds.split(',');
    if (formIds.length > 10) {
      res.status(403);
      res.send('Too many forms');
      return;
    }
    const googleClient = new GoogleClient({ token: user.accessToken });
    const forms = await Promise.all(formIds.map(async (formId) => {
      const form = await googleClient.getForm(formId);
      return form;
    }));
    res.json({
      forms,
    });
  } catch (e) {
    console.error(e);
    if (e.response && e.response.status === 401) {
      if (user) {
        user.accessToken = '';
        user.refreshToken = '';
        await user.save();
      }
      res.status(401);
      res.send('Unauthorized.');
      return;
    }
    console.error(e && e.message);
    res.status(500);
    res.send('Internal error');
  }
}


async function subscribe(req, res) {
  // validate jwt
  const jwtToken = req.body.token;
  if (!jwtToken) {
    res.status(403);
    res.send('Params invalid.');
    return;
  }
  const decodedToken = decodeJwt(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid');
    return;
  }

  // check for rcWebhookUri
  const rcWebhookUri = req.body.rcWebhookUri;
  if (!rcWebhookUri) {
    res.status(400);
    res.send('Missing rcWebhookUri');
    return;
  }

  // get existing user
  const userId = decodedToken.id;
  const user = await User.findByPk(userId.toString());
  if (!user) {
    res.status(401);
    res.send('Unknown user');
    return;
  }

  // create webhook notification subscription
  try {
    await onSubscribe(user, rcWebhookUri);
    res.status(200);
    res.json({
      result: 'ok'
    });
  }
  catch (e) {
    console.error(e);
    if (e.response && e.response.status === 401) {
      res.status(401);
      res.send('Unauthorized');
      return;
    }
    res.status(500);
    res.send('Internal server error');
    return;
  }
}

exports.subscribe = subscribe;
exports.getFormData = getFormData;
