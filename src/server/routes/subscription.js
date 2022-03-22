const { decodeJwt } = require('../lib/jwt');
const { User } = require('../models/userModel');
const { onSubscribe, onDeleteSubscription } = require('../handlers/subscriptionHandler');
const { GoogleClient } = require('../lib/GoogleClient');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const { getRCWebhookId } = require('../lib/getRCWebhookId');

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
      const watchResponse = await googleClient.getWatches(formId)
      if (watchResponse.watches && watchResponse.watches.length > 0) {
        form.error = 'DuplicateError';
      }
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
    console.error(e);
    res.status(500);
    res.send('Internal error');
  }
}

async function subscribe(req, res) {
  // validate jwt
  const jwtToken = req.body.token;
  if (!jwtToken) {
    res.status(403);
    res.send('Params invalid');
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
  const rcWebhookId = getRCWebhookId(rcWebhookUri);
  if (!rcWebhookId) {
    res.status(400);
    res.send('Invalid rcWebhookUri');
    return;
  }

  let formIds = req.body.formIds;
  if (!formIds || formIds.length === 0) {
    res.status(400);
    res.send('Invalid formIds');
    return;
  }
  formIds = formIds.split(',');
  if (formIds.length > 10) {
    res.status(400);
    res.send('Max 10 forms');
    return;
  }
  let user;
  // create webhook notification subscription
  try {
    // get existing user
    const userId = decodedToken.id;
    user = await User.findByPk(userId.toString());
    if (!user || !user.accessToken) {
      res.status(401);
      res.send('Authorization required');
      return;
    }
    await checkAndRefreshAccessToken(user);
    await onSubscribe(user, rcWebhookId, rcWebhookUri, formIds);
    res.status(200);
    res.json({
      result: 'ok'
    });
  }
  catch (e) {
    if (e.response && e.response.status === 401) {
      if (user) {
        user.accessToken = '';
        user.refreshToken = '';
        await user.save();
      }
      res.status(401);
      res.send('Unauthorized');
      return;
    }
    console.error(e);
    res.status(500);
    res.send('Internal server error');
    return;
  }
}


async function deleteSubscription(req, res) {
  const jwtToken = req.body.token;
  if (!jwtToken) {
    res.status(403);
    res.send('Params invalid');
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
  const rcWebhookId = getRCWebhookId(rcWebhookUri);
  if (!rcWebhookId) {
    res.status(400);
    res.send('Invalid rcWebhookUri');
    return;
  }

  let formId = req.body.formId;
  if (!formId) {
    res.status(400);
    res.send('Invalid formId');
    return;
  }
  let user;
  try {
    const userId = decodedToken.id;
    user = await User.findByPk(userId.toString());
    if (!user || !user.accessToken) {
      res.status(401);
      res.send('Authorization required');
      return;
    }
    await checkAndRefreshAccessToken(user);
    // remove webhook notification subscription
    await onDeleteSubscription(user, rcWebhookId, formId);
    res.status(200);
    res.json({
      result: 'ok'
    });
  } catch (e) {
    if (e.response && e.response.status === 401) {
      if (user) {
        user.accessToken = '';
        user.refreshToken = '';
        await user.save();
      }
      res.status(401);
      res.send('Unauthorized');
      return;
    }
    console.error(e);
    res.status(500);
    res.send('Internal server error');
  }
}

exports.subscribe = subscribe;
exports.getFormData = getFormData;
exports.deleteSubscription = deleteSubscription;
