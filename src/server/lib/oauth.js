const { GoogleClient } = require('./GoogleClient');

async function checkAndRefreshAccessToken(user) {
  const dateNow = new Date();
  if (user && user.accessToken && user.refreshToken && user.tokenExpiredAt < dateNow) {
    // console.log('refreshing token');
    const response = await GoogleClient.refreshToken(user.refreshToken);
    const accessToken = response.access_token;
    const expires = new Date();
    expires.setSeconds(expires.getSeconds() + response.expires_in);
    user.accessToken = accessToken;
    user.tokenExpiredAt = expires;
    user.name = ''; // clear user name
    await user.save();
  }
}

exports.checkAndRefreshAccessToken = checkAndRefreshAccessToken;
