// RNF-15: respaldo lógico completo (estructura y datos) sin depender de mysqldump.
// Uso: npm run db:backup [-- --out=ruta/archivo.sql]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { backendRoot, env } from '../src/config/env.js';
import { createDatabaseConnection } from '../src/config/mysql-connection.js';

const arg = (name) => process.argv.find((item) => item.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.resolve(backendRoot, arg('out') || `backups/clinia-${env.db.name}-${stamp}.sql`);
fs.mkdirSync(path.dirname(target), { recursive: true });

const conn = await createDatabaseConnection();
const out = fs.createWriteStream(target, { encoding: 'utf8', mode: 0o600 });
const hash = crypto.createHash('sha256');
const write = (text) => new Promise((resolve, reject) => {
  hash.update(text);
  out.write(text, (error) => (error ? reject(error) : resolve()));
});
// Las columnas JSON llegan como objetos: se guardan como texto; los BLOB como literal hexadecimal.
const literal = (value) => {
  if (value && typeof value === 'object' && !Buffer.isBuffer(value) && !(value instanceof Date)) return conn.escape(JSON.stringify(value));
  return conn.escape(value);
};

try {
  const [tables] = await conn.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const names = tables.map((row) => Object.values(row)[0]).sort();
  await write(`-- Respaldo de Clinia · base ${env.db.name} · ${new Date().toISOString()}\n-- Tablas: ${names.length}\nSET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`);
  const counts = {};
  for (const name of names) {
    const [[create]] = await conn.query(`SHOW CREATE TABLE \`${name}\``);
    await write(`DROP TABLE IF EXISTS \`${name}\`;\n${create['Create Table']};\n`);
    const [columns] = await conn.query(`SHOW COLUMNS FROM \`${name}\``);
    const columnList = columns.map((column) => `\`${column.Field}\``).join(', ');
    counts[name] = 0;
    for (let offset = 0; ; offset += 200) {
      const [rows] = await conn.query(`SELECT * FROM \`${name}\` LIMIT 200 OFFSET ${offset}`);
      if (!rows.length) break;
      const values = rows.map((row) => `(${columns.map((column) => literal(row[column.Field])).join(', ')})`).join(',\n');
      await write(`INSERT INTO \`${name}\` (${columnList}) VALUES\n${values};\n`);
      counts[name] += rows.length;
      if (rows.length < 200) break;
    }
    await write('\n');
  }
  await write('SET FOREIGN_KEY_CHECKS=1;\n');
  await new Promise((resolve) => out.end(resolve));
  const digest = hash.digest('hex');
  fs.writeFileSync(`${target}.sha256`, `${digest}  ${path.basename(target)}\n`, { mode: 0o600 });
  fs.writeFileSync(`${target}.json`, JSON.stringify({ database: env.db.name, createdAt: new Date().toISOString(), sha256: digest, rows: counts }, null, 2), { mode: 0o600 });
  console.log(`Respaldo creado: ${target}`);
  console.log(`Tablas: ${names.length} · Filas: ${Object.values(counts).reduce((a, b) => a + b, 0)} · SHA-256: ${digest}`);
} catch (error) {
  out.destroy();
  fs.rmSync(target, { force: true });
  console.error(`No se pudo crear el respaldo: ${error.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
