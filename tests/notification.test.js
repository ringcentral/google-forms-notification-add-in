const request = require('supertest');
const axios = require('axios');
const { server } = require('../src/server');
const { Subscription } = require('../src/server/models/subscriptionModel');

axios.defaults.adapter = require('axios/lib/adapters/http');

// Example tests
describe('Notification', () => {

  const mockDomain = 'http://test.com';
  const mockRCWebhookId = 'knownRcWebhookId';
  const mockRcWebhookEndpoint = `/webhook/${mockRCWebhookId}`;
  const mockWatchId = 'knownWatchId';

  beforeAll(async () => {
    // Mock data on subscriptions table
    await Subscription.create({
      id: mockWatchId,
      userId: 'knownUserId',
      formId: 'knownFormId',
      rcWebhookId: mockRCWebhookId,
      rcWebhookUri: `${mockDomain}${mockRcWebhookEndpoint}`
    });
  });

  it('should get 404 with wrong webhook id', async () => {
    const res = await request(server).post('/notification').send({
      message: {
        attributes: {
          watchId: 'unknownWatchId',
        },
      },
    });
    expect(res.status).toEqual(404);
  });
});