import mysql from 'mysql2/promise';
import { env } from './env.js';
import { initializeUtcSession, mysqlOptions, withSslPreference } from './mysql-connection.js';

const pools = new Map();

async function getConnection() {
  return withSslPreference(async (ssl) => {
    const key = ssl ? 'tls' : 'plain';
    if (!pools.has(key)) pools.set(key, mysql.createPool({
      ...mysqlOptions, ssl, waitForConnections: true,
      connectionLimit: env.db.connectionLimit, namedPlaceholders: false
    }));
    return initializeUtcSession(await pools.get(key).getConnection());
  });
}

async function run(method, args) {
  const connection = await getConnection();
  try { return await connection[method](...args); }
  finally { connection.release(); }
}

export const db = {
  getConnection,
  query: (...args) => run('query', args),
  execute: (...args) => run('execute', args),
  end: () => Promise.all([...pools.values()].map((pool) => pool.end()))
};

export async function pingDb() {
  const conn = await db.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}
