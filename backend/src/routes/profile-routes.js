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

const publicProfile = (row) => ({
  id: row.id,
  displayName: row.display_name,
  birthDate: row.birth_date,
  relationship: row.relationship,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  accessRole: row.access_role
});

// RF-02 / RF-08: perfiles propios y perfiles autorizados vigentes, con el rol de la cuenta sobre cada uno.
profileRouter.get('/', asyncHandler(async (req, res) => {
  const [rows] = await db.execute(
    `SELECT p.id, p.display_name AS displayName, p.birth_date AS birthDate, p.relationship, p.notes,
            p.created_at AS createdAt, p.updated_at AS updatedAt,
            CASE WHEN p.owner_user_id = ? THEN 'OWNER' ELSE a.role END AS accessRole,
            CASE WHEN p.owner_user_id = ? THEN NULL ELSE u.full_name END AS ownerName
       FROM health_profiles p
       LEFT JOIN profile_authorizations a ON a.profile_id = p.id AND a.user_id = ? AND a.status = 'ACTIVE'
       LEFT JOIN users u ON u.id = p.owner_user_id
      WHERE p.owner_user_id = ? OR a.id IS NOT NULL
      ORDER BY p.owner_user_id = ? DESC, p.relationship = 'SELF' DESC, p.created_at ASC`,
    [req.auth.userId, req.auth.userId, req.auth.userId, req.auth.userId, req.auth.userId]
  );
  res.json(rows);
}));

profileRouter.post('/', asyncHandler(async (req, res) => {
  const body = createSchema.parse(req.body);
  if (body.relationship === 'SELF') return res.status(400).json({ error: 'Cada cuenta tiene un único perfil principal; elige la relación del dependiente.' });
  const id = randomId();
  await db.execute(
    `INSERT INTO health_profiles (id, owner_user_id, display_name, birth_date, relationship, notes) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, req.auth.userId, body.displayName, body.birthDate || null, body.relationship, body.notes || null]
  );
  await audit({ userId: req.auth.userId, profileId: id, action: 'CREATE', resourceType: 'HEALTH_PROFILE', resourceId: id, metadata: { relationship: body.relationship }, ip: req.ip });
  res.status(201).json(publicProfile(await assertProfileAccess(req.auth.userId, id)));
}));

profileRouter.get('/:profileId', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'READ', resourceType: 'HEALTH_PROFILE', resourceId: profile.id, ip: req.ip });
  res.json(publicProfile(profile));
}));

// RF-05 / CU-03: el titular y los representantes autorizados actualizan los datos básicos.
profileRouter.patch('/:profileId', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
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
    `UPDATE health_profiles SET display_name=?, birth_date=?, relationship=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [next.displayName, next.birthDate || null, next.relationship, next.notes || null, profile.id]
  );
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'UPDATE', resourceType: 'HEALTH_PROFILE', resourceId: profile.id, ip: req.ip });
  res.json(publicProfile(await assertProfileAccess(req.auth.userId, profile.id)));
}));

profileRouter.delete('/:profileId', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId, { owner: true });
  if (profile.relationship === 'SELF') {
    return res.status(400).json({ error: 'El perfil principal no se elimina desde esta versión.' });
  }
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'DELETE_REQUEST', resourceType: 'HEALTH_PROFILE', resourceId: profile.id, ip: req.ip });
  const [documents] = await db.execute('SELECT storage_driver, storage_key FROM clinical_documents WHERE profile_id=?', [profile.id]);
  for (const document of documents) await deletePrivateFile(document.storage_driver, document.storage_key);
  await db.execute('DELETE FROM health_profiles WHERE id=? AND owner_user_id=?', [profile.id, req.auth.userId]);
  res.status(204).end();
}));
