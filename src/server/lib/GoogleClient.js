const axios = require('axios');
const querystring = require('querystring');
const constants = require('./constants');

class GoogleClient {
  constructor({ token }) {
    this._token = token;
    this._apiServer = 'https://forms.googleapis.com';
  }

  setToken(token) {
    this._token = token;
  }

  static authorizationUrl() {
    const scopes = process.env.GOOGLE_AUTH_SCOPES.split(process.env.GOOGLE_AUTH_SCOPES_SEPARATOR);
    const query = querystring.stringify({
      scope: scopes.join(' '),
      access_type: 'offline',
      response_type: 'code',
      redirect_uri: `${process.env.APP_SERVER}${constants.route.forThirdParty.AUTH_CALLBACK}`,
      client_id: process.env.GOOGLE_CLIENT_ID,
    });
    return `${process.env.GOOGLE_AUTHORIZATION_URI}?${query}`;
  }

  static async getToken(callbackUri) {
    const url = new URL(callbackUri);
    if (url.searchParams.get('error')) {
      const error = new Error('authError');
      error.details = url.searchParams.get('error');
      throw error;
    }
    const code = url.searchParams.get('code');
    if (!code) {
      throw new Error('noCode');
    }
    const scope = url.searchParams.get('scope');
    if (
      !scope ||
      scope.indexOf('forms.responses.readonly') === -1 ||
      scope.indexOf('forms.body.readonly') === -1
    ) {
      throw new Error('invalidScope');
    }
    const response = await axios.post(
      process.env.GOOGLE_ACCESS_TOKEN_URI,
      querystring.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.APP_SERVER}${constants.route.forThirdParty.AUTH_CALLBACK}`,
        grant_type: 'authorization_code',
      }),
      {
        headers: {
          'Content-type': 'application/x-www-form-urlencoded'
        },
      },
    );
    return response.data;
  }

  static async refreshToken(token) {
    const response = await axios.post(
      process.env.GOOGLE_ACCESS_TOKEN_URI,
      querystring.stringify({
        refresh_token: token,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
      {
        headers: {
          'Content-type': 'application/x-www-form-urlencoded'
        },
      },
    );
    return response.data;
  }

  revokeToken(refreshToken) {
    const token = refreshToken || this._token;
    return axios({
      url: `https://oauth2.googleapis.com/revoke?token=${token}`,
      method: 'POST',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded'
      },
    });
  }

  async getForm(id) {
    const response = await this.requestWithToken(`${this._apiServer}/v1/forms/${id}`, 'GET');
    return response.data;
  }

  async getUserInfo() {
    const apiServer = 'https://www.googleapis.com';
    const response = await this.requestWithToken(`${apiServer}/oauth2/v3/userinfo`, 'GET');
    return response.data;
  }

  async getFormResponses(formId, fromTime = null) {
    let url = `${this._apiServer}/v1/forms/${formId}/responses`;
    if (fromTime) {
      const time = new Date(fromTime);
      url = `${url}?filter=timestamp > ${time.toISOString()}`;
    }
    const response = await this.requestWithToken(url, 'GET');
    return response.data.responses;
  }

  async getFormResponse(formId, responseId) {
    const response = await this.requestWithToken(`${this._apiServer}/v1/forms/${formId}/responses/${responseId}`, 'GET');
    return response.data;
  }

  async createWatch(formId) {
    const response = await this.requestWithToken(
      `${this._apiServer}/v1/forms/${formId}/watches`,
      'POST',
      {
        watch: {
          target: {
            topic: {
              topicName: process.env.GOOGLE_PUBSUB_TOPIC_NAME
            }
          },
          eventType: 'RESPONSES'
        }
      }
    );
    return response.data;
  }

  async renewWatch(formId, watchId) {
    const response = await this.requestWithToken(
      `${this._apiServer}/v1/forms/${formId}/watches/${watchId}:renew`,
      'POST',
    );
    return response.data;
  }

  async deleteWatch(formId, watchId) {
    const response = await this.requestWithToken(
      `${this._apiServer}/v1/forms/${formId}/watches/${watchId}`,
      'DELETE',
    );
    return response.data;
  }

  async getWatches(formId) {
    const response = await this.requestWithToken(
      `${this._apiServer}/v1/forms/${formId}/watches`,
      'GET',
    );
    return response.data;
  }

  requestWithToken(url, method, data) {
    return axios({
      url,
      method,
      data,
      headers: {
        Authorization: `Bearer ${this._token}`,
      }
    });
  }
}

exports.GoogleClient = GoogleClient;
