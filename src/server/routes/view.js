const constants = require('../lib/constants');


// RingCentral notification app developer tool calls this to pass in RC_WEBHOOK

async function setup(req, res) {
  const rcWebhookUri = req.query.webhook;
  res.render('setup', {
    assetsPath: process.env.ASSETS_PATH,
    data: {
      rcWebhookUri,
      authPageUri: `${process.env.APP_SERVER}${constants.route.forClient.OPEN_AUTH_PAGE}`,
      getUserInfoUri: `${process.env.APP_SERVER}${constants.route.forClient.GET_USER_INFO}`,
      getFormDataUri: `${process.env.APP_SERVER}${constants.route.forClient.GET_FORM_DATA}`,
      generateTokenUri: `${process.env.APP_SERVER}${constants.route.forClient.GENERATE_TOKEN}`,
      authRevokeUri: `${process.env.APP_SERVER}${constants.route.forClient.REVOKE_TOKEN}`,
      subscribeUri : `${process.env.APP_SERVER}${constants.route.forClient.SUBSCRIBE}`,
      segmentKey: process.env.SEGMENT_KEY,
    },
  });
}

function home(req, res) {
  res.render('home');
}

exports.setup = setup;
exports.home = home;
