const nock = require('nock');
const axios = require('axios');

const { Subscription } = require('../src/server/models/subscriptionModel');
const { User } = require('../src/server/models/userModel');
const { refresh } = require('../src/refreshSubscriptionCron');

axios.defaults.adapter = 'http';

describe('Refresh cron', () => {
  let user;
  const mockDomain = 'http://test.com';
  const mockRCWebhookId = 'knownRcWebhookId';
  const mockRCWebhookEndpoint = `/webhook/${mockRCWebhookId}`;
  const mockRCWebhookUri = `${mockDomain}${mockRCWebhookEndpoint}`;
  const {
    origin: googleTokenDomain,
    pathname: googleTokenPath,
  } = new URL(process.env.GOOGLE_ACCESS_TOKEN_URI);

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

  it('should refresh subscription successfully', async () => {
    const mockFormId = 'mockFormId';
    const mockWatchId = 'mockWatchId';
    await Subscription.create({
      id: mockWatchId,
      userId: user.id,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: new Date(Date.now() + 3600 * 1000),
      messageReceivedAt: new Date(),
    });
    user.subscriptions = [{
      id: mockWatchId,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
    }];
    await user.save();
    const newExpiredTime = (new Date(Date.now() + 3600 * 1000 * 24 * 7)).toISOString();
    const googleFormRenewScope = nock('https://forms.googleapis.com')
      .post(`/v1/forms/${mockFormId}/watches/${mockWatchId}:renew`)
      .reply(200, {
        id: mockWatchId,
        expireTime: newExpiredTime,
        createTime: '2022-01-01T00:00:00.000Z',
      });
    await refresh();
    const subscription = await Subscription.findByPk(mockWatchId);
    expect(subscription.watchExpiredAt).toEqual(new Date(newExpiredTime));
    googleFormRenewScope.done();
    await Subscription.destroy({
      where: { id: mockWatchId },
    });
  });

  it('should not refresh expired subscription', async () => {
    const mockFormId = 'mockFormId';
    const mockWatchId = 'mockWatchId';
    const oldExpiredTime = new Date(Date.now() - 3600 * 1000);
    await Subscription.create({
      id: mockWatchId,
      userId: user.id,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: oldExpiredTime,
      messageReceivedAt: new Date(),
    });
    user.subscriptions = [{
      id: mockWatchId,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
    }];
    await user.save();
    await refresh();
    const subscription = await Subscription.findByPk(mockWatchId);
    expect(subscription.watchExpiredAt).toEqual(oldExpiredTime);
    await Subscription.destroy({
      where: { id: mockWatchId },
    });
  });

  it('should not refresh subscription which alive more than 3 day', async () => {
    const mockFormId = 'mockFormId';
    const mockWatchId = 'mockWatchId';
    const expiredTime = new Date(Date.now() + (3 * 24 + 1) * 3600 * 1000);
    await Subscription.create({
      id: mockWatchId,
      userId: user.id,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: expiredTime,
      messageReceivedAt: new Date(),
    });
    user.subscriptions = [{
      id: mockWatchId,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
    }];
    await user.save();
    await refresh();
    const subscription = await Subscription.findByPk(mockWatchId);
    expect(subscription.watchExpiredAt).toEqual(expiredTime);
    await Subscription.destroy({
      where: { id: mockWatchId },
    });
  });

  it('should not refresh subscription when user logout', async () => {
    const mockFormId = 'mockFormId';
    const mockWatchId = 'mockWatchId';
    const expiredTime = new Date(Date.now() + 3600 * 1000);
    await Subscription.create({
      id: mockWatchId,
      userId: user.id,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: expiredTime,
      messageReceivedAt: new Date(),
    });
    user.subscriptions = [{
      id: mockWatchId,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
    }];
    user.accessToken = '';
    await user.save();
    await refresh();
    const subscription = await Subscription.findByPk(mockWatchId);
    expect(subscription.watchExpiredAt).toEqual(expiredTime);
    await Subscription.destroy({
      where: { id: mockWatchId },
    });
  });

  it('should refresh token then refresh subscription successfully', async () => {
    const mockFormId = 'mockFormId';
    const mockWatchId = 'mockWatchId';
    await Subscription.create({
      id: mockWatchId,
      userId: user.id,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: new Date(Date.now() + 3600 * 1000),
      messageReceivedAt: new Date(),
    });
    user.subscriptions = [{
      id: mockWatchId,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
    }];
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
    const newExpiredTime = (new Date(Date.now() + 3600 * 1000 * 24 * 7)).toISOString();
    const googleFormRenewScope = nock('https://forms.googleapis.com')
      .post(`/v1/forms/${mockFormId}/watches/${mockWatchId}:renew`)
      .reply(200, {
        id: mockWatchId,
        expireTime: newExpiredTime,
        createTime: '2022-01-01T00:00:00.000Z',
      });
    await refresh();
    const subscription = await Subscription.findByPk(mockWatchId);
    expect(subscription.watchExpiredAt).toEqual(new Date(newExpiredTime));
    const newUser = await User.findByPk(user.id);
    expect(newUser.accessToken).toEqual('newAccessToken');
    googleFormRenewScope.done();
    googleRefreshAuthScope.done();
    await Subscription.destroy({
      where: { id: mockWatchId },
    });
  });

  it('should not refresh when refresh token 401', async () => {
    const mockFormId = 'mockFormId';
    const mockWatchId = 'mockWatchId';
    const oldExpiredTime = new Date(Date.now() + 3600 * 1000);
    await Subscription.create({
      id: mockWatchId,
      userId: user.id,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: oldExpiredTime,
      messageReceivedAt: new Date(),
    });
    user.subscriptions = [{
      id: mockWatchId,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
    }];
    user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
    await user.save();
    const googleRefreshAuthScope = nock(googleTokenDomain)
      .post(googleTokenPath)
      .reply(401);
    await refresh();
    const subscription = await Subscription.findByPk(mockWatchId);
    expect(subscription.watchExpiredAt).toEqual(oldExpiredTime);
    const newUser = await User.findByPk(user.id);
    expect(newUser.accessToken).toEqual('');
    googleRefreshAuthScope.done();
    await Subscription.destroy({
      where: { id: mockWatchId },
    });
  });

  it('should not throw error when refresh token 500', async () => {
    const mockFormId = 'mockFormId';
    const mockWatchId = 'mockWatchId';
    const oldExpiredTime = new Date(Date.now() + 3600 * 1000);
    await Subscription.create({
      id: mockWatchId,
      userId: user.id,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: oldExpiredTime,
      messageReceivedAt: new Date(),
    });
    user.subscriptions = [{
      id: mockWatchId,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
    }];
    user.tokenExpiredAt = new Date(Date.now() - 3600 * 1000);
    await user.save();
    const googleRefreshAuthScope = nock(googleTokenDomain)
      .post(googleTokenPath)
      .reply(500);
    await refresh();
    const subscription = await Subscription.findByPk(mockWatchId);
    expect(subscription.watchExpiredAt).toEqual(oldExpiredTime);
    const newUser = await User.findByPk(user.id);
    expect(newUser.accessToken).toEqual('knownAccessToken');
    googleRefreshAuthScope.done();
    await Subscription.destroy({
      where: { id: mockWatchId },
    });
  });

  it('should refresh subscription successfully for two subscriptions', async () => {
    const mockFormId = 'mockFormId';
    const mockWatchId = 'mockWatchId';
    const mockFormId1 = 'mockFormId1';
    const mockWatchId1 = 'mockWatchId1';
    await Subscription.create({
      id: mockWatchId,
      userId: user.id,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: new Date(Date.now() + 3600 * 1000),
      messageReceivedAt: new Date(),
    });
    await Subscription.create({
      id: mockWatchId1,
      userId: user.id,
      formId: mockFormId1,
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: mockRCWebhookUri,
      watchExpiredAt: new Date(Date.now() + 3600 * 1000),
      messageReceivedAt: new Date(),
    });
    user.subscriptions = [{
      id: mockWatchId,
      formId: mockFormId,
      rcWebhookId: mockRCWebhookId,
    }, {
      id: mockWatchId1,
      formId: mockFormId1,
      rcWebhookId: mockRCWebhookId,
    }];
    await user.save();
    const newExpiredTime = (new Date(Date.now() + 3600 * 1000 * 24 * 7)).toISOString();
    const googleFormRenewScope = nock('https://forms.googleapis.com')
      .post(`/v1/forms/${mockFormId}/watches/${mockWatchId}:renew`)
      .reply(200, {
        id: mockWatchId,
        expireTime: newExpiredTime,
        createTime: '2022-01-01T00:00:00.000Z',
      });
    const newExpiredTime1 = (new Date(Date.now() + 3600 * 1000 * 24 * 6)).toISOString();
    const googleFormRenewScope1 = nock('https://forms.googleapis.com')
      .post(`/v1/forms/${mockFormId1}/watches/${mockWatchId1}:renew`)
      .reply(200, {
        id: mockWatchId1,
        expireTime: newExpiredTime1,
        createTime: '2022-01-01T00:00:00.000Z',
      });
    await refresh();
    const subscription = await Subscription.findByPk(mockWatchId);
    expect(subscription.watchExpiredAt).toEqual(new Date(newExpiredTime));
    const subscription1 = await Subscription.findByPk(mockWatchId1);
    expect(subscription1.watchExpiredAt).toEqual(new Date(newExpiredTime1));
    googleFormRenewScope.done();
    googleFormRenewScope1.done();
    await Subscription.destroy({
      where: { id: mockWatchId },
    });
  });
});
