import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(new HttpError(401, 'Autenticación requerida.'));
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    req.auth = { userId: payload.sub, email: payload.email };
    next();
  } catch {
    next(new HttpError(401, 'Sesión expirada o token inválido.'));
  }
}
