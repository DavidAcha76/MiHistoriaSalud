import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { randomId, sha256 } from '../utils/security.js';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../services/token-service.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../services/audit-service.js';

export const authRouter = express.Router();

const email = z.string().trim().toLowerCase().email().max(190);
const password = z.string().min(8).max(128).regex(/[A-Z]/, 'Debe contener una mayúscula.').regex(/[a-z]/, 'Debe contener una minúscula.').regex(/\d/, 'Debe contener un número.');
const registerSchema = z.object({ fullName: z.string().trim().min(2).max(120), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(128), deviceInfo: z.string().max(255).optional() });
const refreshSchema = z.object({ refreshToken: z.string().min(20), deviceInfo: z.string().max(255).optional() });

async function issueTokens(user, deviceInfo = null) {
  const accessToken = createAccessToken(user);
  const refresh = createRefreshToken(user);
  const expiresAt = new Date(Date.now() + env.jwt.refreshDays * 86400000);
  await db.execute(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, device_info) VALUES (?, ?, ?, ?, ?)`,
    [randomId(), user.id, refresh.hash, expiresAt, deviceInfo || null]
  );
  return { accessToken, refreshToken: refresh.token };
}

authRouter.post('/register', asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const [existing] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [body.email]);
  if (existing.length) throw new HttpError(409, 'Ya existe una cuenta con ese correo.');

  const userId = randomId();
  const profileId = randomId();
  const hash = await bcrypt.hash(body.password, 12);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('INSERT INTO users (id, email, password_hash, full_name) VALUES (?, ?, ?, ?)', [userId, body.email, hash, body.fullName]);
    await conn.execute(
      `INSERT INTO health_profiles (id, owner_user_id, display_name, relationship) VALUES (?, ?, ?, 'SELF')`,
      [profileId, userId, body.fullName]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }

  const user = { id: userId, email: body.email, full_name: body.fullName };
  const tokens = await issueTokens(user, req.get('user-agent'));
  await audit({ userId, profileId, action: 'REGISTER', resourceType: 'USER', resourceId: userId, ip: req.ip });
  res.status(201).json({ user: { id: userId, email: body.email, fullName: body.fullName }, defaultProfileId: profileId, ...tokens });
}));

authRouter.post('/login', asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const [rows] = await db.execute('SELECT id, email, password_hash, full_name, is_active FROM users WHERE email = ? LIMIT 1', [body.email]);
  const user = rows[0];
  if (!user || !user.is_active || !(await bcrypt.compare(body.password, user.password_hash))) {
    throw new HttpError(401, 'Correo o contraseña incorrectos.');
  }
  const tokens = await issueTokens(user, body.deviceInfo || req.get('user-agent'));
  await audit({ userId: user.id, action: 'LOGIN', resourceType: 'USER', resourceId: user.id, ip: req.ip });
  res.json({ user: { id: user.id, email: user.email, fullName: user.full_name }, ...tokens });
}));

authRouter.post('/refresh', asyncHandler(async (req, res) => {
  const body = refreshSchema.parse(req.body);
  let payload;
  try { payload = verifyRefreshToken(body.refreshToken); } catch { throw new HttpError(401, 'Refresh token inválido o expirado.'); }
  const tokenHash = sha256(body.refreshToken);
  const [tokens] = await db.execute(
    `SELECT id, user_id FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [tokenHash]
  );
  if (!tokens.length || tokens[0].user_id !== payload.sub) throw new HttpError(401, 'Refresh token revocado o desconocido.');
  const [users] = await db.execute('SELECT id, email, full_name, is_active FROM users WHERE id = ? LIMIT 1', [payload.sub]);
  const user = users[0];
  if (!user?.is_active) throw new HttpError(401, 'La cuenta no está disponible.');

  await db.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [tokens[0].id]);
  const newTokens = await issueTokens(user, body.deviceInfo || req.get('user-agent'));
  res.json({ user: { id: user.id, email: user.email, fullName: user.full_name }, ...newTokens });
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
  await db.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ?', [sha256(body.refreshToken)]);
  res.status(204).end();
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [users] = await db.execute('SELECT id, email, full_name, created_at FROM users WHERE id = ? LIMIT 1', [req.auth.userId]);
  if (!users.length) throw new HttpError(404, 'Usuario no encontrado.');
  const u = users[0];
  res.json({ id: u.id, email: u.email, fullName: u.full_name, createdAt: u.created_at });
}));
