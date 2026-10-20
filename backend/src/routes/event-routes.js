import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { audit } from '../services/audit-service.js';
import { createEvent, deleteEvent, EVENT_TYPES, getEventById, linkEvents, searchCondition, unlinkEvents, updateEvent } from '../services/event-service.js';

export const eventRouter = express.Router();
eventRouter.use(requireAuth);

const eventType = z.enum(EVENT_TYPES);
const detailsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({});
const createSchema = z.object({
  eventType,
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000).optional().nullable(),
  eventDate: z.string().date(),
  source: z.string().trim().max(255).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  details: detailsSchema
});
const updateSchema = createSchema.partial();

function toPositiveInt(value, fallback, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/** RF-22 a RF-24 / RNF-09: filtros y paginación del lado del servidor con consultas parametrizadas. */
async function listEvents(profileId, query) {
  const page = toPositiveInt(query.page, 1, 100000);
  const pageSize = toPositiveInt(query.pageSize, 20, 100);
  const offset = (page - 1) * pageSize;
  const params = [profileId];
  const where = ['profile_id = ?'];

  if (query.type) {
    where.push('event_type = ?');
    params.push(eventType.parse(query.type));
  }
  const from = query.from ? z.string().date().parse(query.from) : null;
  const to = query.to ? z.string().date().parse(query.to) : null;
  if (from && to && from > to) throw new HttpError(400, 'La fecha de inicio debe ser anterior a la fecha final.');
  if (from) { where.push('event_date >= ?'); params.push(from); }
  if (to) { where.push('event_date <= ?'); params.push(to); }
  const search = searchCondition(query.q);
  if (search) { where.push(search.sql); params.push(...search.params); }

  const [countRows] = await db.execute(`SELECT COUNT(*) AS total FROM health_events WHERE ${where.join(' AND ')}`, params);
  const [rows] = await db.execute(
    `SELECT id, profile_id AS profileId, event_type AS eventType, title, description, event_date AS eventDate, source, notes, created_at AS createdAt, updated_at AS updatedAt
       FROM health_events WHERE ${where.join(' AND ')} ORDER BY event_date DESC, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`,
    params
  );
  const total = Number(countRows[0].total);
  return { items: rows, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

eventRouter.get('/profiles/:profileId/events', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  res.json(await listEvents(req.params.profileId, req.query));
}));

// RF-23 / CU-09: búsqueda por palabras clave en registros y nombres de documentos del perfil.
eventRouter.get('/profiles/:profileId/search', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const search = searchCondition(req.query.q);
  if (!search) throw new HttpError(400, 'Escribe al menos una palabra para buscar.');
  const events = await listEvents(req.params.profileId, req.query);
  const like = `%${search.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const [documents] = await db.execute(
    `SELECT id, event_id AS eventId, original_name AS originalName, mime_type AS mimeType, size_bytes AS sizeBytes, created_at AS createdAt
       FROM clinical_documents WHERE profile_id = ? AND original_name LIKE ? ORDER BY created_at DESC LIMIT 20`,
    [req.params.profileId, like]
  );
  res.json({ query: search.q, events, documents });
}));

eventRouter.get('/profiles/:profileId/symptom-recurrences', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [rows] = await db.execute(
    `SELECT MIN(s.symptom_name) AS symptomName, COUNT(*) AS occurrences,
            MIN(e.event_date) AS firstRecordedAt, MAX(e.event_date) AS lastRecordedAt,
            SUM(s.status IN ('ACTIVE', 'RECURRENT')) AS activeOccurrences
       FROM health_events e
       JOIN symptoms s ON s.event_id=e.id
      WHERE e.profile_id=?
      GROUP BY LOWER(TRIM(s.symptom_name))
     HAVING COUNT(*) >= 2
      ORDER BY occurrences DESC, lastRecordedAt DESC
      LIMIT 20`,
    [req.params.profileId]
  );
  res.json(rows.map((row) => ({ ...row, occurrences: Number(row.occurrences), activeOccurrences: Number(row.activeOccurrences) })));
}));

eventRouter.post('/profiles/:profileId/events', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
  const body = createSchema.parse(req.body);
  const event = await createEvent({ profileId: req.params.profileId, userId: req.auth.userId, body });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'CREATE', resourceType: 'HEALTH_EVENT', resourceId: event.id, metadata: { type: body.eventType }, ip: req.ip });
  res.status(201).json(event);
}));

eventRouter.get('/profiles/:profileId/events/:eventId', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const event = await getEventById(req.params.eventId, req.params.profileId);
  res.json(event);
}));

eventRouter.get('/profiles/:profileId/events/:eventId/versions', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const eventId = z.string().uuid().parse(req.params.eventId);
  const [rows] = await db.execute(
    `SELECT version_number AS versionNumber, action, snapshot_json AS snapshot, created_at AS createdAt
       FROM health_event_versions WHERE event_id=? AND profile_id=? ORDER BY version_number DESC`,
    [eventId, req.params.profileId]
  );
  res.json(rows.map((row) => ({ ...row, snapshot: typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot })));
}));

eventRouter.patch('/profiles/:profileId/events/:eventId', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
  const body = updateSchema.parse(req.body);
  const event = await updateEvent({ eventId: req.params.eventId, profileId: req.params.profileId, userId: req.auth.userId, body });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'UPDATE', resourceType: 'HEALTH_EVENT', resourceId: event.id, ip: req.ip });
  res.json(event);
}));

eventRouter.delete('/profiles/:profileId/events/:eventId', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
  await deleteEvent({ eventId: req.params.eventId, profileId: req.params.profileId, userId: req.auth.userId });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'DELETE', resourceType: 'HEALTH_EVENT', resourceId: req.params.eventId, ip: req.ip });
  res.status(204).end();
}));

// RF-18: vincular registros del mismo perfil (por ejemplo, un resultado de laboratorio con su consulta).
const linkSchema = z.object({ linkedEventId: z.string().uuid() });

eventRouter.post('/profiles/:profileId/events/:eventId/links', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
  const eventId = z.string().uuid().parse(req.params.eventId);
  const { linkedEventId } = linkSchema.parse(req.body);
  const result = await linkEvents({ profileId: req.params.profileId, eventId, linkedEventId, userId: req.auth.userId });
  if (result.created) await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'LINK', resourceType: 'HEALTH_EVENT', resourceId: eventId, metadata: { linkedEventId }, ip: req.ip });
  res.status(result.created ? 201 : 200).json(await getEventById(eventId, req.params.profileId));
}));

eventRouter.delete('/profiles/:profileId/events/:eventId/links/:linkedEventId', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId, { write: true });
  const eventId = z.string().uuid().parse(req.params.eventId);
  const linkedEventId = z.string().uuid().parse(req.params.linkedEventId);
  await unlinkEvents({ profileId: req.params.profileId, eventId, linkedEventId });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'UNLINK', resourceType: 'HEALTH_EVENT', resourceId: eventId, metadata: { linkedEventId }, ip: req.ip });
  res.status(204).end();
}));
