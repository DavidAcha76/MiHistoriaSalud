import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { AUTHORIZATION_ROLES, assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';
import { audit } from '../services/audit-service.js';

/** RF-07: el titular mantiene quién más puede consultar o actualizar cada perfil. */
export const authorizationRouter = express.Router();
authorizationRouter.use(requireAuth);

const role = z.enum(AUTHORIZATION_ROLES);
const grantSchema = z.object({ email: z.string().trim().toLowerCase().email().max(190), role });
const updateSchema = z.object({ role: role.optional(), status: z.enum(['ACTIVE', 'REVOKED']).optional() }).refine((value) => value.role || value.status, 'Indica el rol o el estado.');

async function listAuthorizations(profileId) {
  const [rows] = await db.execute(
    `SELECT a.id, a.user_id AS userId, u.email, u.full_name AS fullName, a.role, a.status,
            a.created_at AS createdAt, a.updated_at AS updatedAt, a.revoked_at AS revokedAt
       FROM profile_authorizations a JOIN users u ON u.id = a.user_id
      WHERE a.profile_id = ? ORDER BY a.status = 'ACTIVE' DESC, a.created_at DESC`,
    [profileId]
  );
  return rows;
}

authorizationRouter.get('/profiles/:profileId/authorizations', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { owner: true });
  res.json(await listAuthorizations(req.params.profileId));
}));

authorizationRouter.post('/profiles/:profileId/authorizations', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId, { owner: true });
  const body = grantSchema.parse(req.body);
  const [users] = await db.execute('SELECT id FROM users WHERE email = ? AND is_active = TRUE LIMIT 1', [body.email]);
  if (!users.length) throw new HttpError(404, 'No encontramos una cuenta activa de Clinia con ese correo. Pide a la persona que se registre primero.');
  const userId = users[0].id;
  if (userId === req.auth.userId) throw new HttpError(400, 'Ya eres titular de este perfil.');
  const [existing] = await db.execute('SELECT id, role, status FROM profile_authorizations WHERE profile_id = ? AND user_id = ? LIMIT 1', [profile.id, userId]);
  let id = existing[0]?.id;
  if (existing.length && existing[0].status === 'ACTIVE' && existing[0].role === body.role) {
    throw new HttpError(409, 'Esa persona ya tiene esta autorización vigente.');
  }
  if (existing.length) {
    await db.execute(`UPDATE profile_authorizations SET role = ?, status = 'ACTIVE', revoked_at = NULL, granted_by_user_id = ? WHERE id = ?`, [body.role, req.auth.userId, id]);
  } else {
    id = randomId();
    await db.execute(
      `INSERT INTO profile_authorizations (id, profile_id, user_id, role, status, granted_by_user_id) VALUES (?, ?, ?, ?, 'ACTIVE', ?)`,
      [id, profile.id, userId, body.role, req.auth.userId]
    );
  }
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'AUTHORIZATION_GRANTED', resourceType: 'PROFILE_AUTHORIZATION', resourceId: id, metadata: { role: body.role }, ip: req.ip });
  res.status(existing.length ? 200 : 201).json((await listAuthorizations(profile.id)).find((item) => item.id === id));
}));

authorizationRouter.patch('/profiles/:profileId/authorizations/:authorizationId', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId, { owner: true });
  const authorizationId = z.string().uuid().parse(req.params.authorizationId);
  const body = updateSchema.parse(req.body);
  const [rows] = await db.execute('SELECT id, role, status FROM profile_authorizations WHERE id = ? AND profile_id = ? LIMIT 1', [authorizationId, profile.id]);
  if (!rows.length) throw new HttpError(404, 'Autorización no encontrada.');
  const next = { role: body.role ?? rows[0].role, status: body.status ?? rows[0].status };
  await db.execute(
    `UPDATE profile_authorizations SET role = ?, status = ?, revoked_at = ${next.status === 'REVOKED' ? 'COALESCE(revoked_at, NOW())' : 'NULL'} WHERE id = ?`,
    [next.role, next.status, authorizationId]
  );
  await audit({ userId: req.auth.userId, profileId: profile.id, action: next.status === 'REVOKED' ? 'AUTHORIZATION_REVOKED' : 'AUTHORIZATION_UPDATED', resourceType: 'PROFILE_AUTHORIZATION', resourceId: authorizationId, metadata: next, ip: req.ip });
  res.json((await listAuthorizations(profile.id)).find((item) => item.id === authorizationId));
}));

authorizationRouter.delete('/profiles/:profileId/authorizations/:authorizationId', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId, { owner: true });
  const authorizationId = z.string().uuid().parse(req.params.authorizationId);
  const [result] = await db.execute(
    `UPDATE profile_authorizations SET status = 'REVOKED', revoked_at = COALESCE(revoked_at, NOW()) WHERE id = ? AND profile_id = ?`,
    [authorizationId, profile.id]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Autorización no encontrada.');
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'AUTHORIZATION_REVOKED', resourceType: 'PROFILE_AUTHORIZATION', resourceId: authorizationId, ip: req.ip });
  res.status(204).end();
}));
