import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';

/** RF-30 / CU-12: trazabilidad de operaciones sobre un perfil autorizado, sin IP ni secretos. */
export const auditRouter = express.Router();
auditRouter.use(requireAuth);

export const AUDIT_GROUPS = {
  ACCESS: ['READ', 'DOWNLOAD', 'EXPORT_DATA', 'ACCESS_DENIED'],
  CHANGES: ['CREATE', 'UPDATE', 'DELETE', 'DELETE_REQUEST', 'UPLOAD', 'LINK', 'UNLINK', 'CONFIRM'],
  AI: ['ANALYZE', 'AI_CHAT', 'AI_CONSENT_GRANTED', 'AI_CONSENT_REVOKED'],
  SHARING: ['CREATE_SHARE_PACKAGE', 'REVOKE_SHARE_PACKAGE', 'AUTHORIZATION_GRANTED', 'AUTHORIZATION_UPDATED', 'AUTHORIZATION_REVOKED']
};
// Solo se exponen datos descriptivos de la operación; nunca contraseñas, tokens ni direcciones IP.
const safeMetadataKeys = ['type', 'mimeType', 'size', 'role', 'status', 'reason', 'relationship', 'selectedCount', 'focus', 'linkedEventId', 'eventId'];

const querySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  type: z.enum(Object.keys(AUDIT_GROUPS)).optional(),
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(25)
});

function safeMetadata(value) {
  const data = typeof value === 'string' ? JSON.parse(value || 'null') : value;
  if (!data || typeof data !== 'object') return null;
  const picked = Object.fromEntries(safeMetadataKeys.filter((key) => data[key] != null).map((key) => [key, data[key]]));
  return Object.keys(picked).length ? picked : null;
}

auditRouter.get('/profiles/:profileId/audit', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  const query = querySchema.parse(req.query);
  if (query.from && query.to && query.from > query.to) return res.status(400).json({ error: 'La fecha inicial debe ser anterior a la final.' });
  const where = ['l.profile_id = ?'];
  const params = [profile.id];
  if (query.from) { where.push('l.created_at >= ?'); params.push(`${query.from} 00:00:00`); }
  if (query.to) { where.push('l.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(query.to); }
  if (query.type) {
    const actions = AUDIT_GROUPS[query.type];
    where.push(`l.action IN (${actions.map(() => '?').join(',')})`);
    params.push(...actions);
  }
  const offset = (query.page - 1) * query.pageSize;
  const [count] = await db.execute(`SELECT COUNT(*) AS total FROM audit_logs l WHERE ${where.join(' AND ')}`, params);
  const [rows] = await db.execute(
    `SELECT l.id, l.action, l.resource_type AS resourceType, l.resource_id AS resourceId, l.metadata_json AS metadata,
            l.created_at AS createdAt, l.user_id AS actorId, u.full_name AS actorName
       FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY l.created_at DESC, l.id DESC LIMIT ${query.pageSize} OFFSET ${offset}`,
    params
  );
  const total = Number(count[0].total);
  res.json({
    items: rows.map(({ metadata, actorId, ...row }) => ({ ...row, id: String(row.id), details: safeMetadata(metadata), actorIsYou: actorId === req.auth.userId })),
    page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize)
  });
}));
