const request = require('supertest');
const nock = require('nock');
const axios = require('axios');
const { server } = require('../src/server');
const jwt = require('../src/server/lib/jwt');
const { Subscription } = require('../src/server/models/subscriptionModel');
const { User } = require('../src/server/models/userModel');

const formData = require('./mock-data/form.json');

axios.defaults.adapter = require('axios/lib/adapters/http');

describe('Subscription', () => {
  let user;
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
      const googleFormWatchesScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}/watches`)
        .reply(200, {
          watches: [],
        });
      const res = await request(server).get(`/get-form-data?token=${jwtToken}&formIds=${formIds}`);
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).forms.length).toEqual(1);
      expect(JSON.parse(res.text).forms[0].id).toEqual(formData.id);
      googleFormWatchesScope.done();
      googleFormScope.done();
    });

    it('should return form data successfully with DuplicateError', async () => {
      const jwtToken = jwt.generateJwt({
        id: user.id,
      });
      const mockFormId = 'mockFormId';
      const formIds = [mockFormId].join(',');
      const googleFormScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}`)
        .reply(200, formData);
      const googleFormWatchesScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}/watches`)
        .reply(200, {
          watches: [{}],
        });
      const res = await request(server).get(`/get-form-data?token=${jwtToken}&formIds=${formIds}`);
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).forms.length).toEqual(1);
      expect(JSON.parse(res.text).forms[0].id).toEqual(formData.id);
      expect(JSON.parse(res.text).forms[0].error).toEqual('DuplicateError');
      googleFormWatchesScope.done();
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
      const googleFormWatchesScope = nock('https://forms.googleapis.com')
        .get(`/v1/forms/${mockFormId}/watches`)
        .reply(200, {
          watches: [],
        });
      const res = await request(server).get(`/get-form-data?token=${jwtToken}&formIds=${formIds}`);
      expect(res.status).toEqual(200);
      expect(JSON.parse(res.text).forms.length).toEqual(1);
      expect(JSON.parse(res.text).forms[0].id).toEqual(formData.id);
      const newUser = await User.findByPk(user.id);
      expect(newUser.accessToken).toEqual('newAccessToken1');
      googleRefreshAuthScope.done();
      googleFormWatchesScope.done();
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
});
