function getOrigin(uri) {
  if (!uri) {
    return null;
  }
  const url = new URL(uri);
  return url.origin;
}

const KNOWN_REFERER_HOSTS = [
  getOrigin(process.env.APP_SERVER),
];

function refererChecker(req, res, next) {
  const referrer = req.get('Referer');
  if (!referrer) {
    res.status(403).send('No Referer');
    return;
  }
  const referrerOrigin = getOrigin(referrer);
  if (
    KNOWN_REFERER_HOSTS.find(host => {
      if (!host) {
        return false;
      }
      return host === referrerOrigin;
    })
  ) {
    next();
    return;
  }
  res.status(403).send('Invalid Referer');
};

exports.refererChecker = refererChecker;
