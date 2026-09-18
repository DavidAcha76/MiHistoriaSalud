import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveApiUrl } from '../src/api/resolve-api-url.ts';

const local = { development: true, platform: 'web' };
test('web local sigue el host del navegador, incluso desde otro equipo', () => {
  assert.equal(resolveApiUrl({ ...local, webHostname: 'localhost' }), 'http://localhost:4000/api');
  assert.equal(resolveApiUrl({ ...local, webHostname: '192.168.1.20' }), 'http://192.168.1.20:4000/api');
  assert.equal(resolveApiUrl({ ...local, webHostname: '[::1]' }), 'http://[::1]:4000/api');
});
test('teléfono Android e iOS usan la dirección LAN de Expo', () => {
  for (const platform of ['android', 'ios']) {
    assert.equal(resolveApiUrl({ ...local, platform, expoHostUri: '192.168.1.20:8081' }), 'http://192.168.1.20:4000/api');
  }
});
test('emuladores tienen valores predeterminados accesibles', () => {
  assert.equal(resolveApiUrl({ ...local, platform: 'android' }), 'http://10.0.2.2:4000/api');
  assert.equal(resolveApiUrl({ ...local, platform: 'android', expoHostUri: 'localhost:8081' }), 'http://10.0.2.2:4000/api');
  assert.equal(resolveApiUrl({ ...local, platform: 'ios' }), 'http://localhost:4000/api');
});
test('web y app compiladas nunca usan localhost por defecto', () => {
  for (const platform of ['web', 'android', 'ios']) {
    assert.equal(resolveApiUrl({ development: false, platform, expoHostUri: '192.168.1.20:8081' }), 'https://api.clinia.win/api');
  }
});
test('la URL explícita tiene prioridad y normaliza espacios y barras', () => {
  assert.equal(resolveApiUrl({ ...local, configuredUrl: ' https://api.clinia.win/api/ ' }), 'https://api.clinia.win/api');
  assert.equal(resolveApiUrl({ ...local, configuredUrl: 'https://api.clinia.win' }), 'https://api.clinia.win/api');
  assert.equal(resolveApiUrl({ ...local, configuredUrl: 'http://192.168.1.50:5000/api' }), 'http://192.168.1.50:5000/api');
});
test('rechaza direcciones mal formadas antes de enviar credenciales', () => {
  for (const configuredUrl of ['api.clinia.win', 'ftp://api.clinia.win', 'https://user:password@api.clinia.win', 'https://api.clinia.win/api?key=value']) {
    assert.throws(() => resolveApiUrl({ ...local, configuredUrl }));
  }
});
