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
  LOGO: 'https://user-images.githubusercontent.com/7036536/151290687-259f4a4a-4185-4013-8475-668061a20a1f.png',
};

exports.route = route;
exports.icon = icon;
