// RNF-15 / PI-08: restaura un respaldo creado con db:backup en la base configurada.
// Uso: npm run db:restore -- --file=backups/archivo.sql --confirm=NOMBRE_DE_LA_BASE [--allow-remote]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { backendRoot, env } from '../src/config/env.js';
import { createDatabaseConnection } from '../src/config/mysql-connection.js';

const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const file = arg('file') ? path.resolve(backendRoot, arg('file')) : null;
const local = ['127.0.0.1', 'localhost', '::1'].includes(env.db.host);
const fail = (message) => { console.error(message); process.exit(1); };

if (!file || !fs.existsSync(file)) fail('Indica un respaldo existente con --file=ruta/archivo.sql.');
// Restaurar reemplaza todas las tablas: se exige escribir el nombre de la base de destino.
if (arg('confirm') !== env.db.name) fail(`Para reemplazar los datos escribe --confirm=${env.db.name}.`);
if (!local && !process.argv.includes('--allow-remote')) fail('La base de destino es remota. Restaura primero en un entorno de prueba aislado; si es intencional, añade --allow-remote.');

const sql = fs.readFileSync(file, 'utf8');
const checksumFile = `${file}.sha256`;
if (fs.existsSync(checksumFile)) {
  const expected = fs.readFileSync(checksumFile, 'utf8').trim().split(/\s+/)[0];
  const actual = crypto.createHash('sha256').update(sql, 'utf8').digest('hex');
  if (expected !== actual) fail('La suma SHA-256 no coincide: el respaldo está incompleto o fue modificado.');
  console.log('Integridad del respaldo verificada (SHA-256).');
} else {
  console.warn('Aviso: no se encontró el archivo .sha256; no se verificó la integridad.');
}

const conn = await createDatabaseConnection({ multipleStatements: true });
try {
  await conn.query(sql);
  const [tables] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  console.log(`Restauración completa en ${env.db.name}: ${tables.length} tablas.`);
} catch (error) {
  console.error(`La restauración falló: ${error.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
