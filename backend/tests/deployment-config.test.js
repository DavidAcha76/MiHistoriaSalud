import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { backendRoot } from '../src/config/env.js';

const moduleUrl = pathToFileURL(path.join(backendRoot, 'src/config/env.js')).href;
const good = {
  NODE_ENV: 'production', PORT: '49123', TRUST_PROXY: '1',
  APP_BASE_URL: 'https://api.clinia.win', CORS_ORIGIN: 'https://www.clinia.win,https://clinia.win',
  JWT_ACCESS_SECRET: 'a'.repeat(64), JWT_REFRESH_SECRET: 'b'.repeat(64),
  DB_HOST: 'db.example.com', DB_USER: 'app', DB_PASSWORD: 'example', DB_NAME: 'app',
  SEED_DEMO: 'false', LOCAL_STORAGE_DIR: './storage/private',
  DOTENV_CONFIG_PATH: '.env.production.test-missing'
};
function run(overrides = {}, code = 'validateProductionSecrets(); console.log(JSON.stringify({port:env.port,storage:env.storage.localDir,trustProxy:env.trustProxy}));') {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `import {env,validateProductionSecrets} from ${JSON.stringify(moduleUrl)}; ${code}`], {
    cwd: os.tmpdir(), env: { ...process.env, ...good, ...overrides }, encoding: 'utf8', windowsHide: true
  });
}
test('MonsterASP conserva su puerto dinámico y rutas independientemente del directorio de inicio', () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.port, 49123);
  assert.equal(config.trustProxy, 1);
  assert.equal(config.storage, path.join(backendRoot, 'storage/private'));
});
test('configuración incompleta de producción falla antes de arrancar', () => {
  for (const overrides of [
    { JWT_ACCESS_SECRET: 'short' }, { JWT_REFRESH_SECRET: good.JWT_ACCESS_SECRET },
    { APP_BASE_URL: 'http://localhost:4000' }, { CORS_ORIGIN: '*' },
    { CORS_ORIGIN: 'https://www.clinia.win/' }, { CORS_ORIGIN: 'http://www.clinia.win' },
    { DB_HOST: '' }, { DB_PASSWORD: '' }, { SEED_DEMO: 'true' }
  ]) assert.notEqual(run(overrides).status, 0);
});
test('vista previa web local requiere un origen explícito', () => {
  assert.equal(run({ CORS_ORIGIN: `${good.CORS_ORIGIN},http://localhost:8081` }).status, 0);
});
test('web.config usa la configuración de inicio documentada por MonsterASP', async () => {
  const config = await fs.readFile(path.join(backendRoot, 'web.config'), 'utf8');
  assert.match(config, /processPath="node" arguments="\.\\server\.js"/);
  assert.match(config, /name="PORT" value="%HTTP_PLATFORM_PORT%"/);
  assert.match(config, /startupTimeLimit="20" stdoutLogEnabled="false" stdoutLogFile="\.\\logs\\node"/);
  assert.match(config, /name="NODE_ENV" value="production"/);
  assert.doesNotMatch(config, /TRUST_PROXY|requestFiltering|httpErrors/);
});
test('puerto vacío conserva 4000 y desarrollo no confía en proxies', () => {
  const result = run({ NODE_ENV: 'development', PORT: '', TRUST_PROXY: '' });
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);
  assert.equal(config.port, 4000);
  assert.equal(config.trustProxy, 0);
});
