const axios = require('axios');

class GoogleClient {
  constructor({ token }) {
    this._token = token;
    this._apiServer = 'https://forms.googleapis.com';
  }

  setToken(token) {
    this._token = token;
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
    const response = await this.requestWithToken(`${this._apiServer}/v1beta/forms/${id}`, 'GET');
    return response.data;
  }

  async getUserInfo() {
    const apiServer = 'https://www.googleapis.com';
    const response = await this.requestWithToken(`${apiServer}/oauth2/v3/userinfo`, 'GET');
    return response.data;
  }

  async getFormResponses(formId) {
    const response = await this.requestWithToken(`${this._apiServer}/v1beta/forms/${formId}/responses`, 'GET');
    return response.data.responses;
  }

  async getFormResponse(formId, responseId) {
    const response = await this.requestWithToken(`${this._apiServer}/v1beta/forms/${formId}/responses/${responseId}`, 'GET');
    return response.data;
  }

  async createWatch(formId) {
    const response = await this.requestWithToken(
      `${this._apiServer}/v1beta/forms/${formId}/watches`,
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
      `${this._apiServer}/v1beta/forms/${formId}/watches/${watchId}:renew`,
      'POST',
    );
    return response.data;
  }

  async deleteWatch(formId, watchId) {
    const response = await this.requestWithToken(
      `${this._apiServer}/v1beta/forms/${formId}/watches/${watchId}`,
      'DELETE',
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
