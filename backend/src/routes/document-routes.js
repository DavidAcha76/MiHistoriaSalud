import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';
import { audit } from '../services/audit-service.js';
import { deletePrivateFile, openPrivateFile, savePrivateFile } from '../services/storage-service.js';

export const documentRouter = express.Router();
documentRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.storage.maxFileMb * 1024 * 1024, files: 1 }
});

documentRouter.get('/profiles/:profileId/documents', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [rows] = await db.execute(
    `SELECT id, event_id AS eventId, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt
       FROM clinical_documents WHERE profile_id = ? ORDER BY created_at DESC`,
    [req.params.profileId]
  );
  res.json(rows);
}));

documentRouter.post('/profiles/:profileId/documents', upload.single('file'), asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const eventId = req.body.eventId ? z.string().uuid().parse(req.body.eventId) : null;
  if (eventId) {
    const [events] = await db.execute('SELECT id FROM health_events WHERE id=? AND profile_id=? LIMIT 1', [eventId, req.params.profileId]);
    if (!events.length) throw new HttpError(400, 'El evento asociado no pertenece al perfil.');
  }
  const stored = await savePrivateFile(req.file, req.params.profileId);
  const id = randomId();
  try {
    await db.execute(
      `INSERT INTO clinical_documents (id, profile_id, event_id, original_name, stored_name, mime_type, size_bytes, storage_driver, storage_key, uploaded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.profileId, eventId, req.file.originalname, stored.key.split('/').pop(), req.file.mimetype, req.file.size, stored.driver, stored.key, req.auth.userId]
    );
  } catch (e) {
    await deletePrivateFile(stored.driver, stored.key);
    throw e;
  }
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'UPLOAD', resourceType: 'CLINICAL_DOCUMENT', resourceId: id, metadata: { mimeType: req.file.mimetype, size: req.file.size }, ip: req.ip });
  res.status(201).json({ id, eventId, originalName: req.file.originalname, mimeType: req.file.mimetype, sizeBytes: req.file.size });
}));

documentRouter.get('/profiles/:profileId/documents/:documentId/download', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [rows] = await db.execute(
    `SELECT * FROM clinical_documents WHERE id = ? AND profile_id = ? LIMIT 1`,
    [req.params.documentId, req.params.profileId]
  );
  if (!rows.length) throw new HttpError(404, 'Documento no encontrado.');
  const doc = rows[0];
  const { stream } = await openPrivateFile(doc.storage_driver, doc.storage_key);
  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'DOWNLOAD', resourceType: 'CLINICAL_DOCUMENT', resourceId: doc.id, ip: req.ip });
  stream.on('error', (e) => res.destroy(e));
  stream.pipe(res);
}));

documentRouter.delete('/profiles/:profileId/documents/:documentId', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [rows] = await db.execute('SELECT * FROM clinical_documents WHERE id=? AND profile_id=? LIMIT 1', [req.params.documentId, req.params.profileId]);
  if (!rows.length) throw new HttpError(404, 'Documento no encontrado.');
  await db.execute('DELETE FROM clinical_documents WHERE id=?', [req.params.documentId]);
  await deletePrivateFile(rows[0].storage_driver, rows[0].storage_key);
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'DELETE', resourceType: 'CLINICAL_DOCUMENT', resourceId: req.params.documentId, ip: req.ip });
  res.status(204).end();
}));
