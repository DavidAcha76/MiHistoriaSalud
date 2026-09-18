import mysql from 'mysql2/promise';
import { env } from './env.js';

export const mysqlOptions = {
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  connectTimeout: 10000,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: true
};

// MySQL's Preferred mode requests encryption without certificate verification.
// Only a server explicitly lacking TLS may fall back to a plain connection.
export async function withSslPreference(connect, mode = env.db.sslMode) {
  const ssl = mode === 'disabled' ? undefined : {
    rejectUnauthorized: mode === 'verify_identity',
    verifyIdentity: mode === 'verify_identity'
  };
  try { return await connect(ssl); }
  catch (error) {
    if (mode !== 'preferred' || error.code !== 'HANDSHAKE_NO_SSL_SUPPORT') throw error;
    return connect(undefined);
  }
}

export function createDatabaseConnection(overrides = {}) {
  return withSslPreference((ssl) => mysql.createConnection({ ...mysqlOptions, ...overrides, ssl }));
}
