const request = require('supertest');
const nock = require('nock');
const axios = require('axios');

const { User } = require('../src/server/models/userModel');

const { server } = require('../src/server');

axios.defaults.adapter = require('axios/lib/adapters/http');


describe('Authorization', () => {
  const {
    origin: googleTokenDomain,
    pathname: googleTokenPath,
  } = new URL(process.env.GOOGLE_ACCESS_TOKEN_URI);

  it('should redirect to Google authorization page', async () => {
    const res = await request(server).get('/open-auth-page');
    expect(res.status).toEqual(302);
    expect(res.headers.location).toContain(process.env.GOOGLE_AUTHORIZATION_URI);
    expect(res.headers.location).toContain(process.env.GOOGLE_CLIENT_ID);
  });

  it('should render oauth callback page successfully', async () => {
    const res = await request(server).get('/oauth-callback');
    expect(res.status).toEqual(200);
    expect(res.text).toContain('Google Form Add-in OAuth Callback');
  });

  it('should send no callbackUri error', async () => {
    const res = await request(server).post('/generate-token');
    expect(res.status).toEqual(403);
    expect(res.text).toContain('params error');
  });

  it('should send auth error', async () => {
    const res = await request(server).post('/generate-token').send({
      callbackUri: 'http://test.com/oauth-callback?error=user_deny',
    });
    expect(res.status).toEqual(403);
    expect(res.text).toContain('user_deny');
  });

  it('should send no code error', async () => {
    const res = await request(server).post('/generate-token').send({
      callbackUri: 'http://test.com/oauth-callback',
    });
    expect(res.status).toEqual(403);
    expect(res.text).toContain('code is required');
  });

  it('should send auth error when token api without token', async () => {
    const googleAuthScope = nock(googleTokenDomain)
      .post(googleTokenPath)
      .reply(200, {});
    const res = await request(server).post('/generate-token').send({
      callbackUri: 'http://test.com/oauth-callback?code=test_code',
    });
    expect(res.status).toEqual(403);
    expect(res.text).toContain('auth error');
    googleAuthScope.done();
  });

  it('should send internal error when token api return 502', async () => {
    const googleAuthScope = nock(googleTokenDomain)
      .post(googleTokenPath)
      .reply(502);
    const res = await request(server).post('/generate-token').send({
      callbackUri: 'http://test.com/oauth-callback?code=test_code',
    });
    expect(res.status).toEqual(500);
    expect(res.text).toContain('internal error');
    googleAuthScope.done();
  });

  it('should generate token successfully', async () => {
    const googleAuthScope = nock(googleTokenDomain)
      .post(googleTokenPath)
      .reply(200, {
        access_token: 'newAccessToken',
        expires_in: 3920,
        scope: '...',
        refresh_token: 'newRefreshToken',
        token_type: 'Bearer',
      });
    const googleUserScope = nock('https://www.googleapis.com')
      .get('/oauth2/v3/userinfo')
      .reply(200, {
        sub: 'newGoogleUserId',
      });
    const res = await request(server).post('/generate-token').send({
      callbackUri: 'http://test.com/oauth-callback?code=test_code',
    });
    expect(res.status).toEqual(200);
    expect(JSON.parse(res.text).authorize).toEqual(true);
    expect(!!JSON.parse(res.text).token).toEqual(true);
    const newUser = await User.findByPk('newGoogleUserId');
    expect(newUser.accessToken).toEqual('newAccessToken');
    expect(newUser.refreshToken).toEqual('newRefreshToken');
    expect(newUser.subscriptions.length).toEqual(0);
    googleUserScope.done();
    googleAuthScope.done();
  });
});
