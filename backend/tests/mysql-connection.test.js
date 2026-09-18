import test from 'node:test';
import assert from 'node:assert/strict';
import { withSslPreference } from '../src/config/mysql-connection.js';

test('Preferred usa TLS cuando el servidor lo admite', async () => {
  const seen = [];
  const result = await withSslPreference(async (ssl) => { seen.push(ssl); return 'connected'; }, 'preferred');
  assert.equal(result, 'connected');
  assert.deepEqual(seen, [{ rejectUnauthorized: false, verifyIdentity: false }]);
});
test('Preferred solo retrocede si el servidor declara no soportar TLS', async () => {
  const seen = [];
  const result = await withSslPreference(async (ssl) => {
    seen.push(ssl);
    if (ssl) throw Object.assign(new Error('TLS unavailable'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' });
    return 'connected';
  }, 'preferred');
  assert.equal(result, 'connected');
  assert.equal(seen.length, 2);
  assert.equal(seen[1], undefined);
});
test('no degrada TLS por contraseñas rechazadas ni errores del handshake', async () => {
  for (const code of ['ER_ACCESS_DENIED_ERROR', 'HANDSHAKE_SSL_ERROR', 'ETIMEDOUT']) {
    let attempts = 0;
    await assert.rejects(withSslPreference(async () => {
      attempts++;
      throw Object.assign(new Error(code), { code });
    }, 'preferred'), { code });
    assert.equal(attempts, 1);
  }
});
test('Required no admite conexiones sin TLS y Verify Identity comprueba certificados', async () => {
  await assert.rejects(withSslPreference(async () => {
    throw Object.assign(new Error('TLS unavailable'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' });
  }, 'required'));
  await withSslPreference(async (ssl) => {
    assert.deepEqual(ssl, { rejectUnauthorized: true, verifyIdentity: true });
  }, 'verify_identity');
});
