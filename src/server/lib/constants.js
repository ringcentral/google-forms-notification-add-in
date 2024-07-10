const route = {
  forClient: {
    CLIENT_SETUP: '/setup',
    SUBSCRIBE: '/subscribe',
    OPEN_AUTH_PAGE: '/open-auth-page',
    GET_USER_INFO: '/get-user-info',
    GENERATE_TOKEN: '/generate-token',
    REVOKE_TOKEN: '/revoke-token',
    GET_FORM_DATA: '/get-form-data',
  },
  forThirdParty: {
    AUTH_CALLBACK: '/oauth-callback',
    NOTIFICATION: '/notification',
    INTERACTIVE_MESSAGE: '/interactive-messages',
  }
}

const icon = {
  LOGO: 'https://raw.githubusercontent.com/ringcentral/google-forms-notification-add-in/main/icons/logo.png',
};

const IFRAME_HOST_DOMAINS = "https://*.ringcentral.com https://*.ringcentral.biz https://*.glip.com https://*.glip.net https://glip.com https://*.labs.ringcentral.com https://*.integration.ringcentral.com https://*.devtest.ringcentral.com https://*.unifyoffice.com https://*.officeathand.att.com https://*.cloudoffice.avaya.com https://*.cloudwork.bt.com https://*.rainbowoffice.com https://*.businessconnect.telus.com https://*.vodafonebusiness.ringcentral.com";

exports.route = route;
exports.icon = icon;
exports.IFRAME_HOST_DOMAINS = IFRAME_HOST_DOMAINS;
