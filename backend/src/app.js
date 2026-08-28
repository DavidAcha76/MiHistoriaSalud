import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { authRouter } from './routes/auth-routes.js';
import { profileRouter } from './routes/profile-routes.js';
import { eventRouter } from './routes/event-routes.js';
import { documentRouter } from './routes/document-routes.js';
import { summaryRouter } from './routes/summary-routes.js';
import { aiRouter } from './routes/ai-routes.js';
import { errorHandler, notFound } from './middleware/errors.js';

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((x) => x.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api/auth', authLimiter, authRouter);

app.get('/health', (_req, res) => res.json({ ok: true, service: 'MiHistoria Salud API', time: new Date().toISOString() }));
app.use('/api/profiles', profileRouter);
app.use('/api', eventRouter);
app.use('/api', documentRouter);
app.use('/api', summaryRouter);
app.use('/api', aiRouter);
app.use(notFound);
app.use(errorHandler);
