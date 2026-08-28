import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { randomId } from '../utils/security.js';
import { audit } from '../services/audit-service.js';
import { deletePrivateFile } from '../services/storage-service.js';

export const profileRouter = express.Router();
profileRouter.use(requireAuth);

const relationship = z.enum(['SELF', 'CHILD', 'PARENT', 'OTHER']);
const createSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  birthDate: z.string().date().optional().nullable(),
  relationship,
  notes: z.string().trim().max(1000).optional().nullable()
});
const updateSchema = createSchema.partial();

profileRouter.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.execute(
    `SELECT id, display_name AS displayName, birth_date AS birthDate, relationship, notes, created_at AS createdAt, updated_at AS updatedAt
       FROM health_profiles WHERE owner_user_id = ? ORDER BY relationship='SELF' DESC, created_at ASC`,
    [req.auth.userId]
  );
  res.json(rows);
}));

profileRouter.post('/', asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  const id = randomId();
  await db.execute(
    `INSERT INTO health_profiles (id, owner_user_id, display_name, birth_date, relationship, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, req.auth.userId, body.displayName, body.birthDate || null, body.relationship, body.notes || null]
  );
  await audit({ userId: req.auth.userId, profileId: id, action: 'CREATE', resourceType: 'HEALTH_PROFILE', resourceId: id, ip: req.ip });
  const profile = await assertProfileAccess(req.auth.userId, id);
  res.status(201).json(profile);
}));

profileRouter.get('/:profileId', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'READ', resourceType: 'HEALTH_PROFILE', resourceId: profile.id, ip: req.ip });
  res.json(profile);
}));

profileRouter.patch('/:profileId', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  const body = updateSchema.parse(req.body);
  if (profile.relationship === 'SELF' && body.relationship && body.relationship !== 'SELF') {
    return res.status(400).json({ error: 'El perfil principal no puede convertirse en dependiente.' });
  }
  if (profile.relationship !== 'SELF' && body.relationship === 'SELF') {
    return res.status(400).json({ error: 'Un perfil dependiente no puede convertirse en perfil principal.' });
  }
  const next = {
    displayName: body.displayName ?? profile.display_name,
    birthDate: body.birthDate === undefined ? profile.birth_date : body.birthDate,
    relationship: body.relationship ?? profile.relationship,
    notes: body.notes === undefined ? profile.notes : body.notes
  };
  await db.execute(
    `UPDATE health_profiles SET display_name=?, birth_date=?, relationship=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND owner_user_id=?`,
    [next.displayName, next.birthDate || null, next.relationship, next.notes || null, profile.id, req.auth.userId]
  );
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'UPDATE', resourceType: 'HEALTH_PROFILE', resourceId: profile.id, ip: req.ip });
  res.json(await assertProfileAccess(req.auth.userId, profile.id));
}));

profileRouter.delete('/:profileId', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  if (profile.relationship === 'SELF') {
    return res.status(400).json({ error: 'El perfil principal no se elimina desde esta versión.' });
  }
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'DELETE_REQUEST', resourceType: 'HEALTH_PROFILE', resourceId: profile.id, ip: req.ip });
  const [documents] = await db.execute('SELECT storage_driver, storage_key FROM clinical_documents WHERE profile_id=?', [profile.id]);
  for (const document of documents) await deletePrivateFile(document.storage_driver, document.storage_key);
  await db.execute('DELETE FROM health_profiles WHERE id=? AND owner_user_id=?', [profile.id, req.auth.userId]);
  res.status(204).end();
}));
