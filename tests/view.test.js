const request = require('supertest');

const { server } = require('../src/server');

describe('Setup', () => {
  it('should get 200 when visit setup page', async () => {
    const res = await request(server).get('/setup');
    expect(res.status).toEqual(200);
    expect(res.text).toContain('window.clientConfig');
    expect(res.text).toContain(`${process.env.ASSETS_PATH}/app.js`);
  });

  it('should get 200 when visit setup page with webhook', async () => {
    const res = await request(server).get('/setup?webhook=https://example.com/webhooks/xxxx');
    expect(res.status).toEqual(200);
    expect(res.text).toContain('window.clientConfig');
    expect(res.text).toContain(`${process.env.ASSETS_PATH}/app.js`);
    expect(res.headers['content-security-policy']).toContain(`frame-ancestors 'self'`);
  });

  it('should get 200 when visit home page', async () => {
    const res = await request(server).get('/home');
    expect(res.status).toEqual(200);
  });

  it('should get 200 when visit home page', async () => {
    const res = await request(server).get('/');
    expect(res.status).toEqual(200);
  });

  it('should get 200 when GOOGLE_SITE_VERIFICATION_TOKEN is set', async () => {
    const res = await request(server).get(`/${process.env.GOOGLE_SITE_VERIFICATION_TOKEN}.html`);
    expect(res.status).toEqual(200);
    expect(res.text).toContain(`google-site-verification: ${process.env.GOOGLE_SITE_VERIFICATION_TOKEN}.html`);
  });
});