import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { audit } from '../services/audit-service.js';
import { getEventsWithDetails } from '../services/event-service.js';
import { buildConsultationSummary } from '../services/summary-service.js';
import { createSharePackage } from '../services/share-service.js';

export const shareRouter = express.Router();
shareRouter.use(requireAuth);

const createSchema = z.object({
  title: z.string().trim().min(3).max(180).default('Información para consulta'),
  eventIds: z.array(z.string().uuid()).max(50).default([]),
  documentIds: z.array(z.string().uuid()).max(50).default([]),
  includeSummary: z.boolean().default(true),
  expiresInDays: z.number().int().min(1).max(30).default(7)
});

shareRouter.get('/profiles/:profileId/share-packages', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [rows] = await db.execute(
    `SELECT id, title, expires_at AS expiresAt, revoked_at AS revokedAt, last_accessed_at AS lastAccessedAt, created_at AS createdAt
       FROM share_packages WHERE profile_id=? ORDER BY created_at DESC LIMIT 30`,
    [req.params.profileId]
  );
  res.json(rows);
}));

shareRouter.post('/profiles/:profileId/share-packages', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  const body = createSchema.parse(req.body);
  const eventIds = [...new Set(body.eventIds)];
  const documentIds = [...new Set(body.documentIds)];
  if (!body.includeSummary && !eventIds.length && !documentIds.length) {
    throw new HttpError(400, 'Selecciona un resumen, evento o documento para compartir.');
  }
  const events = await getEventsWithDetails(profile.id, eventIds);
  if (events.length !== eventIds.length) throw new HttpError(400, 'Uno o más eventos no pertenecen al perfil.');
  let documents = [];
  if (documentIds.length) {
    const placeholders = documentIds.map(() => '?').join(',');
    const [rows] = await db.execute(
      `SELECT id, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes
         FROM clinical_documents WHERE profile_id=? AND id IN (${placeholders})`,
      [profile.id, ...documentIds]
    );
    if (rows.length !== documentIds.length) throw new HttpError(400, 'Uno o más documentos no pertenecen al perfil.');
    documents = rows;
  }
  const summary = body.includeSummary ? await buildConsultationSummary(profile) : null;
  const expiresAt = new Date(Date.now() + body.expiresInDays * 86400000);
  const created = await createSharePackage({ profileId: profile.id, userId: req.auth.userId, title: body.title, events, documents, summary, expiresAt });
  const shareUrl = `${env.appBaseUrl}/share/${created.token}`;
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'CREATE_SHARE_PACKAGE', resourceType: 'SHARE_PACKAGE', resourceId: created.id, metadata: { eventCount: events.length, documentCount: documents.length, expiresAt }, ip: req.ip });
  res.status(201).json({ id: created.id, shareUrl, expiresAt, title: body.title });
}));

shareRouter.post('/profiles/:profileId/share-packages/:packageId/revoke', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const packageId = z.string().uuid().parse(req.params.packageId);
  const [result] = await db.execute(
    'UPDATE share_packages SET revoked_at=COALESCE(revoked_at, CURRENT_TIMESTAMP) WHERE id=? AND profile_id=?',
    [packageId, req.params.profileId]
  );
  if (!result.affectedRows) throw new HttpError(404, 'Paquete no encontrado.');
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'REVOKE_SHARE_PACKAGE', resourceType: 'SHARE_PACKAGE', resourceId: packageId, ip: req.ip });
  res.status(204).end();
}));

shareRouter.get('/profiles/:profileId/data-export', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [eventRows, documentRows, analyses] = await Promise.all([
    db.execute('SELECT id FROM health_events WHERE profile_id=? ORDER BY event_date ASC', [profile.id]),
    db.execute(`SELECT id, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt FROM clinical_documents WHERE profile_id=? ORDER BY created_at ASC`, [profile.id]),
    db.execute(`SELECT id, purpose, mode, status, output_json AS output, created_at AS createdAt FROM ai_analyses WHERE profile_id=? ORDER BY created_at ASC`, [profile.id])
  ]);
  const events = await getEventsWithDetails(profile.id, eventRows[0].map((row) => row.id));
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'EXPORT_DATA', resourceType: 'HEALTH_PROFILE', resourceId: profile.id, ip: req.ip });
  res.setHeader('Content-Disposition', `attachment; filename="mihistoria-${profile.id}.json"`);
  res.json({ exportedAt: new Date().toISOString(), profile, events, documents: documentRows[0], analyses: analyses[0] });
}));
