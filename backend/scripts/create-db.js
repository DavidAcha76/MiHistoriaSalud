import 'dotenv/config';
import mysql from 'mysql2/promise';
import { env } from '../src/config/env.js';

if (!/^[A-Za-z0-9_]+$/.test(env.db.name)) throw new Error('DB_NAME solo puede contener letras, números y guion bajo.');
const conn = await mysql.createConnection({ host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password });
try {
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`Base de datos lista: ${env.db.name}`);
} finally { await conn.end(); }
