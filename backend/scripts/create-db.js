import { env } from '../src/config/env.js';
import { createDatabaseConnection } from '../src/config/mysql-connection.js';

if (!['127.0.0.1', 'localhost', '::1'].includes(env.db.host)) throw new Error('La base remota se crea en el panel del hosting. Usa db:migrate para aplicar su esquema.');
if (!/^[A-Za-z0-9_]+$/.test(env.db.name)) throw new Error('DB_NAME solo puede contener letras, números y guion bajo para crear una base local.');
const conn = await createDatabaseConnection({ database: undefined });
try {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`Base de datos lista: ${env.db.name}`);
} finally { await conn.end(); }
