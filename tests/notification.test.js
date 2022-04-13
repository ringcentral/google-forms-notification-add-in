const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const { Subscription } = require('../src/server/models/subscriptionModel');
const { User } = require('../src/server/models/userModel');

const formData = require('./mock-data/form.json');
const formResponsesData = require('./mock-data/responses.json');
const questionGroupFormData = require('./mock-data/questionGroupForm.json');
const questionGroupFormResponsesData = require('./mock-data/questionGroupFormResponses.json');

axios.defaults.adapter = require('axios/lib/adapters/http');

// Example tests
describe('Notification', () => {

  const mockDomain = 'http://test.com';
  const mockRCWebhookId = 'knownRcWebhookId';
  const mockRcWebhookEndpoint = `/webhook/${mockRCWebhookId}`;
  const mockWatchId = 'knownWatchId';
  const mockUserId  = 'knownUserId';
  const mockFormId = 'knownFormId';
  const mockMessagePublishTime = '2021-03-31T01:34:08.053Z';
  let subscription;

  beforeEach(async () => {
    // Mock data on subscriptions table
    subscription = await Subscription.create({
      id: mockWatchId,
      userId: mockUserId,
      formId: mockFormId,
      rcWebhookList: [{
        id: mockRCWebhookId,
        uri: `${mockDomain}${mockRcWebhookEndpoint}`,
        active: true,
      }],
    });
  });

  afterEach(async () => {
    // Clean up
    await Subscription.destroy({
      where: {
        id: mockWatchId,
      }
    });
  });

  describe('without google user', () => {
    it('should get 404 with wrong webhook id', async () => {
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: 'unknownWatchId',
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(404);
    });

    it('should get 400 with error if get error payload', async () => {
      const res = await request(server).post('/notification').send({});
      expect(res.status).toEqual(400);
    });
  
    it('should get 400 with error if no publishTime payload', async () => {
      const res = await request(server).post('/notification').send({
        message: {},
      });
      expect(res.status).toEqual(400);
    });

    it('should get 400 with error if no attributes payload', async () => {
      const res = await request(server).post('/notification').send({
        message: {},
        publishTime: mockMessagePublishTime,
      });
      expect(res.status).toEqual(400);
    });

    it('should get 400 with error if no watchId payload', async () => {
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {},
        },
        publishTime: mockMessagePublishTime,
      });
      expect(res.status).toEqual(400);
    });
  
    it('should get 200 when google user is not existed', async () => {
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
    });
  });

  describe('with google user', () => {
    let user;
    const {
      origin: googleTokenDomain,
      pathname: googleTokenPath,
    } = new URL(process.env.GOOGLE_ACCESS_TOKEN_URI);
    beforeEach(async () => {
      user = await User.create({
        id: mockUserId,
        accessToken: 'knownAccessToken',
        refreshToken: 'knownRefreshToken',
        tokenExpiredAt: new Date(Date.now() + 3600 * 1000),
        subscriptions: [],
      });
    });

    afterEach(async () => {
      await user.destroy();
    });

    it('should get 200 when user does not have access token ' , async () => {
      user.accessToken = '';
      await user.save();
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
    });

    it('should get 200 when refresh token with 401' , async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(401);
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      const newUser = await User.findByPk(mockUserId);
      expect(newUser.accessToken).toEqual('');
      googleRefreshAuthScope.done();
    });

    it('should get 200 when refresh token with 500' , async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(500);
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('error');
      const newUser = await User.findByPk(mockUserId);
      expect(newUser.accessToken).toEqual('knownAccessToken');
      googleRefreshAuthScope.done();
    });

    it('should get 200 when request form api with 401', async () => {
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(401);
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      const newUser = await User.findByPk(mockUserId);
      expect(newUser.accessToken).toEqual('');
      googleFormScope.done();
    });

    it('should get 200 when request form api with 502', async () => {
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(502);
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('error');
      googleFormScope.done();
    });

    it('should send card to webhook uri successfully', async () => {
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const googleFormResponseScope = nock('https://forms.googleapis.com')
        .get(uri => uri.includes(`/v1/forms/${mockFormId}/responses`))
        .reply(200, formResponsesData);
      const webhookScope = nock(mockDomain)
        .post(mockRcWebhookEndpoint)
        .reply(200, { result: 'OK' });
      let requestBody = null;
      webhookScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
      const newSubscription = await Subscription.findByPk(mockWatchId);
      expect((new Date(newSubscription.messageReceivedAt)).getTime()).toEqual((new Date(mockMessagePublishTime)).getTime());
      googleFormScope.done();
      googleFormResponseScope.done();
      webhookScope.done();
    });

    it('should send card to multiple webhook uri successfully', async () => {
      subscription.rcWebhookList = [
        ...subscription.rcWebhookList,
        {
          id: 'otherRcWebhookId',
          uri: `${mockDomain}/webhook/otherRcWebhookId`,
          active: true,
        },
      ];
      await subscription.save();
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const googleFormResponseScope = nock('https://forms.googleapis.com')
        .get(uri => uri.includes(`/v1/forms/${mockFormId}/responses`))
        .reply(200, formResponsesData);
      const webhookScope = nock(mockDomain)
        .post(mockRcWebhookEndpoint)
        .reply(200, { result: 'OK' });
      const webhookScope1 = nock(mockDomain)
        .post(`/webhook/otherRcWebhookId`)
        .reply(200, { result: 'OK' });
      let requestBody = null;
      webhookScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      let requestBody1 = null;
      webhookScope1.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody1 = JSON.parse(reqBody);
      });
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
      expect(requestBody1.attachments[0].type).toContain('AdaptiveCard');
      const newSubscription = await Subscription.findByPk(mockWatchId);
      expect((new Date(newSubscription.messageReceivedAt)).getTime()).toEqual((new Date(mockMessagePublishTime)).getTime());
      googleFormScope.done();
      googleFormResponseScope.done();
      webhookScope.done();
      webhookScope1.done();
    });

    it('should set webhook inactive when webhook response with not found', async () => {
      subscription.rcWebhookList = [
        ...subscription.rcWebhookList,
        {
          id: 'otherRcWebhookId',
          uri: `${mockDomain}/webhook/otherRcWebhookId`,
          active: true,
        },
      ]
      await subscription.save();
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const googleFormResponseScope = nock('https://forms.googleapis.com')
        .get(uri => uri.includes(`/v1/forms/${mockFormId}/responses`))
        .reply(200, formResponsesData);
      const webhookScope = nock(mockDomain)
        .post(mockRcWebhookEndpoint)
        .reply(200, { result: 'OK' });
      const webhookScope1 = nock(mockDomain)
        .post(`/webhook/otherRcWebhookId`)
        .reply(200, { error: `Webhook not found! otherRcWebhookId` });
      let requestBody = null;
      webhookScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      let requestBody1 = null;
      webhookScope1.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody1 = JSON.parse(reqBody);
      });
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
      expect(requestBody1.attachments[0].type).toContain('AdaptiveCard');
      const newSubscription = await Subscription.findByPk(mockWatchId);
      expect((new Date(newSubscription.messageReceivedAt)).getTime()).toEqual((new Date(mockMessagePublishTime)).getTime());
      expect(newSubscription.rcWebhookList.length).toEqual(2);
      expect(newSubscription.rcWebhookList.find(item => item.id === 'otherRcWebhookId').active).toEqual(false);
      googleFormScope.done();
      googleFormResponseScope.done();
      webhookScope.done();
      webhookScope1.done();
    });

    it('should destroy subscription when all webhooks inactive', async () => {
      subscription.rcWebhookList = [
        ...subscription.rcWebhookList,
        {
          id: 'otherRcWebhookId',
          uri: `${mockDomain}/webhook/otherRcWebhookId`,
          active: true,
        },
      ]
      await subscription.save();
      user.subscriptions = [{
        id: mockWatchId,
        rcWebhookId: mockRCWebhookId,
        formId: mockFormId,
      }, {
        id: mockWatchId,
        rcWebhookId: 'otherRcWebhookId',
        formId: mockFormId,
      }, {
        id: 'otherWatchId',
        rcWebhookId: mockRCWebhookId,
        formId: 'otherFormId',
      }];
      await user.save();
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const googleFormResponseScope = nock('https://forms.googleapis.com')
        .get(uri => uri.includes(`/v1/forms/${mockFormId}/responses`))
        .reply(200, formResponsesData);
      const googleFormWatchDeleteScope = nock('https://forms.googleapis.com')
        .delete(`/v1/forms/${mockFormId}/watches/${mockWatchId}`)
        .reply(200);
      const webhookScope = nock(mockDomain)
        .post(mockRcWebhookEndpoint)
        .reply(200, { error: `Webhook not found! ${mockRCWebhookId}` });
      const webhookScope1 = nock(mockDomain)
        .post(`/webhook/otherRcWebhookId`)
        .reply(200, { error: `Webhook not found! otherRcWebhookId` });
      let requestBody = null;
      webhookScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      let requestBody1 = null;
      webhookScope1.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody1 = JSON.parse(reqBody);
      });
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
      expect(requestBody1.attachments[0].type).toContain('AdaptiveCard');
      const newSubscription = await Subscription.findByPk(mockWatchId);
      expect(!!newSubscription).toEqual(false);
      const newUser = await User.findByPk(mockUserId);
      expect(newUser.subscriptions.length).toEqual(1);
      expect(newUser.subscriptions[0].id).toEqual('otherWatchId');
      googleFormScope.done();
      googleFormResponseScope.done();
      webhookScope.done();
      webhookScope1.done();
      googleFormWatchDeleteScope.done();
    });

    it('should send card to webhook uri when rcWebhookList is empty', async () => {
      subscription.rcWebhookList = null;
      subscription.rcWebhookUri = `${mockDomain}${mockRcWebhookEndpoint}`;
      await subscription.save();
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const googleFormResponseScope = nock('https://forms.googleapis.com')
        .get(uri => uri.includes(`/v1/forms/${mockFormId}/responses`))
        .reply(200, formResponsesData);
      const webhookScope = nock(mockDomain)
        .post(mockRcWebhookEndpoint)
        .reply(200, { result: 'OK' });
      let requestBody = null;
      webhookScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
      const newSubscription = await Subscription.findByPk(mockWatchId);
      expect((new Date(newSubscription.messageReceivedAt)).getTime()).toEqual((new Date(mockMessagePublishTime)).getTime());
      googleFormScope.done();
      googleFormResponseScope.done();
      webhookScope.done();
    });

    it('should send card to webhook uri successfully with form documentTitle', async () => {
      const newFormData = JSON.parse(JSON.stringify(formData));
      delete newFormData.info.description;
      delete newFormData.info.title;
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, newFormData);
      const googleFormResponseScope = nock('https://forms.googleapis.com')
        .get(uri => uri.includes(`/v1/forms/${mockFormId}/responses`))
        .reply(200, formResponsesData);
      const webhookScope = nock(mockDomain)
        .post(mockRcWebhookEndpoint)
        .reply(200, { result: 'OK' });
      let requestBody = null;
      webhookScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
      const newSubscription = await Subscription.findByPk(mockWatchId);
      expect((new Date(newSubscription.messageReceivedAt)).getTime()).toEqual((new Date(mockMessagePublishTime)).getTime());
      googleFormScope.done();
      googleFormResponseScope.done();
      webhookScope.done();
    });

    it('should send card to webhook uri successfully for question group item form', async () => {
      const newPublishTime = '2021-03-31T02:34:08.053Z';
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, questionGroupFormData);
      const googleFormResponseScope = nock('https://forms.googleapis.com')
        .get(uri => uri.includes(`/v1/forms/${mockFormId}/responses`))
        .reply(200, questionGroupFormResponsesData);
      const webhookScope = nock(mockDomain)
        .post(mockRcWebhookEndpoint)
        .reply(200, { result: 'OK' });
      let requestBody = null;
      webhookScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: newPublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
      const newSubscription = await Subscription.findByPk(mockWatchId);
      expect((new Date(newSubscription.messageReceivedAt)).getTime()).toEqual((new Date(newPublishTime)).getTime());
      googleFormScope.done();
      googleFormResponseScope.done();
      webhookScope.done();
    });

    it('should refresh token and send card to webhook uri successfully', async () => {
      user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
      await user.save();
      const googleRefreshAuthScope = nock(googleTokenDomain)
        .post(googleTokenPath)
        .reply(200, {
          access_token: 'newAccessToken',
          expires_in: 3920,
          scope: '',
          token_type: 'Bearer',
        });
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const googleFormResponseScope = nock('https://forms.googleapis.com')
        .get(uri => uri.includes(`/v1/forms/${mockFormId}/responses`))
        .reply(200, formResponsesData);
      const webhookScope = nock(mockDomain)
        .post(mockRcWebhookEndpoint)
        .reply(200, { result: 'OK' });
      let requestBody = null;
      webhookScope.once('request', ({ headers: requestHeaders }, interceptor, reqBody) => {
        requestBody = JSON.parse(reqBody);
      });
      const res = await request(server).post('/notification').send({
        message: {
          attributes: {
            watchId: mockWatchId,
          },
          publishTime: mockMessagePublishTime,
        },
      });
      expect(res.status).toEqual(200);
      expect(res.body.result).toEqual('ok');
      expect(requestBody.attachments[0].type).toContain('AdaptiveCard');
      const newUser = await User.findByPk(mockUserId);
      expect(newUser.accessToken).toEqual('newAccessToken');
      googleRefreshAuthScope.done();
      googleFormScope.done();
      googleFormResponseScope.done();
      webhookScope.done();
    });
  });
});
