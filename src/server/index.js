const path = require('path');
const express = require('express');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const authorizationRoute = require('./routes/authorization');
const subscriptionRoute = require('./routes/subscription');
const notificationRoute = require('./routes/notification');
const maintainRoute = require('./routes/maintain');

const viewRoute = require('./routes/view');
const constants = require('./lib/constants');
const { checkAuth } = require('./middlewares/auth');
const { refererChecker } = require('./lib/refererChecker');

const app = express()
app.use(morgan(function (tokens, req, res) {
  let url = tokens.url(req, res);
  const rcWebhookUri = req.query.rcWebhookUri || req.query.webhook;
  if (rcWebhookUri) {
    const webhookId = rcWebhookUri.split('/').pop();
    if (webhookId) {
      url = url.replace(webhookId, '[MASK]');
    }
  }
  const code = req.query.code;
  if (code) {
    url = url.replace(code, '[MASK]');
  }
  if (url.indexOf('/get-form-data') === 0) {
    const formIds = req.query.formIds;
    if (formIds) {
      url = url.replace(formIds, '[MASK]');
    }
  }
  return [
    tokens.method(req, res),
    url,
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ].join(' ');
}));
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.set('views', path.resolve(__dirname, './views'));
app.set('view engine', 'pug');

// setup client
app.get(constants.route.forClient.CLIENT_SETUP, viewRoute.setup);
// authorization
app.get(constants.route.forClient.OPEN_AUTH_PAGE, authorizationRoute.openAuthPage);
app.get(constants.route.forThirdParty.AUTH_CALLBACK, authorizationRoute.oauthCallback);
app.get(constants.route.forClient.GET_USER_INFO, refererChecker, checkAuth, authorizationRoute.getUserInfo);
app.post(constants.route.forClient.GENERATE_TOKEN, refererChecker, authorizationRoute.generateToken);
// revoke
app.post(constants.route.forClient.REVOKE_TOKEN, refererChecker, authorizationRoute.revokeToken);
// configure
app.post(constants.route.forClient.SUBSCRIBE, refererChecker, subscriptionRoute.subscribe);
app.delete(constants.route.forClient.SUBSCRIBE, refererChecker, subscriptionRoute.deleteSubscription);
app.get(constants.route.forClient.GET_FORM_DATA, refererChecker, checkAuth, subscriptionRoute.getFormData);
// notification
app.post(constants.route.forThirdParty.NOTIFICATION, notificationRoute.notification);
// Home page
app.get('/home', viewRoute.home);
app.get('/maintain/remove-user-name', maintainRoute.removeUserName);

if (process.env.GOOGLE_SITE_VERIFICATION_TOKEN) {
  app.get(`/${process.env.GOOGLE_SITE_VERIFICATION_TOKEN}.html`, (req, res) => {
    res.send(`google-site-verification: ${process.env.GOOGLE_SITE_VERIFICATION_TOKEN}.html`);
  });
}
app.get('/', viewRoute.home);

exports.app = app;
