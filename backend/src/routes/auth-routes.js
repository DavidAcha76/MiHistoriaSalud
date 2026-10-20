import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { randomId, randomToken, sha256 } from '../utils/security.js';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../services/token-service.js';
import { requireAuth } from '../middleware/auth.js';
import { audit } from '../services/audit-service.js';
import { sendMail } from '../services/mail-service.js';
import { log, logError } from '../utils/logger.js';

export const authRouter = express.Router();

const email = z.string().trim().toLowerCase().email().max(190);
const password = z.string().min(8).max(128).regex(/[A-Z]/, 'Debe contener una mayúscula.').regex(/[a-z]/, 'Debe contener una minúscula.').regex(/\d/, 'Debe contener un número.');
const registerSchema = z.object({ fullName: z.string().trim().min(2).max(120), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(128), deviceInfo: z.string().max(255).optional() });
const refreshSchema = z.object({ refreshToken: z.string().min(20), deviceInfo: z.string().max(255).optional() });
const recoverSchema = z.object({ email });
const resetSchema = z.object({ token: z.string().trim().min(20).max(200), password });

const genericLoginError = 'Correo o contraseña incorrectos.';
const recoverMessage = 'Si el correo está registrado, te enviamos las instrucciones para crear una nueva contraseña. Revisa también la carpeta de spam.';

async function issueTokens(user, deviceInfo = null) {
  const sessionId = randomId();
  const refresh = createRefreshToken(user);
  const expiresAt = new Date(Date.now() + env.jwt.refreshDays * 86400000);
  await db.execute(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, device_info) VALUES (?, ?, ?, ?, ?)`,
    [sessionId, user.id, refresh.hash, expiresAt, deviceInfo || null]
  );
  return { accessToken: createAccessToken(user, sessionId), refreshToken: refresh.token };
}

/** PS-11: intentos fallidos recientes de una cuenta, a partir de la auditoría. */
async function recentFailures(userId) {
  const [rows] = await db.execute(
    `SELECT COUNT(*) AS total FROM audit_logs
      WHERE user_id = ? AND action = 'LOGIN_FAILED' AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [userId, env.security.lockoutMinutes]
  );
  return Number(rows[0].total);
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
  if (!user) {
    await audit({ userId: null, action: 'LOGIN_FAILED', resourceType: 'USER', metadata: { reason: 'UNKNOWN_ACCOUNT' }, ip: req.ip });
    throw new HttpError(401, genericLoginError);
  }
  if (await recentFailures(user.id) >= env.security.maxFailedLogins) {
    await audit({ userId: user.id, action: 'LOGIN_BLOCKED', resourceType: 'USER', resourceId: user.id, ip: req.ip });
    throw new HttpError(429, `Demasiados intentos fallidos. Por seguridad, espera ${env.security.lockoutMinutes} minutos o restablece tu contraseña.`);
  }
  if (!user.is_active || !(await bcrypt.compare(body.password, user.password_hash))) {
    await audit({ userId: user.id, action: 'LOGIN_FAILED', resourceType: 'USER', resourceId: user.id, metadata: { reason: user.is_active ? 'INVALID_PASSWORD' : 'INACTIVE_ACCOUNT' }, ip: req.ip });
    throw new HttpError(401, genericLoginError);
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

// RF-04: la sesión revocada deja sin efecto su refresh token y sus access tokens.
authRouter.post('/logout', asyncHandler(async (req, res) => {
  const body = z.object({ refreshToken: z.string().min(20) }).parse(req.body);
  const [sessions] = await db.execute('SELECT id, user_id FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL LIMIT 1', [sha256(body.refreshToken)]);
  await db.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL', [sha256(body.refreshToken)]);
  if (sessions.length) await audit({ userId: sessions[0].user_id, action: 'LOGOUT', resourceType: 'USER_SESSION', resourceId: sessions[0].id, ip: req.ip });
  res.status(204).end();
}));

// RF-03: inicia la recuperación sin revelar si el correo existe.
authRouter.post('/recover', asyncHandler(async (req, res) => {
  const body = recoverSchema.parse(req.body);
  const [users] = await db.execute('SELECT id, email, full_name FROM users WHERE email = ? AND is_active = TRUE LIMIT 1', [body.email]);
  const user = users[0];
  if (user) {
    const [recent] = await db.execute('SELECT COUNT(*) AS total FROM password_reset_tokens WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)', [user.id]);
    if (Number(recent[0].total) < 3) {
      const token = randomToken();
      const id = randomId();
      await db.execute(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [id, user.id, sha256(token), env.security.passwordResetMinutes]
      );
      const link = `${env.webAppUrl}/?restablecer=${encodeURIComponent(token)}`;
      const minutes = env.security.passwordResetMinutes;
      try {
        const result = await sendMail({
          to: user.email,
          subject: 'Restablece tu contraseña de Clinia',
          text: `Hola ${user.full_name}:\n\nRecibimos una solicitud para restablecer tu contraseña. Abre este enlace en los próximos ${minutes} minutos:\n${link}\n\nSi usas la app del celular, toca «Tengo un código» y pega este código:\n${token}\n\nSi no fuiste tú, ignora este mensaje: tu contraseña no cambiará.`,
          html: `<p>Hola ${user.full_name.replace(/[<>&]/g, '')}:</p><p>Recibimos una solicitud para restablecer tu contraseña. El enlace vence en ${minutes} minutos.</p><p><a href="${link}">Crear una nueva contraseña</a></p><p>Si usas la app del celular, toca «Tengo un código» y pega este código:</p><p><code>${token}</code></p><p>Si no fuiste tú, ignora este mensaje: tu contraseña no cambiará.</p>`
        });
        await audit({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', resourceType: 'USER', resourceId: user.id, metadata: { delivered: result.delivered }, ip: req.ip });
      } catch (error) {
        logError('password_reset_mail_failed', error);
        await audit({ userId: user.id, action: 'PASSWORD_RESET_REQUESTED', resourceType: 'USER', resourceId: user.id, metadata: { delivered: false }, ip: req.ip });
      }
    } else {
      log('warn', 'password_reset_throttled', { requestId: req.requestId });
    }
  }
  res.status(202).json({ message: recoverMessage });
}));

authRouter.post('/reset', asyncHandler(async (req, res) => {
  const body = resetSchema.parse(req.body);
  const [tokens] = await db.execute(
    `SELECT t.id, t.user_id FROM password_reset_tokens t JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW() AND u.is_active = TRUE LIMIT 1`,
    [sha256(body.token)]
  );
  if (!tokens.length) throw new HttpError(400, 'El enlace o código de recuperación no es válido o ya venció. Solicita uno nuevo.');
  const { id, user_id: userId } = tokens[0];
  const hash = await bcrypt.hash(body.password, 12);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
    await conn.execute('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL', [userId]);
    await conn.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
  await audit({ userId, action: 'PASSWORD_RESET', resourceType: 'USER', resourceId: userId, metadata: { tokenId: id }, ip: req.ip });
  res.json({ message: 'Tu contraseña se actualizó. Inicia sesión con la nueva contraseña.' });
}));

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const [users] = await db.execute('SELECT id, email, full_name, created_at FROM users WHERE id = ? LIMIT 1', [req.auth.userId]);
  if (!users.length) throw new HttpError(404, 'Usuario no encontrado.');
  const u = users[0];
  res.json({ id: u.id, email: u.email, fullName: u.full_name, createdAt: u.created_at });
}));
