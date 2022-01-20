const { User } = require('../models/userModel');
const { Subscription } = require('../models/subscriptionModel');
const { decodeJwt, generateJwt } = require('../lib/jwt');
const { onAuthorize, onUnauthorize } = require('../handlers/authorizationHandler');
const { checkAndRefreshAccessToken, getOAuthApp } = require('../lib/oauth');

async function openAuthPage(req, res) {
  try {
    const oauthApp = getOAuthApp();
    const url = oauthApp.code.getUri({
      query: {
        access_type: 'offline',
        include_granted_scopes: 'true',
      }
    });
    console.log(`Opening auth page: ${url}`);
    res.redirect(url);
  } catch (e) {
    console.error(e);
  }
}

async function getUserInfo(req, res) {
  const jwtToken = req.query.token;
  const rcWebhookUri = req.query.rcWebhookUri;
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
  const user = await User.findByPk(userId);
  if (!user || !user.accessToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  try {
    // check token refresh condition
    await checkAndRefreshAccessToken(user);
    console.log('accessToken: ', user.accessToken);
  } catch (e) {
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
  const subscriptions = await Subscription.findAll({
    where: {
      userId: user.id,
      rcWebhookUri: rcWebhookUri,
    }
  });
  // const subscription = await Subscription.findOne({
  //   where: {
  //     rcWebhookUri: rcWebhookUri
  //   }
  // });
  res.json({
    user: {
      name: user.name,
    },
    formIds: subscriptions.map(subscription => subscription.formId),
  });
}

async function generateToken(req, res) {
  const oauthApp = getOAuthApp();
  const result = await oauthApp.code.getToken(req.body.callbackUri);
  console.log(result);
  const { accessToken, refreshToken, expires } = result;
  if (!accessToken) {
    res.status(403);
    res.send('Params error');
    return;
  }
  try {
    const userId = await onAuthorize(accessToken, refreshToken, expires);
    const jwtToken = generateJwt({ id: userId });
    res.status(200);
    res.json({
      authorize: true,
      token: jwtToken,
    });
  } catch (e) {
    console.error(e);
    res.status(500);
    res.send('Internal error.');
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
    await onUnauthorize(userId);
    res.status(200);
    res.json({
      result: 'ok',
      authorized: false,
    });
  } catch (e) {
    console.error(e);
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