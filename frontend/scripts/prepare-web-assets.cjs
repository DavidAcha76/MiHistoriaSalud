const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const outputDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));
const sourceDir = path.join(outputDir, 'assets', 'node_modules');
const vendorDir = path.join(outputDir, 'assets', 'vendor');
const oldPath = 'assets/node_modules/';
const publicPath = 'assets/vendor/';

async function filesIn(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

async function cacheBustEntryBundle(outputDir) {
  const indexPath = path.join(outputDir, 'index.html');
  let index;
  try { index = await fs.readFile(indexPath, 'utf8'); }
  catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  const scriptPattern = /(<script\b[^>]*\bsrc=")([^"?]*AppEntry-[^"?]+\.js)(?:\?[^"']*)?(")/i;
  const match = index.match(scriptPattern);
  if (!match) throw new Error('No se encontró el bundle AppEntry en index.html.');
  const bundlePath = path.join(outputDir, match[2].replace(/^[/\\]+/, ''));
  const bundle = await fs.readFile(bundlePath);
  const version = crypto.createHash('sha256').update(bundle).digest('hex').slice(0, 16);
  const next = index.replace(scriptPattern, `${match[1]}${match[2]}?v=${version}${match[3]}`);
  await fs.writeFile(indexPath, next, 'utf8');
  return version;
}

async function main() {
  await fs.access(sourceDir).catch(() => {
    throw new Error(`Expo no generó ${sourceDir}. No se puede preparar los assets web.`);
  });
  try {
    await fs.access(vendorDir);
    throw new Error(`Ya existe ${vendorDir}. Exporta con --clear antes de preparar los assets.`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await fs.rename(sourceDir, vendorDir);

  let replacements = 0;
  for (const file of await filesIn(outputDir)) {
    if (!/\.(?:js|html|css|json|map)$/i.test(file)) continue;
    const content = await fs.readFile(file, 'utf8');
    if (!content.includes(oldPath)) continue;
    const next = content.replaceAll(oldPath, publicPath);
    replacements += content.split(oldPath).length - 1;
    await fs.writeFile(file, next, 'utf8');
  }

  const remaining = [];
  for (const file of await filesIn(outputDir)) {
    if (!/\.(?:js|html|css|json|map)$/i.test(file)) continue;
    if ((await fs.readFile(file, 'utf8')).includes(oldPath)) remaining.push(file);
  }
  if (remaining.length) throw new Error(`Quedaron referencias bloqueables a node_modules: ${remaining.join(', ')}`);
  const bundleVersion = await cacheBustEntryBundle(outputDir);
  console.log(`Assets web públicos preparados: ${replacements} rutas movidas a /${publicPath}${bundleVersion ? `; bundle v=${bundleVersion}` : ''}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
