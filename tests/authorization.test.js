const request = require('supertest');
const nock = require('nock');
const axios = require('axios');

const { User } = require('../src/server/models/userModel');
const { Subscription } = require('../src/server/models/subscriptionModel');

const jwt = require('../src/server/lib/jwt');
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

  describe('generate token', () => {
    let userId = 'newGoogleUserId';

    afterAll(async () => {
      await User.destroy({ where: { id: userId } });
    })

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
          sub: userId,
        });
      const res = await request(server).post('/generate-token').send({
        callbackUri: 'http://test.com/oauth-callback?code=test_code',
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorize).toEqual(true);
      const jwtToken = JSON.parse(res.text).token;
      expect(!!jwtToken).toEqual(true);
      const newUser = await User.findByPk(userId);
      expect(newUser.accessToken).toEqual('newAccessToken');
      expect(newUser.refreshToken).toEqual('newRefreshToken');
      expect(newUser.subscriptions.length).toEqual(0);
      googleUserScope.done();
      googleAuthScope.done();
    });

    it('should generate token successfully for existing user', async () => {
      const googleAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(200, {
          access_token: 'newAccessToken1',
          expires_in: 3920,
          scope: '...',
          token_type: 'Bearer',
        });
      const googleUserScope = nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {
          sub: userId,
        });
      const res = await request(server).post('/generate-token').send({
        callbackUri: 'http://test.com/oauth-callback?code=test_code',
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorize).toEqual(true);
      const jwtToken = JSON.parse(res.text).token;
      expect(!!jwtToken).toEqual(true);
      const newUser = await User.findByPk(userId);
      expect(newUser.accessToken).toEqual('newAccessToken1');
      expect(newUser.refreshToken).toEqual('newRefreshToken');
      expect(newUser.subscriptions.length).toEqual(0);
      googleUserScope.done();
      googleAuthScope.done();
    });

    it('should generate token successfully for existing user with refresh token', async () => {
      const googleAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(200, {
          access_token: 'newAccessToken1',
          refresh_token: 'newRefreshToken1',
          expires_in: 3920,
          scope: '...',
          token_type: 'Bearer',
        });
      const googleUserScope = nock('https://www.googleapis.com')
        .get('/oauth2/v3/userinfo')
        .reply(200, {
          sub: userId,
        });
      const res = await request(server).post('/generate-token').send({
        callbackUri: 'http://test.com/oauth-callback?code=test_code',
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorize).toEqual(true);
      const jwtToken = JSON.parse(res.text).token;
      expect(!!jwtToken).toEqual(true);
      const newUser = await User.findByPk(userId);
      expect(newUser.accessToken).toEqual('newAccessToken1');
      expect(newUser.refreshToken).toEqual('newRefreshToken1');
      expect(newUser.subscriptions.length).toEqual(0);
      googleUserScope.done();
      googleAuthScope.done();
    });
  });

  describe('revoke token', () => {
    let user;
    beforeEach(async () => {
      user = await User.create({
        id: 'testGoogleUserId',
        accessToken: 'knownAccessToken',
        refreshToken: 'knownRefreshToken',
        tokenExpiredAt: new Date(Date.now() + 3600 * 1000),
        subscriptions: [],
      });
    });

    afterEach(async () => {
      await user.destroy();
    });

    it('should return 403 without jwtToken when revoke', async () => {
      const res = await request(server).post('/revoke-token');
      expect(res.status).toEqual(403);
      expect(res.text).toContain('Error params');
    });

    it('should return 403 when jwtToken is invalid', async () => {
      const res = await request(server).post('/revoke-token').send({
        token: 'xxx',
      });
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Token invalid.');
    });

    it('should return authorized false when user id is not found', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorized).toEqual(false);
    });

    it('should return authorized false when user does not have token', async () => {
      user.accessToken = '';
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorized).toEqual(false);
    });

    it('should revoke user successfully', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const googleAuthScope = nock('https://oauth2.googleapis.com')
        .post((path) => path.includes('/revoke?token='))
        .reply(200);
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorized).toEqual(false);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('');
      expect(newUser.refreshToken).toEqual('');
      googleAuthScope.done();
    });

    it('should response 500 when revoke token with 502', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const googleAuthScope = nock('https://oauth2.googleapis.com')
        .post((path) => path.includes('/revoke?token='))
        .reply(502);
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(500);
      googleAuthScope.done();
    });

    it('should refresh token firstly before revoke', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const googleAuthScope = nock('https://oauth2.googleapis.com')
        .post((path) => path.includes('/revoke?token='))
        .reply(200);
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(200, {
          access_token: 'newAccessToken',
          expires_in: 3920,
          scope: '',
          token_type: 'Bearer',
        });
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorized).toEqual(false);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('');
      expect(newUser.refreshToken).toEqual('');
      googleAuthScope.done();
      googleRefreshAuthScope.done();
    });

    it('should return authorized false when refresh token with 401', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(401);
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorized).toEqual(false);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('');
      expect(newUser.refreshToken).toEqual('');
      googleRefreshAuthScope.done();
    });

    it('should return 500 when refresh token with 502', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(502);
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(500);
      googleRefreshAuthScope.done();
    });

    it('should revoke user successfully and destroy user subscriptions', async () => {
      const formId = 'test_formId';
      const watchId = 'test_subscriptionId';
      await Subscription.create({
        id: watchId,
        userId: user.id,
        formId,
        rcWebhookId: 'test_rcWebhookId',
      })
      user.subscriptions = [{
        id: watchId,
        formId,
        rcWebhookId: 'test_webhook_id'
      }];
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const googleAuthScope = nock('https://oauth2.googleapis.com')
        .post((path) => path.includes('/revoke?token='))
        .reply(200);
      const googleDestroyWatchScope = nock('https://forms.googleapis.com')
        .delete(`/v1/forms/${formId}/watches/${watchId}`)
        .reply(200);
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorized).toEqual(false);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('');
      expect(newUser.refreshToken).toEqual('');
      expect(newUser.subscriptions.length).toEqual(0);
      const subscription = await Subscription.findByPk(watchId);
      expect(!!subscription).toEqual(false);
      googleAuthScope.done();
      googleDestroyWatchScope.done();
    });

    it('should revoke user successfully even user subscriptions destroy error', async () => {
      const formId = 'test_formId';
      const watchId = 'test_subscriptionId';
      await Subscription.create({
        id: watchId,
        userId: user.id,
        formId,
        rcWebhookId: 'test_rcWebhookId',
      })
      user.subscriptions = [{
        id: watchId,
        formId,
        rcWebhookId: 'test_webhook_id'
      }];
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const googleAuthScope = nock('https://oauth2.googleapis.com')
        .post((path) => path.includes('/revoke?token='))
        .reply(200);
      const googleDestroyWatchScope = nock('https://forms.googleapis.com')
        .delete(`/v1/forms/${formId}/watches/${watchId}`)
        .reply(502);
      const res = await request(server).post('/revoke-token').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).authorized).toEqual(false);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('');
      expect(newUser.refreshToken).toEqual('');
      expect(newUser.subscriptions.length).toEqual(0);
      googleAuthScope.done();
      googleDestroyWatchScope.done();
    });
  });
});
