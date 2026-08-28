import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { sha256 } from '../utils/security.js';

export function createAccessToken(user) {
  return jwt.sign({ email: user.email }, env.jwt.accessSecret, { subject: user.id, expiresIn: env.jwt.accessTtl });
}

export function createRefreshToken(user) {
  const nonce = crypto.randomBytes(24).toString('hex');
  const token = jwt.sign({ nonce }, env.jwt.refreshSecret, { subject: user.id, expiresIn: `${env.jwt.refreshDays}d` });
  return { token, hash: sha256(token) };
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}
