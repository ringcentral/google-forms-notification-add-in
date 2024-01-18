const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const jwt = require('../src/server/lib/jwt');
const { Subscription } = require('../src/server/models/subscriptionModel');
const { User } = require('../src/server/models/userModel');

const formData = require('./mock-data/form.json');

axios.defaults.adapter = 'http';

describe('Subscription', () => {
  let user;
  const {
    origin: googleTokenDomain,
    pathname: googleTokenPath,
  } = new URL(process.env.GOOGLE_ACCESS_TOKEN_URI);
  const mockDomain = 'http://test.com';
  const mockRCWebhookId = 'knownRcWebhookId';
  const mockRCWebhookEndpoint = `/webhook/${mockRCWebhookId}`;
  const mockRCWebhookUri = `${mockDomain}${mockRCWebhookEndpoint}`;

  beforeEach(async () => {
    user = await User.create({
      id: 'testGoogleUserId',
      accessToken: 'knownAccessToken',
      refreshToken: 'knownRefreshToken',
      tokenExpiredAt: new Date(Date.now() + 3600 * 1000),
      subscriptions: [],
      name: 'test user',
    });
  });

  afterEach(async () => {
    await user.destroy();
  });

  describe('get form data', () => {
    it('should return 403 without token', async () => {
      const res = await request(server).get('/get-form-data');
      expect(res.status).toEqual(403);
      expect(res.text).toContain('Error param');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(server).get('/get-form-data?token=xxx');
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Token invalid.');
    });

    it('should return 401 when user id is unknown', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).get(`/get-form-data?token=${jwtToken}`);
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Token invalid.');
    });

    it('should return 401 when user does not have token', async () => {
      user.accessToken = '';
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const res = await request(server).get(`/get-form-data?token=${jwtToken}`);
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Token invalid.');
    });

    it('should return 403 when formIds is not provided', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const res = await request(server).get(`/get-form-data?token=${jwtToken}`);
      expect(res.status).toEqual(403);
      expect(res.text).toContain('Error params');
    });

    it('should return 403 when formIds more than 10', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const formIds = [1,2,3,4,5,6,7,8,9,10,11].join(',');
      const res = await request(server).get(`/get-form-data?token=${jwtToken}&formIds=${formIds}`);
      expect(res.status).toEqual(403);
      expect(res.text).toContain('Too many forms');
    });

    it('should return form data successfully', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const formIds = [mockFormId].join(',');
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const res = await request(server).get(`/get-form-data?token=${jwtToken}&formIds=${formIds}`);
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).forms.length).toEqual(1);
      expect(JSON.parse(res.text).forms[0].id).toEqual(formData.id);
      googleFormScope.done();
    });

    it('should refresh token and return form data successfully', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const formIds = [mockFormId].join(',');
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(200, {
          access_token: 'newAccessToken1',
          expires_in: 3920,
          scope: '',
          token_type: 'Bearer',
        });
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const res = await request(server).get(`/get-form-data?token=${jwtToken}&formIds=${formIds}`);
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).forms.length).toEqual(1);
      expect(JSON.parse(res.text).forms[0].id).toEqual(formData.id);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('newAccessToken1');
      googleRefreshAuthScope.done();
      googleFormScope.done();
    });

    it('should return 401 when refresh token with 401', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const formIds = [mockFormId].join(',');
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(401);
      const res = await request(server).get(`/get-form-data?token=${jwtToken}&formIds=${formIds}`);
      expect(res.status).toEqual(401);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('');
      googleRefreshAuthScope.done();
    });

    it('should return 500 when refresh token with 502', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const formIds = [mockFormId].join(',');
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(502);
      const res = await request(server).get(`/get-form-data?token=${jwtToken}&formIds=${formIds}`);
      expect(res.status).toEqual(500);
      const newUser = await User.findByPk(user.id);
      expect(!!newUser.accessToken).toEqual(true);
      googleRefreshAuthScope.done();
    });
  });

  describe('subscribe', () => {
    it('should return 403 without token', async () => {
      const res = await request(server).post('/subscribe');
      expect(res.status).toEqual(403);
      expect(res.text).toContain('Params invalid');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(server).post('/subscribe').send({
        token: 'invalidToken',
      });
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Token invalid');
    });

    it('should return 400 when no rcWebhookUri', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(400);
      expect(res.text).toContain('Invalid rcWebhookUri');
    });

    it('should return 400 when no rcWebhookId', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: `${mockDomain}/`,
      });
      expect(res.status).toEqual(400);
      expect(res.text).toContain('Invalid rcWebhookUri');
    });

    it('should return 400 when rcWebhookUri invalid', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: 'test.com',
      });
      expect(res.status).toEqual(400);
      expect(res.text).toContain('Invalid rcWebhookUri');
    });

    it('should return 400 when formIds is not provided', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
      });
      expect(res.status).toEqual(400);
      expect(res.text).toContain('Invalid formIds');
    });

    it('should return 400 when formIds is empty', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: '',
      });
      expect(res.status).toEqual(400);
      expect(res.text).toContain('Invalid formIds');
    });

    it('should return 400 when formIds is more than 10', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: [1,2,3,4,5,6,7,8,9,10,11].join(','),
      });
      expect(res.status).toEqual(400);
      expect(res.text).toContain('Max 10 forms');
    });

    it('should return 401 when user id is not found', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: '1234',
      });
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Authorization required');
    });

    it('should return 401 when user token is empty', async () => {
      user.accessToken = '';
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: '1234',
      });
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Authorization required');
    });

    it('should subscribe successfully', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      const googleFormScope = nock('https://forms.googleapis.com')
        .post(`/v1/forms/${mockFormId}/watches`)
        .reply(200, {
          id: mockWatchId,
          expireTime: '2022-01-01T00:00:00.000Z',
          createTime: '2022-01-01T00:00:00.000Z',
        });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toContain('ok');
      const subscription = await Subscription.findByPk(mockWatchId);
      expect(subscription.userId).toEqual(user.id);
      expect(subscription.formId).toEqual(mockFormId);
      expect(subscription.rcWebhookList.length).toEqual(1);
      expect(subscription.rcWebhookList[0].uri).toEqual(mockRCWebhookUri);
      expect(subscription.rcWebhookList[0].id).toEqual(mockRCWebhookId);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual(mockWatchId);
      expect(newUser.subscriptions[0].formId).toEqual(mockFormId);
      expect(newUser.subscriptions[0].rcWebhookId).toEqual(mockRCWebhookId);
      await Subscription.destroy({
        where: { id: mockWatchId },
      });
      googleFormScope.done();
    });

    it('should refresh token and subscribe successfully', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      const googleFormWatchesScope = nock('https://forms.googleapis.com')
        .post(`/v1/forms/${mockFormId}/watches`)
        .reply(200, {
          id: mockWatchId,
          expireTime: '2022-01-01T00:00:00.000Z',
          createTime: '2022-01-01T00:00:00.000Z',
        });
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(200, {
          access_token: 'newAccessToken1',
          expires_in: 3920,
          scope: '',
          token_type: 'Bearer',
        });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toContain('ok');
      const subscription = await Subscription.findByPk(mockWatchId);
      expect(subscription.userId).toEqual(user.id);
      expect(subscription.formId).toEqual(mockFormId);
      expect(subscription.rcWebhookList.length).toEqual(1);
      expect(subscription.rcWebhookList[0].uri).toEqual(mockRCWebhookUri);
      expect(subscription.rcWebhookList[0].id).toEqual(mockRCWebhookId);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('newAccessToken1');
      await Subscription.destroy({
        where: { id: mockWatchId },
      });
      googleFormWatchesScope.done();
      googleRefreshAuthScope.done();
    });

    it('should return 401 when refresh token 401', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(401);
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(401);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('');
      googleRefreshAuthScope.done();
    });

    it('should return 500 when refresh token 502', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(502);
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(500);
      googleRefreshAuthScope.done();
    });

    it('should subscribe successfully with existing subscription', async () => {
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const newExpiredTime = (new Date(Date.now() + 7200 * 1000)).toISOString();
      const googleFormRenewScope = nock('https://forms.googleapis.com')
        .post(`/v1/forms/${mockFormId}/watches/${mockWatchId}:renew`)
        .reply(200, {
          id: mockWatchId,
          expireTime: newExpiredTime,
          createTime: '2022-01-01T00:00:00.000Z',
        });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toContain('ok');
      const subscription = await Subscription.findByPk(mockWatchId);
      expect(subscription.watchExpiredAt).toEqual(new Date(newExpiredTime));
      expect(subscription.rcWebhookList.length).toEqual(1);
      expect(subscription.rcWebhookList[0].id).toEqual(mockRCWebhookId);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual(mockWatchId);
      await Subscription.destroy({
        where: { id: mockWatchId },
      });
      googleFormRenewScope.done();
    });

    it('should subscribe successfully with other subscription', async () => {
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: 'otherWatchId',
        userId: user.id,
        formId: 'otherFormId',
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: 'otherWatchId',
        formId:  'otherFormId',
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const newExpiredTime = (new Date(Date.now() + 7200 * 1000)).toISOString();
      const googleFormWatchesScope = nock('https://forms.googleapis.com')
        .post(`/v1/forms/${mockFormId}/watches`)
        .reply(200, {
          id: mockWatchId,
          expireTime: newExpiredTime,
          createTime: '2022-01-01T00:00:00.000Z',
        });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toContain('ok');
      const subscription = await Subscription.findByPk(mockWatchId);
      expect(subscription.watchExpiredAt).toEqual(new Date(newExpiredTime));
      expect(subscription.rcWebhookList.length).toEqual(1);
      expect(subscription.rcWebhookList[0].uri).toEqual(mockRCWebhookUri);
      expect(subscription.rcWebhookList[0].id).toEqual(mockRCWebhookId);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(2);
      expect(newUser.subscriptions.find(sub => sub.id === mockWatchId).id).toEqual(mockWatchId);
      await Subscription.destroy({
        where: { id: [mockWatchId, 'otherWatchId'] },
      });
      googleFormWatchesScope.done();
    });

    it('should delete expired subscription and subscribe successfully', async () => {
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: 'otherWatchId',
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() - 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: 'otherWatchId',
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const newExpiredTime = (new Date(Date.now() + 7200 * 1000)).toISOString();
      const googleFormWatchesScope = nock('https://forms.googleapis.com')
        .post(`/v1/forms/${mockFormId}/watches`)
        .reply(200, {
          id: mockWatchId,
          expireTime: newExpiredTime,
          createTime: '2022-01-01T00:00:00.000Z',
        });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toContain('ok');
      const subscription = await Subscription.findByPk(mockWatchId);
      expect(subscription.watchExpiredAt).toEqual(new Date(newExpiredTime));
      expect(subscription.rcWebhookList.length).toEqual(1);
      expect(subscription.rcWebhookList[0].uri).toEqual(mockRCWebhookUri);
      expect(subscription.rcWebhookList[0].id).toEqual(mockRCWebhookId);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual(mockWatchId);
      await Subscription.destroy({
        where: { id: [mockWatchId, 'otherWatchId'] },
      });
      googleFormWatchesScope.done();
    });

    it('should keep existing subscription when subscription error', async () => {
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: 'otherWatchId',
        userId: user.id,
        formId: 'otherFormId',
        rcWebhookList: [{
          id: 'otherWebhookId',
          uri: 'otherWebhookUri',
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: 'otherWatchId',
        formId: 'otherFormId',
        rcWebhookId: 'otherWebhookId',
      }];
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const newExpiredTime = (new Date(Date.now() + 7200 * 1000)).toISOString();
      const googleFormWatchesScope = nock('https://forms.googleapis.com')
        .post(`/v1/forms/${mockFormId}/watches`)
        .reply(502, {
          id: mockWatchId,
          expireTime: newExpiredTime,
          createTime: '2022-01-01T00:00:00.000Z',
        });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toContain('ok');
      const subscription = await Subscription.findByPk(mockWatchId);
      expect(!!subscription).toEqual(false);
      const otherSubscription = await Subscription.findByPk('otherWatchId');
      expect(!!otherSubscription).toEqual(true);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual('otherWatchId');
      await Subscription.destroy({
        where: { id: 'otherWatchId' },
      });
      googleFormWatchesScope.done();
    });

    it('should subscribe successfully with existing subscription and different webhook id', async () => {
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: 'otherWebhookId',
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: 'otherWebhookId',
      }];
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const newExpiredTime = (new Date(Date.now() + 7200 * 1000)).toISOString();
      const googleFormRenewScope = nock('https://forms.googleapis.com')
        .post(`/v1/forms/${mockFormId}/watches/${mockWatchId}:renew`)
        .reply(200, {
          id: mockWatchId,
          expireTime: newExpiredTime,
          createTime: '2022-01-01T00:00:00.000Z',
        });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toContain('ok');
      const subscription = await Subscription.findByPk(mockWatchId);
      expect(subscription.watchExpiredAt).toEqual(new Date(newExpiredTime));
      expect(subscription.rcWebhookList.length).toEqual(2);
      expect(subscription.rcWebhookList[1].id).toEqual('otherWebhookId');
      expect(subscription.rcWebhookList[0].id).toEqual(mockRCWebhookId);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(2);
      expect(newUser.subscriptions[0].id).toEqual(mockWatchId);
      expect(newUser.subscriptions[0].rcWebhookId).toEqual(mockRCWebhookId);
      expect(newUser.subscriptions[1].id).toEqual(mockWatchId);
      expect(newUser.subscriptions[1].rcWebhookId).toEqual('otherWebhookId');
      await Subscription.destroy({
        where: { id: mockWatchId },
      });
      googleFormRenewScope.done();
    });

    it('should subscribe successfully when subscription not found', async () => {
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      user.subscriptions = [{
        id: 'otherWatchId',
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const newExpiredTime = (new Date(Date.now() + 7200 * 1000)).toISOString();
      const googleFormWatchScope = nock('https://forms.googleapis.com')
        .post(`/v1/forms/${mockFormId}/watches`)
        .reply(200, {
          id: mockWatchId,
          expireTime: newExpiredTime,
          createTime: '2022-01-01T00:00:00.000Z',
        });
      const res = await request(server).post('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formIds: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toContain('ok');
      const subscription = await Subscription.findByPk(mockWatchId);
      expect(subscription.watchExpiredAt).toEqual(new Date(newExpiredTime));
      expect(subscription.rcWebhookList.length).toEqual(1);
      expect(subscription.rcWebhookList[0].id).toEqual(mockRCWebhookId);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual(mockWatchId);
      await Subscription.destroy({
        where: { id: mockWatchId },
      });
      googleFormWatchScope.done();
    });
  });

  describe('delete subscription', () => {
    it('should return 403 without token', async () => {
      const res = await request(server).delete('/subscribe');
      expect(res.status).toEqual(403);
      expect(res.text).toContain('Params invalid');
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(server).delete('/subscribe').send({
        token: 'invalidToken',
      });
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Token invalid');
    });

    it('should return 400 when no rcWebhookUri', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
      });
      expect(res.status).toEqual(400);
      expect(res.text).toContain('Invalid rcWebhookUri');
    });

    it('should return 400 when no formId', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
      });
      expect(res.status).toEqual(400);
      expect(res.text).toContain('Invalid formId');
    });

    it('should return 401 when user id is not found', async () => {
      const jwtToken = jwt.generateJwt({
        id: 'unknownUserId',
      });
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: '1234',
      });
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Authorization required');
    });

    it('should return 401 when user does not have token', async () => {
      user.accessToken = '';
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: '1234',
      });
      expect(res.status).toEqual(401);
      expect(res.text).toContain('Authorization required');
    });

    it('should delete subscription successfully', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }, {
        id: 'mockWatchId2',
        formId: 'mockFormId2',
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const googleFormWatchDeleteScope = nock('https://forms.googleapis.com')
        .delete(`/v1/forms/${mockFormId}/watches/${mockWatchId}`)
        .reply(200);
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toEqual('ok');
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual('mockWatchId2');
      googleFormWatchDeleteScope.done();
    });

    it('should update user subscriptions when subscription is not found', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }, {
        id: 'mockWatchId2',
        formId: 'mockFormId2',
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toEqual('ok');
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual('mockWatchId2');
    });

    it('should delete subscription successfully if subscription is expired', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() - 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toEqual('ok');
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(0);
    });

    it('should delete subscription successfully and keep other subscriptions', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }, {
        id: 'otherWatchId',
        formId: 'otherFormId',
        rcWebhookId: 'otherRcWebhookId',
      }];
      await user.save();
      const googleFormWatchDeleteScope = nock('https://forms.googleapis.com')
        .delete(`/v1/forms/${mockFormId}/watches/${mockWatchId}`)
        .reply(200);
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toEqual('ok');
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual('otherWatchId');
      googleFormWatchDeleteScope.done();
    });

    it('should only delete subscription, not delete watch when there are other webhook', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }, {
          id: 'otherRcWebhookId',
          uri: 'otherRcWebhookUri',
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }, {
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: 'otherRcWebhookId',
      }];
      await user.save();
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toEqual('ok');
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      const newSubscription = await Subscription.findByPk(mockWatchId);
      expect(newSubscription.rcWebhookList.length).toEqual(1);
      expect(newSubscription.rcWebhookList[0].id).toEqual('otherRcWebhookId');
      await Subscription.destroy({ where: { id: mockWatchId } });
    });

    it('should refresh token and delete subscription successfully', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(200, {
          access_token: 'newAccessToken1',
          expires_in: 3920,
          scope: '',
          token_type: 'Bearer',
        });
      const googleFormWatchDeleteScope = nock('https://forms.googleapis.com')
        .delete(`/v1/forms/${mockFormId}/watches/${mockWatchId}`)
        .reply(200);
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: mockFormId,
      });
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).result).toEqual('ok');
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(0);
      expect(newUser.accessToken).toEqual('newAccessToken1');
      googleRefreshAuthScope.done();
      googleFormWatchDeleteScope.done();
    });

    it('should return 401 when refresh token 401', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(401);
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: mockFormId,
      });
      expect(res.status).toEqual(401);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.accessToken).toEqual('');
      googleRefreshAuthScope.done();
      await Subscription.destroy({
        where: {
          id: mockWatchId,
        },
      });
    });

    it('should return 500 when refresh token 502', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const mockWatchId = 'mockWatchId';
      await Subscription.create({
        id: mockWatchId,
        userId: user.id,
        formId: mockFormId,
        rcWebhookList: [{
          id: mockRCWebhookId,
          uri: mockRCWebhookUri,
          active: true,
        }],
        watchExpiredAt: new Date(Date.now() + 3600 * 1000),
        messageReceivedAt: new Date(),
      });
      user.subscriptions = [{
        id: mockWatchId,
        formId: mockFormId,
        rcWebhookId: mockRCWebhookId,
      }];
      await user.save();
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(502);
      const res = await request(server).delete('/subscribe').send({
        token: jwtToken,
        rcWebhookUri: mockRCWebhookUri,
        formId: mockFormId,
      });
      expect(res.status).toEqual(500);
      const newUser = await User.findByPk(user.id);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(!!newUser.accessToken).toEqual(true);
      googleRefreshAuthScope.done();
      await Subscription.destroy({
        where: {
          id: mockWatchId,
        },
      });
    });
  });
});
