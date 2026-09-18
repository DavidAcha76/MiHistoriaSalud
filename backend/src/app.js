import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { env } from './config/env.js';
import { pingDb } from './config/db.js';
import { authRouter } from './routes/auth-routes.js';
import { profileRouter } from './routes/profile-routes.js';
import { eventRouter } from './routes/event-routes.js';
import { documentRouter } from './routes/document-routes.js';
import { summaryRouter } from './routes/summary-routes.js';
import { aiRouter } from './routes/ai-routes.js';
import { billingRouter } from './routes/billing-routes.js';
import { notificationRouter } from './routes/notification-routes.js';
import { shareRouter } from './routes/share-routes.js';
import { publicShareRouter } from './routes/public-share-routes.js';
import { medicationRouter } from './routes/medication-routes.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { log, logError } from './utils/logger.js';

export const app = express();
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.set('X-Request-Id', req.requestId);
  next();
});
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((x) => x.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const limited = (kind, limit) => rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    log('warn', 'rate_limit_reached', { requestId: req.requestId, path: req.path, kind });
    res.status(429).json({ error: 'Demasiadas solicitudes. Intenta nuevamente más tarde.' });
  }
});
const authLimiter = limited('auth', 80);
const aiLimiter = limited('ai', 40);
app.use('/api/auth', authLimiter, authRouter);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'Clinicsoft API', time: new Date().toISOString() }));
app.get('/health/ready', async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await pingDb();
    res.json({ ok: true, database: 'connected' });
  } catch (error) {
    logError('database_readiness_failed', error, { requestId: _req.requestId });
    res.status(503).json({ ok: false, database: 'unavailable' });
  }
});
app.use(publicShareRouter);
app.use('/api/profiles', profileRouter);
app.use('/api', eventRouter);
app.use('/api', documentRouter);
app.use('/api', summaryRouter);
app.use('/api/billing', billingRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api', medicationRouter);
app.use('/api', shareRouter);
app.use('/api', aiLimiter, aiRouter);
app.use(notFound);
app.use(errorHandler);
