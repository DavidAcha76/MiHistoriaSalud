import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';
import { audit } from '../services/audit-service.js';
import { analyzeSelectedEvents, hashAiInput } from '../services/ai-service.js';
import { getEventsWithDetails } from '../services/event-service.js';

export const aiRouter = express.Router();
aiRouter.use(requireAuth);

const schema = z.object({
  eventIds: z.array(z.string().uuid()).min(1).max(50),
  purpose: z.string().trim().min(3).max(300).optional().default('Revisión de información seleccionada')
});

aiRouter.post('/profiles/:profileId/ai/analyze', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const body = schema.parse(req.body);
  const events = await getEventsWithDetails(req.params.profileId, body.eventIds);
  if (events.length !== [...new Set(body.eventIds)].length) throw new HttpError(400, 'Uno o más registros seleccionados no pertenecen al perfil.');

  const analysisId = randomId();
  const inputHash = hashAiInput(events);
  await db.execute(
    `INSERT INTO ai_analyses (id, profile_id, requested_by_user_id, purpose, selected_event_ids, input_snapshot_hash, provider, model, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 'pending', 'PROCESSING')`,
    [analysisId, req.params.profileId, req.auth.userId, body.purpose, JSON.stringify(body.eventIds), inputHash]
  );

  try {
    const result = await analyzeSelectedEvents(events, body.purpose);
    await db.execute(
      `UPDATE ai_analyses SET provider=?, model=?, status='COMPLETED', output_json=?, safety_flags=? WHERE id=?`,
      [result.provider, result.model, JSON.stringify(result.output), JSON.stringify([]), analysisId]
    );
    await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'ANALYZE', resourceType: 'AI_ANALYSIS', resourceId: analysisId, metadata: { selectedCount: events.length, provider: result.provider }, ip: req.ip });
    res.status(201).json({ id: analysisId, provider: result.provider, model: result.model, createdAt: new Date().toISOString(), ...result.output });
  } catch (e) {
    await db.execute(`UPDATE ai_analyses SET status='REJECTED', safety_flags=? WHERE id=?`, [JSON.stringify(e.details?.flags || [e.message]), analysisId]);
    throw e;
  }
}));

aiRouter.get('/profiles/:profileId/ai/analyses', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [rows] = await db.execute(
    `SELECT id, purpose, provider, model, status, output_json AS output, created_at AS createdAt
       FROM ai_analyses WHERE profile_id=? ORDER BY created_at DESC LIMIT 20`,
    [req.params.profileId]
  );
  res.json(rows.map((r) => ({ ...r, output: typeof r.output === 'string' ? JSON.parse(r.output) : r.output })));
}));
