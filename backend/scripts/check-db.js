import { db } from '../src/config/db.js';
import { env, validateProductionSecrets } from '../src/config/env.js';
import fs from 'node:fs/promises';

try {
  validateProductionSecrets();
  const connection = await db.getConnection();
  try {
    const [version] = await connection.query('SELECT VERSION() AS version, DATABASE() AS databaseName');
    const [tables] = await connection.execute(
      'SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
      [env.db.name]
    );
    const [tls] = await connection.query("SHOW SESSION STATUS LIKE 'Ssl_cipher'");
    console.log(JSON.stringify({
      connected: true, version: version[0].version, database: version[0].databaseName,
      tls: Boolean(tls[0]?.Value), tables: tables.map((table) => table.name)
    }, null, 2));
    let applied = [];
    if (tables.some((table) => table.name === 'schema_migrations')) {
      const [migrations] = await connection.query('SELECT name FROM schema_migrations ORDER BY name');
      applied = migrations.map((migration) => migration.name);
      console.log('Migraciones aplicadas:', applied.join(', '));
    }
    const files = (await fs.readdir(new URL('../database/migrations/', import.meta.url))).filter((file) => file.endsWith('.sql'));
    const pending = files.filter((file) => !applied.includes(file));
    if (pending.length) {
      console.log('Migraciones pendientes:', pending.join(', '));
      if (process.argv.includes('--require-migrations')) throw new Error('Aplica las migraciones pendientes con npm run db:migrate antes de publicar.');
    }
  } finally { connection.release(); }
} catch (error) {
  console.error(`No se pudo verificar MySQL (${error.code || error.name}): ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
