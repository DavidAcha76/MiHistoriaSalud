import test from 'node:test';
import assert from 'node:assert/strict';

// The tests exercise Express over HTTP without using any database records.
process.env.CORS_ORIGIN = 'https://www.clinia.win,https://clinia.win';
const { app } = await import('../src/app.js');

test('salud, preflight de producción y rutas privadas', async (t) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
  assert.match(health.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
  for (const origin of ['https://www.clinia.win', 'https://clinia.win']) {
    const response = await fetch(`${base}/api/auth/login`, {
      method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.match(response.headers.get('access-control-allow-headers'), /authorization/);
  }
  const denied = await fetch(`${base}/health`, { headers: { Origin: 'https://untrusted.example' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  const native = await fetch(`${base}/api/auth/me`);
  assert.equal(native.status, 401);
  for (const route of ['/.env', '/storage/private/test.pdf', '/src/config/env.js']) {
    assert.equal((await fetch(`${base}${route}`)).status, 404);
  }
});
