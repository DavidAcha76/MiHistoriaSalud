import jwt from 'jsonwebtoken';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/**
 * RG-01 / PS-06: exige un token vigente asociado a una sesión activa de una cuenta activa.
 * Cerrar sesión o restablecer la contraseña revoca la sesión y rechaza sus tokens de inmediato.
 */
export async function requireAuth(req, _res, next) {
  // Varios routers montados en /api aplican este middleware: la sesión se valida una sola vez por solicitud.
  if (req.auth) return next();
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'Autenticación requerida.'));
  let payload;
  try { payload = jwt.verify(token, env.jwt.accessSecret); } catch { return next(new HttpError(401, 'Sesión expirada o token inválido.')); }
  if (!payload.sid) return next(new HttpError(401, 'Sesión expirada o token inválido.'));
  try {
    const [rows] = await db.execute(
      `SELECT r.id FROM refresh_tokens r JOIN users u ON u.id = r.user_id
        WHERE r.id = ? AND r.user_id = ? AND r.revoked_at IS NULL AND r.expires_at > NOW() AND u.is_active = TRUE LIMIT 1`,
      [payload.sid, payload.sub]
    );
    if (!rows.length) return next(new HttpError(401, 'La sesión terminó. Vuelve a iniciar sesión.'));
  } catch (error) { return next(error); }
  req.auth = { userId: payload.sub, email: payload.email, sessionId: payload.sid };
  next();
}
