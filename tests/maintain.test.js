const request = require('supertest');
const { server } = require('../src/server');
const { User } = require('../src/server/models/userModel');

describe('Maintain', () => {
  it('should return 404 when no MAINTAIN_TOKEN env', async () => {
    const res = await request(server).get('/maintain/remove-user-name');
    expect(res.status).toEqual(404);
  });

  it('should return 403 when maintain_token is invalid', async () => {
    process.env.MAINTAIN_TOKEN = 'valid';
    const res = await request(server).get('/maintain/remove-user-name?maintain_token=invalid');
    expect(res.status).toEqual(403);
  });

  it('should return 200 when maintain_token is valid', async () => {
    await User.create({
      id: 'test1',
      name: 'test'
    });
    await User.create({
      id: 'test2',
      name: ''
    });
    await User.create({
      id: 'test3',
      name: 'test3'
    });
    const user2 = await User.findByPk('test2');
    process.env.MAINTAIN_TOKEN = 'valid';
    const res = await request(server).get('/maintain/remove-user-name?maintain_token=valid');
    expect(res.status).toEqual(200);
    const users = await User.findAll();
    expect(users[0].name).toEqual('');
    expect(users[1].name).toEqual('');
    expect(users[2].name).toEqual('');
    expect(user2.updatedAt).toEqual(users[1].updatedAt);
    await User.destroy({ where: { id: 'test1' } });
    await User.destroy({ where: { id: 'test2' } });
    await User.destroy({ where: { id: 'test3' } });
  });

  it('should return 200 with lastKey', async () => {
    await User.create({
      id: 'test1',
      name: 'test'
    });
    await User.create({
      id: 'test2',
      name: ''
    });
    await User.create({
      id: 'test3',
      name: 'test3'
    });
    process.env.MAINTAIN_TOKEN = 'valid';
    const res = await request(server).get('/maintain/remove-user-name?maintain_token=valid&last_key=test1');
    expect(res.status).toEqual(200);
    await User.destroy({ where: { id: 'test1' } });
    await User.destroy({ where: { id: 'test2' } });
    await User.destroy({ where: { id: 'test3' } });
  });
});
