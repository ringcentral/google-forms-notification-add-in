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
  LOGO: 'https://user-images.githubusercontent.com/7036536/150320407-709969b9-b65a-49c0-aaf2-48b5502ad35d.png',
};

exports.route = route;
exports.icon = icon;