const Mixpanel = require('mixpanel');

class Analytics {
  constructor({
    mixpanelKey,
    appName = 'Google Forms Add-in',
  }) {
    if (mixpanelKey) {
      this._mixpanel = Mixpanel.init(mixpanelKey);
    }
    this._appName = appName;
  }

  _track(event, properties = {}) {
    if (!this._mixpanel) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this._mixpanel.track(event, {
        appName: this._appName,
        ...properties,
      }, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  async track(event, properties = {}) {
    try {
      await this._track(event, properties);
    } catch (e) {
      console.error(e && e.message);
    }
  }
}

exports.Analytics = Analytics;
