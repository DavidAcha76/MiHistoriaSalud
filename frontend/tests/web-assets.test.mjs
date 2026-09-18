import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('los assets web no conservan rutas node_modules que IIS puede bloquear', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'clinia-web-assets-'));
  const source = path.join(output, 'assets', 'node_modules', '@scope', 'package');
  const bundleDir = path.join(output, '_expo', 'static', 'js', 'web');
  await fs.mkdir(source, { recursive: true });
  await fs.mkdir(bundleDir, { recursive: true });
  await fs.writeFile(path.join(source, 'icon.png'), 'image');
  const bundlePath = path.join(bundleDir, 'AppEntry-test.js');
  await fs.writeFile(bundlePath, 'const icon = "/assets/node_modules/@scope/package/icon.png";');
  await fs.writeFile(path.join(output, 'index.html'), '<script src="/_expo/static/js/web/AppEntry-test.js" defer></script>');
  const result = spawnSync(process.execPath, ['scripts/prepare-web-assets.cjs', output], {
    cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true
  });
  assert.equal(result.status, 0, result.stderr);
  await fs.access(path.join(output, 'assets', 'vendor', '@scope', 'package', 'icon.png'));
  const bundle = await fs.readFile(bundlePath, 'utf8');
  assert.match(bundle, /assets\/vendor\//);
  assert.doesNotMatch(bundle, /assets\/node_modules\//);
  const index = await fs.readFile(path.join(output, 'index.html'), 'utf8');
  assert.match(index, /AppEntry-test\.js\?v=[a-f0-9]{16}/);
});
