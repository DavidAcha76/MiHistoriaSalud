const { spawn } = require('node:child_process');
const path = require('node:path');
const { load } = require('@expo/env');
const { getLanAddress } = require('./local-network.cjs');

const root = path.resolve(__dirname, '..');
const [mode, ...args] = process.argv.slice(2);
if (!['local', 'published', 'build'].includes(mode)) throw new Error('Modo inválido: local, published o build.');
// Load .env only for local use. Published builds cannot inherit a PC's LAN URL.
if (mode === 'local') { process.env.NODE_ENV = 'development'; load(root); }
const env = { ...process.env, EXPO_NO_DOTENV: '1' };
if (mode === 'local') {
  env.APP_VARIANT = 'local';
  env.EXPO_PUBLIC_API_URL = process.env.EXPO_PUBLIC_API_URL || '';
} else {
  env.APP_VARIANT = 'production';
  env.EXPO_PUBLIC_API_URL = 'https://api.clinia.win/api';
}
if (mode === 'build') env.NODE_ENV = 'production';
else {
  env.NODE_ENV = 'development';
  env.REACT_NATIVE_PACKAGER_HOSTNAME ||= getLanAddress();
}
console.log(`API: ${env.EXPO_PUBLIC_API_URL || 'automática en la red local, puerto 4000'}`);
const cli = require.resolve('expo/bin/cli');
const child = spawn(process.execPath, [cli, ...args], { cwd: root, env, stdio: 'inherit', windowsHide: true });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
