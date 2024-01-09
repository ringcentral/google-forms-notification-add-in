import 'whatwg-fetch';
import React from 'react';
import ReactDOM from 'react-dom';
import { RingCentralNotificationIntegrationHelper } from 'ringcentral-notification-integration-helper'

import { App } from './components/Root';
import { Client } from './lib/client';
import { Analytics } from './lib/analytics';

const integrationHelper = new RingCentralNotificationIntegrationHelper()
const client = new Client(window.clientConfig);
const analytics = new Analytics({
  mixpanelKey: window.clientConfig.mixpanelKey,
});
window.client = client;

ReactDOM.render(
  <App integrationHelper={integrationHelper} client={client} analytics={analytics} />,
  document.querySelector('div#viewport'),
);
