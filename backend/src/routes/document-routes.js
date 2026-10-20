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

const documentColumns = `d.id, d.event_id AS eventId, e.title AS eventTitle, d.original_name AS originalName, d.mime_type AS mimeType,
  d.size_bytes AS sizeBytes, d.content_sha256 AS sha256, d.created_at AS createdAt`;

documentRouter.get('/profiles/:profileId/documents', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const from = `FROM clinical_documents d LEFT JOIN health_events e ON e.id = d.event_id WHERE d.profile_id = ?`;
  // RNF-09: con `page` la respuesta es paginada; sin él se conserva la lista para clientes anteriores.
  if (req.query.page) {
    const query = z.object({ page: z.coerce.number().int().min(1).max(100000), pageSize: z.coerce.number().int().min(1).max(100).optional().default(20) }).parse(req.query);
    const [count] = await db.execute(`SELECT COUNT(*) AS total ${from}`, [req.params.profileId]);
    const [rows] = await db.execute(`SELECT ${documentColumns} ${from} ORDER BY d.created_at DESC LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`, [req.params.profileId]);
    const total = Number(count[0].total);
    return res.json({ items: rows, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) });
  }
  const [rows] = await db.execute(`SELECT ${documentColumns} ${from} ORDER BY d.created_at DESC LIMIT 500`, [req.params.profileId]);
  res.json(rows);
}));

// RF-18: vincula o desvincula un documento existente con un registro del mismo perfil.
documentRouter.patch('/profiles/:profileId/documents/:documentId', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
  const documentId = z.string().uuid().parse(req.params.documentId);
  const { eventId } = z.object({ eventId: z.string().uuid().nullable() }).parse(req.body);
  if (eventId) {
    const [events] = await db.execute('SELECT id FROM health_events WHERE id=? AND profile_id=? LIMIT 1', [eventId, req.params.profileId]);
    if (!events.length) throw new HttpError(400, 'El registro elegido no pertenece a este perfil.');
  }
  const [result] = await db.execute('UPDATE clinical_documents SET event_id=? WHERE id=? AND profile_id=?', [eventId, documentId, req.params.profileId]);
  if (!result.affectedRows) throw new HttpError(404, 'Documento no encontrado.');
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: eventId ? 'LINK' : 'UNLINK', resourceType: 'CLINICAL_DOCUMENT', resourceId: documentId, metadata: { eventId }, ip: req.ip });
  const [rows] = await db.execute(`SELECT ${documentColumns} FROM clinical_documents d LEFT JOIN health_events e ON e.id = d.event_id WHERE d.id = ?`, [documentId]);
  res.json(rows[0]);
}));

documentRouter.post('/profiles/:profileId/documents', upload.single('file'), asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
  const eventId = req.body.eventId ? z.string().uuid().parse(req.body.eventId) : null;
  if (eventId) {
    const [events] = await db.execute('SELECT id FROM health_events WHERE id=? AND profile_id=? LIMIT 1', [eventId, req.params.profileId]);
    if (!events.length) throw new HttpError(400, 'El evento asociado no pertenece al perfil.');
  }
  const id = randomId();
  const stored = await savePrivateFile(req.file, req.params.profileId);
  try {
    await db.execute(
      `INSERT INTO clinical_documents (id, profile_id, event_id, original_name, stored_name, mime_type, size_bytes, content_sha256, storage_driver, storage_key, content_blob, uploaded_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.params.profileId, eventId, req.file.originalname.slice(0, 255), stored.key.split('/').pop(), stored.mimeType, req.file.size, stored.sha256, stored.driver, stored.key, stored.content || null, req.auth.userId]
    );
  } catch (e) {
    // CU-07 / PI-03: si fallan los metadatos no queda un objeto huérfano en el almacenamiento.
    await deletePrivateFile(stored.driver, stored.key);
    throw e;
  }
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'UPLOAD', resourceType: 'CLINICAL_DOCUMENT', resourceId: id, metadata: { mimeType: stored.mimeType, size: req.file.size, eventId }, ip: req.ip });
  res.status(201).json({ id, eventId, originalName: req.file.originalname, mimeType: stored.mimeType, sizeBytes: req.file.size, sha256: stored.sha256 });
}));

documentRouter.get('/profiles/:profileId/documents/:documentId/download', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [rows] = await db.execute(
    `SELECT * FROM clinical_documents WHERE id = ? AND profile_id = ? LIMIT 1`,
    [req.params.documentId, req.params.profileId]
  );
  if (!rows.length) throw new HttpError(404, 'Documento no encontrado.');
  const doc = rows[0];
  const { stream } = await openPrivateFile(doc.storage_driver, doc.storage_key, doc.content_blob);
  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'DOWNLOAD', resourceType: 'CLINICAL_DOCUMENT', resourceId: doc.id, ip: req.ip });
  stream.on('error', (e) => res.destroy(e));
  stream.pipe(res);
}));

documentRouter.delete('/profiles/:profileId/documents/:documentId', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
  const [rows] = await db.execute('SELECT * FROM clinical_documents WHERE id=? AND profile_id=? LIMIT 1', [req.params.documentId, req.params.profileId]);
  if (!rows.length) throw new HttpError(404, 'Documento no encontrado.');
  await db.execute('DELETE FROM clinical_documents WHERE id=?', [req.params.documentId]);
  await deletePrivateFile(rows[0].storage_driver, rows[0].storage_key);
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'DELETE', resourceType: 'CLINICAL_DOCUMENT', resourceId: req.params.documentId, ip: req.ip });
  res.status(204).end();
}));
