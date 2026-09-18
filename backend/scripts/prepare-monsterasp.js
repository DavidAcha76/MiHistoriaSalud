import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

const root = fileURLToPath(new URL('../', import.meta.url));
const productionEnv = path.join(root, '.env.production');
await fs.access(productionEnv).catch(() => { throw new Error('Configura backend/.env.production antes de preparar el paquete.'); });
const productionValues = dotenv.parse(await fs.readFile(productionEnv, 'utf8'));
const validation = spawnSync(process.execPath, ['--input-type=module', '-e',
  "import { validateProductionSecrets } from './src/config/env.js'; validateProductionSecrets();"
], {
  cwd: root, stdio: 'inherit', windowsHide: true,
  env: { ...process.env, ...productionValues, DOTENV_CONFIG_PATH: productionEnv, NODE_ENV: 'production' }
});
if (validation.status !== 0) process.exit(validation.status || 1);
const outputRoot = path.join(root, 'dist');
await fs.mkdir(outputRoot, { recursive: true });
// A new directory preserves previous packages, secrets and uploaded documents.
const output = await fs.mkdtemp(path.join(outputRoot, 'monsterasp-'));
for (const name of ['server.js', 'web.config', 'package.json', 'package-lock.json', 'src', 'scripts', 'database']) {
  await fs.cp(path.join(root, name), path.join(output, name), { recursive: true });
}
for (const name of ['logs', 'storage/private']) await fs.mkdir(path.join(output, name), { recursive: true });

await fs.copyFile(productionEnv, path.join(output, '.env'));
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('Ejecuta este script con npm run deploy:prepare.');
const install = spawnSync(process.execPath, [npmCli, 'ci', '--omit=dev', '--no-audit', '--no-fund', '--cache', path.join(root, '.npm-cache'), ...(process.argv.includes('--offline') ? ['--offline'] : [])], {
  cwd: output, stdio: 'inherit', windowsHide: true
});
if (install.status !== 0) process.exit(install.status || 1);
await fs.writeFile(path.join(outputRoot, 'latest.json'), JSON.stringify({
  directory: path.relative(root, output), createdAt: new Date().toISOString(), apiUrl: productionValues.APP_BASE_URL
}, null, 2));
console.log(`Paquete preparado: ${output}`);
console.log('Sube su contenido a /wwwroot del sitio api.clinia.win después de configurar MySQL y ejecutar las migraciones.');
console.log('En actualizaciones conserva el .env y storage/private que ya existan en el servidor.');
