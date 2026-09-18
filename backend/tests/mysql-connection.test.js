import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeUtcSession, withSslPreference } from '../src/config/mysql-connection.js';

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

test('cada conexión alinea la sesión SQL a UTC antes de entregar consultas a la app', async () => {
  let initialized = false;
  const connection = {
    async query(sql) { assert.equal(sql, "SET time_zone = '+00:00'"); initialized = true; },
    destroy() { assert.fail('La conexión está configurada correctamente'); }
  };
  assert.equal(await initializeUtcSession(connection), connection);
  assert.equal(initialized, true);
});

test('una conexión que no pudo fijar UTC se descarta para no alterar las cuotas', async () => {
  let destroyed = false;
  const error = new Error('session failed');
  await assert.rejects(initializeUtcSession({
    async query() { throw error; }, destroy() { destroyed = true; }
  }), (failure) => failure === error);
  assert.equal(destroyed, true);
});
