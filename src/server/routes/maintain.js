const { User } = require('../models/userModel');
const { errorLogger } = require('../lib/logger');

async function removeUserName(req, res) {
  if (!process.env.MAINTAIN_TOKEN) {
    res.status(404);
    res.send('Not found');
    return;
  }
  if (req.query.maintain_token !== process.env.MAINTAIN_TOKEN) {
    res.status(403);
    res.send('Forbidden');
    return;
  }
  let lastKey = req.query.last_key;
  try {
    const users = await User.findAll({
      limit: 50,
      lastKey: lastKey ? { id: lastKey } : undefined,
    });
    if (users.lastKey) {
      lastKey = users.lastKey.id;
    } else {
      lastKey = '';
    }
    for (const user of users) {
      if (user.name) {
        await User.update({ name: '' }, { where: { id: user.id } });
      }
    }
    res.json({
      last_key: lastKey,
    });
  } catch (e) {
    errorLogger(e);
    res.status(500);
    res.send('Internal error');
  }
}

exports.removeUserName = removeUserName;
