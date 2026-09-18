import fs from 'node:fs/promises';
import path from 'node:path';
import { backendRoot } from '../src/config/env.js';
import { createDatabaseConnection } from '../src/config/mysql-connection.js';

const migrationsDir = path.resolve(backendRoot, 'database/migrations');
const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
const conn = await createDatabaseConnection({ multipleStatements: true });
try {
  await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(255) PRIMARY KEY, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  const [applied] = await conn.query('SELECT name FROM schema_migrations');
  const done = new Set(applied.map((r) => r.name));
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    console.log(`Aplicando ${file}...`);
    await conn.beginTransaction();
    try {
      await conn.query(sql);
      await conn.execute('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  }
  console.log('Migraciones completas.');
} finally { await conn.end(); }
