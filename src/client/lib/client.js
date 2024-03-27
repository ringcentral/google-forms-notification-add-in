const TOKEN_STORAGE_KEY = 'jwt-token-storage-key';

export class Client {
  constructor(config) {
    this._config = config;
  }

  async authorize(callbackUri) {
      const response = await fetch(this._config.generateTokenUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        callbackUri: callbackUri,
        rcWebhookUri: this._config.rcWebhookUri
      }),
    });
    if (response.status !== 200) {
      throw new Error('Authorization error')
    }
    const tokenData = await response.json();
    if (tokenData.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, tokenData.token);
    }
  }

  async logout() {
    const resp = await fetch(this._config.authRevokeUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: this.token,
        rcWebhookUri: this._config.rcWebhookUri
      }),
    });
    if (resp.status !== 200) {
      throw new Error('unauthorize error');
    }
    this.cleanToken();
  }

  async getUserInfo() {
    const response = await fetch(`${this._config.getUserInfoUri}?rcWebhookUri=${this._config.rcWebhookUri}`, {
      method: 'GET',
      headers: {
        'x-access-token': this.token,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 401) {
      this.cleanToken();
      throw new Error('Unauthorized');
    }
    if (response.status !== 200) {
      throw new Error('Fetch data error please retry later')
    }
    const data = await response.json();
    return data;
  }

  async getForms(formIds) {
    if (!formIds || !formIds.length) {
      return null;
    }
    const response = await fetch(`${this._config.getFormDataUri}?formIds=${formIds.join(',')}`, {
      method: 'GET',
      headers: {
        'x-access-token': this.token,
        'Content-Type': 'application/json',
      },
    });
    if (response.status === 401) {
      this.cleanToken();
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Google form not found');
    }
    if (response.status !== 200) {
      throw new Error('Fetch data error please retry later');
    }
    const data = await response.json();
    return data.forms;
  }

  async subscribe(formIds) {
    const response = await fetch(this._config.subscribeUri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: this.token,
        rcWebhookUri: this._config.rcWebhookUri,
        formIds: formIds.join(','),
      }),
    });
    if (response.status === 401) {
      this.cleanToken();
      throw new Error('Unauthorized');
    }
    if (response.status !== 200) {
      throw new Error('Subscription error');
    }
  }

  async deleteSubscription(formId) {
    const response = await fetch(this._config.subscribeUri, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: this.token,
        rcWebhookUri: this._config.rcWebhookUri,
        formId: formId,
      }),
    });
    if (response.status === 401) {
      this.cleanToken();
      throw new Error('Unauthorized');
    }
    if (response.status !== 200) {
      throw new Error('Delete subscription error');
    }
  }

  get authorized() {
    return !!this.token;
  }

  get authPageUri() {
    return this._config.authPageUri;
  }

  cleanToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  get token() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  }
}
