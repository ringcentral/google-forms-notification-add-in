const { decodeJwt } = require('../lib/jwt');
const { User } = require('../models/userModel');
const { onSubscribe } = require('../handlers/subscriptionHandler');


async function subscribe(req, res) {
    // validate jwt
    const jwtToken = req.body.token;
    if (!jwtToken) {
        res.status(403);
        res.send('Params invalid.');
        return;
    }
    const decodedToken = decodeJwt(jwtToken);
    if (!decodedToken) {
        res.status(401);
        res.send('Token invalid');
        return;
    }

    // check for rcWebhookUri
    const rcWebhookUri = req.body.rcWebhookUri;
    if (!rcWebhookUri) {
        res.status(400);
        res.send('Missing rcWebhookUri');
        return;
    }

    // get existing user
    const userId = decodedToken.id;
    const user = await User.findByPk(userId.toString());
    if (!user) {
        res.status(401);
        res.send('Unknown user');
        return;
    }

    // create webhook notification subscription
    try {
        await onSubscribe(user, rcWebhookUri);    
        res.status(200);
        res.json({
            result: 'ok'
        });
    }
    catch (e) {
        console.error(e);
        if (e.response && e.response.status === 401) {
            res.status(401);
            res.send('Unauthorized');
            return;
        }
        res.status(500);
        res.send('Internal server error');
        return;
    }
}


exports.subscribe = subscribe;