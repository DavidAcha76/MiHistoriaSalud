import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const backendRoot = fileURLToPath(new URL('../../', import.meta.url));
dotenv.config({ path: path.resolve(backendRoot, process.env.DOTENV_CONFIG_PATH || '.env'), quiet: true });

const bool = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};
const number = (value, fallback) => {
  if (value == null || String(value).trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: number(process.env.PORT, 4000),
  trustProxy: number(process.env.TRUST_PROXY, process.env.NODE_ENV === 'production' ? 1 : 0),
  appBaseUrl: (process.env.APP_BASE_URL || `http://localhost:${number(process.env.PORT, 4000)}`).replace(/\/$/, ''),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: number(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'mihistoria_salud',
    connectionLimit: number(process.env.DB_CONNECTION_LIMIT, 10),
    sslMode: (process.env.DB_SSL_MODE || (bool(process.env.DB_SSL, false) ? 'verify_identity' : 'disabled')).toLowerCase()
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshDays: number(process.env.JWT_REFRESH_DAYS, 180)
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: path.resolve(backendRoot, process.env.LOCAL_STORAGE_DIR || './storage/private'),
    maxFileMb: number(process.env.MAX_FILE_MB, 10),
    s3: {
      region: process.env.S3_REGION || 'us-east-1',
      bucket: process.env.S3_BUCKET || '',
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      forcePathStyle: bool(process.env.S3_FORCE_PATH_STYLE, false)
    }
  },
  ai: {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    mockMode: bool(process.env.AI_MOCK_MODE, true)
  },
  seedDemo: bool(process.env.SEED_DEMO, process.env.NODE_ENV !== 'production'),
  demo: {
    email: process.env.DEMO_EMAIL || 'demo@mihistoria.local',
    password: process.env.DEMO_PASSWORD || 'Demo1234!'
  }
};

if (!['disabled', 'preferred', 'required', 'verify_identity'].includes(env.db.sslMode)) {
  throw new Error('DB_SSL_MODE debe ser disabled, preferred, required o verify_identity.');
}

export function validateProductionSecrets() {
  if (env.nodeEnv !== 'production') return;
  const weak = [env.jwt.accessSecret, env.jwt.refreshSecret].some((x) => /change-me|cambia-esta|dev-|secret/i.test(x) || x.length < 32) || env.jwt.accessSecret === env.jwt.refreshSecret;
  if (weak) throw new Error('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser secretos robustos en producción.');
  if (!env.appBaseUrl.startsWith('https://')) throw new Error('APP_BASE_URL debe usar HTTPS en producción.');
  const origins = env.corsOrigin.split(',').map((origin) => origin.trim());
  if (origins.some((origin) => {
    try {
      const url = new URL(origin);
      const localPreview = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      return (url.protocol !== 'https:' && !localPreview) || url.origin !== origin;
    }
    catch { return true; }
  })) throw new Error('CORS_ORIGIN requiere orígenes HTTPS explícitos (o HTTP de localhost para pruebas), separados por comas.');
  for (const key of ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']) {
    if (!process.env[key]?.trim()) throw new Error(`${key} es obligatorio en producción.`);
  }
  if (env.seedDemo) throw new Error('Usa SEED_DEMO=false en producción.');
}
