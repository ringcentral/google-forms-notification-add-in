const { User } = require('../models/userModel');
const { decodeJwt, generateJwt } = require('../lib/jwt');
const { onAuthorize, onUnauthorize } = require('../handlers/authorizationHandler');
const { checkAndRefreshAccessToken } = require('../lib/oauth');
const { getRCWebhookId } = require('../lib/getRCWebhookId');
const { GoogleClient } = require('../lib/GoogleClient');
const { errorLogger } = require('../lib/logger');

async function openAuthPage(req, res) {
  const url = GoogleClient.authorizationUrl();
  // console.log(`Opening auth page: ${url}`);
  res.redirect(url);
}

async function getUserInfo(req, res) {
  const rcWebhookUri = req.query.rcWebhookUri;
  const rcWebhookId = getRCWebhookId(rcWebhookUri);
  if (!rcWebhookId) {
    res.status(400);
    res.send('Invalid rcWebhookUri.');
    return;
  }
  const userId = req.currentUserId;
  const user = await User.findByPk(userId);
  if (!user || !user.accessToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  try {
    // check token refresh condition
    await checkAndRefreshAccessToken(user);
    // console.log('accessToken: ', user.accessToken);
  } catch (e) {
    if (e.response && e.response.status === 401) {
      user.accessToken = '';
      user.refreshToken = '';
      await user.save();
      res.status(401);
      res.send('Unauthorized.');
      return;
    }
    errorLogger(e);
    res.status(500);
    res.send('Internal error');
    return;
  }
  const subscriptions = user.subscriptions.filter(
    sub => sub.rcWebhookId === rcWebhookId
  );
  res.json({
    user: {
      name: user.name,
    },
    formIds: subscriptions.map(subscription => subscription.formId),
  });
}

async function generateToken(req, res) {
  if (!req.body.callbackUri) {
    res.status(403);
    res.send('params error');
    return;
  }
  try {
    const result = await GoogleClient.getToken(req.body.callbackUri);
    const accessToken = result.access_token;
    if (!accessToken) {
      res.status(403);
      res.send('auth error');
      return;
    }
    const refreshToken = result.refresh_token;
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + result.expires_in);
    const userId = await onAuthorize(accessToken, refreshToken, expires);
    const jwtToken = generateJwt({ id: userId });
    res.status(200);
    res.json({
      authorize: true,
      token: jwtToken,
    });
  } catch (e) {
    if (e.message === 'noCode') {
      res.status(403);
      res.send('code is required');
      return;
    }
    if (e.message === 'authError') {
      res.status(403);
      res.send(e.details);
      return;
    }
    if (e.message === 'invalidScope') {
      res.status(403);
      res.send('invalid scope');
      return;
    }
    errorLogger(e);
    res.status(500);
    res.send('internal error');
  }
}

// This methods is to log user out and unsubscribe everything under this user.
async function revokeToken(req, res) {
  const jwtToken = req.body.token;
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
  try {
    const user = await User.findByPk(userId);
    if (!user || !user.accessToken) {
      res.status(200);
      res.json({
        result: 'ok',
        authorized: false,
      });
      return;
    }
    try {
      await checkAndRefreshAccessToken(user);
    } catch (e) {
      if (e.response && e.response.status === 401) {
        user.accessToken = '';
        user.refreshToken = '';
        await user.save();
        res.status(200);
        res.json({
          result: 'ok',
          authorized: false,
        });
        return;
      }
      throw e;
    }
    await onUnauthorize(user);
    res.status(200);
    res.json({
      result: 'ok',
      authorized: false,
    });
  } catch (e) {
    errorLogger(e);
    res.status(500);
    res.send('internal error');
  }
}

function oauthCallback(req, res) {
  res.render('oauth-callback');
};

exports.openAuthPage = openAuthPage;
exports.getUserInfo = getUserInfo;
exports.generateToken = generateToken;
exports.revokeToken = revokeToken;
exports.oauthCallback = oauthCallback;
