const { Client } = require('../src/client/lib/client');

describe('Client.getForms', () => {
  let client;
  const originalFetch = global.fetch;
  const originalStorage = global.localStorage;

  beforeEach(() => {
    global.fetch = jest.fn();
    global.localStorage = {
      getItem: jest.fn(() => 'jwt-token'),
      removeItem: jest.fn(),
    };
    client = new Client({ getFormDataUri: '/get-form-data' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.localStorage = originalStorage;
  });

  it('returns loaded forms', async () => {
    const forms = [{ formId: 'formId', info: { title: 'Test form' } }];
    global.fetch.mockResolvedValue({ status: 200, json: async () => ({ forms }) });
    await expect(client.getForms(['formId'])).resolves.toEqual(forms);
  });

  it.each([403, 429])('shows the server explanation for status %s without logging out', async (status) => {
    const message = 'An actionable explanation from the server.';
    global.fetch.mockResolvedValue({ status, json: async () => ({ message }) });
    await expect(client.getForms(['formId'])).rejects.toThrow(message);
    expect(global.localStorage.removeItem).not.toHaveBeenCalled();
  });

  it.each([null, {}, { message: 123 }])('falls back for an unexpected JSON error body %j', async (body) => {
    global.fetch.mockResolvedValue({ status: 500, json: async () => body });
    await expect(client.getForms(['formId'])).rejects.toThrow('Fetch data error please retry later');
  });

  it('falls back when the server returns a non-JSON error', async () => {
    global.fetch.mockResolvedValue({ status: 500, json: async () => { throw new SyntaxError(); } });
    await expect(client.getForms(['formId'])).rejects.toThrow('Fetch data error please retry later');
  });

  it('clears the token when authorization is required', async () => {
    global.fetch.mockResolvedValue({ status: 401 });
    await expect(client.getForms(['formId'])).rejects.toThrow('Unauthorized');
    expect(global.localStorage.removeItem).toHaveBeenCalledWith('jwt-token-storage-key');
  });

  it('keeps the form-not-found message', async () => {
    global.fetch.mockResolvedValue({ status: 404 });
    await expect(client.getForms(['formId'])).rejects.toThrow('Google form not found');
    expect(global.localStorage.removeItem).not.toHaveBeenCalled();
  });
});
