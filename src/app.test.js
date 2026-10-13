import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import app from './app.js';

let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('health endpoint responds without a database connection', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('development CORS allows the Vite preview origin on its alternate port', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Origin: 'http://127.0.0.1:5174' }
    });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5174');
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('protected routes reject requests without a valid bearer token', async () => {
  const response = await fetch(`${baseUrl}/api/organizations`);
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Authentication required' });
});
