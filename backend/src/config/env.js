import 'dotenv/config';
import path from 'node:path';

const bool = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};
const number = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: number(process.env.PORT, 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: number(process.env.DB_PORT, 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME || 'mihistoria_salud',
    connectionLimit: number(process.env.DB_CONNECTION_LIMIT, 10)
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-me',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshDays: number(process.env.JWT_REFRESH_DAYS, 30)
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localDir: path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR || './storage/private'),
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
  seedDemo: bool(process.env.SEED_DEMO, true),
  demo: {
    email: process.env.DEMO_EMAIL || 'demo@mihistoria.local',
    password: process.env.DEMO_PASSWORD || 'Demo1234!'
  }
};

export function validateProductionSecrets() {
  if (env.nodeEnv !== 'production') return;
  const weak = [env.jwt.accessSecret, env.jwt.refreshSecret].some((x) => x.includes('change-me') || x.length < 32);
  if (weak) throw new Error('JWT_ACCESS_SECRET y JWT_REFRESH_SECRET deben ser secretos robustos en producción.');
}
