const { decodeJwt } = require('../lib/jwt');

function checkAuth(req, res, next) {
  const jwtToken = req.headers['x-access-token'];
  if (!jwtToken) {
    res.status(403);
    res.send('Token required.');
    return;
  }
  const decodedToken = decodeJwt(jwtToken);
  if (!decodedToken) {
    res.status(401);
    res.send('Token invalid.');
    return;
  }
  req.currentUserId = decodedToken.id;
  next();
}

exports.checkAuth = checkAuth;
