import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';
import { audit } from '../services/audit-service.js';
import { analyzeSelectedEvents, answerOrganizerChat, hashAiInput } from '../services/ai-service.js';
import { getEventsWithDetails } from '../services/event-service.js';
import { ensureAnalysisAllowed, ensureChatAllowed, getPlanStatus, recordUsage, setAiConsent } from '../services/plan-service.js';

export const aiRouter = express.Router();
aiRouter.use(requireAuth);

const analysisSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1).max(50),
  purpose: z.string().trim().min(3).max(300).optional().default('Revisión informativa de registros seleccionados')
});
const consentSchema = z.object({ granted: z.boolean() });
const chatSchema = z.object({ conversationId: z.string().uuid().optional(), message: z.string().trim().min(1).max(1500) });

aiRouter.get('/profiles/:profileId/ai/status', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  res.json(await getPlanStatus({ userId: req.auth.userId, profileId: req.params.profileId }));
}));

aiRouter.put('/profiles/:profileId/ai/consent', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const { granted } = consentSchema.parse(req.body);
  const consent = await setAiConsent({ profileId: req.params.profileId, userId: req.auth.userId, granted });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: granted ? 'AI_CONSENT_GRANTED' : 'AI_CONSENT_REVOKED', resourceType: 'AI_CONSENT', resourceId: req.params.profileId, ip: req.ip });
  res.json(consent);
}));

aiRouter.post('/profiles/:profileId/ai/analyze', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const body = analysisSchema.parse(req.body);
  const plan = await ensureAnalysisAllowed({ userId: req.auth.userId, profileId: req.params.profileId });
  const events = await getEventsWithDetails(req.params.profileId, body.eventIds);
  if (events.length !== [...new Set(body.eventIds)].length) throw new HttpError(400, 'Uno o más registros seleccionados no pertenecen al perfil.');

  const analysisId = randomId();
  const inputHash = hashAiInput(events);
  await db.execute(
    `INSERT INTO ai_analyses (id, profile_id, requested_by_user_id, purpose, mode, selected_event_ids, input_snapshot_hash, provider, model, status)
     VALUES (?, ?, ?, ?, 'MANUAL', ?, ?, 'pending', 'pending', 'PROCESSING')`,
    [analysisId, req.params.profileId, req.auth.userId, body.purpose, JSON.stringify(body.eventIds), inputHash]
  );

  try {
    const result = await analyzeSelectedEvents(events, body.purpose);
    await db.execute(
      `UPDATE ai_analyses SET provider=?, model=?, status='COMPLETED', output_json=?, safety_flags=? WHERE id=?`,
      [result.provider, result.model, JSON.stringify(result.output), JSON.stringify([]), analysisId]
    );
    await recordUsage({ userId: req.auth.userId, profileId: req.params.profileId, planCode: plan.code, usageType: 'ANALYSIS', metadata: { analysisId, mode: 'MANUAL', selectedCount: events.length } });
    await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'ANALYZE', resourceType: 'AI_ANALYSIS', resourceId: analysisId, metadata: { selectedCount: events.length, provider: result.provider }, ip: req.ip });
    res.status(201).json({ id: analysisId, provider: result.provider, model: result.model, createdAt: new Date().toISOString(), plan: plan.code, ...result.output });
  } catch (error) {
    await db.execute(`UPDATE ai_analyses SET status='REJECTED', safety_flags=? WHERE id=?`, [JSON.stringify(error.details?.flags || [error.message]), analysisId]);
    throw error;
  }
}));

aiRouter.get('/profiles/:profileId/ai/chat/latest', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [conversations] = await db.execute(
    `SELECT id, title, created_at AS createdAt, updated_at AS updatedAt FROM ai_conversations
      WHERE profile_id=? AND user_id=? ORDER BY updated_at DESC LIMIT 1`,
    [req.params.profileId, req.auth.userId]
  );
  if (!conversations.length) return res.json({ conversation: null, messages: [] });
  const conversation = conversations[0];
  const [messages] = await db.execute(
    `SELECT id, role, content, created_at AS createdAt FROM ai_messages
      WHERE conversation_id=? ORDER BY created_at ASC LIMIT 100`,
    [conversation.id]
  );
  res.json({ conversation, messages });
}));

aiRouter.post('/profiles/:profileId/ai/chat', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const body = chatSchema.parse(req.body);
  const entitlement = await ensureChatAllowed({ userId: req.auth.userId, profileId: req.params.profileId });
  let conversationId = body.conversationId;
  if (conversationId) {
    const [rows] = await db.execute('SELECT id FROM ai_conversations WHERE id=? AND profile_id=? AND user_id=? LIMIT 1', [conversationId, req.params.profileId, req.auth.userId]);
    if (!rows.length) throw new HttpError(404, 'Conversación no encontrada.');
  } else {
    conversationId = randomId();
    await db.execute('INSERT INTO ai_conversations (id, profile_id, user_id) VALUES (?, ?, ?)', [conversationId, req.params.profileId, req.auth.userId]);
  }
  const [history] = await db.execute(
    `SELECT role, content FROM ai_messages WHERE conversation_id=? ORDER BY created_at DESC LIMIT 12`,
    [conversationId]
  );
  const result = await answerOrganizerChat(history.reverse(), body.message);
  const userMessageId = randomId();
  const assistantMessageId = randomId();
  await db.execute(
    "INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (?, ?, 'USER', ?), (?, ?, 'ASSISTANT', ?)",
    [userMessageId, conversationId, body.message, assistantMessageId, conversationId, result.content]
  );
  await db.execute('UPDATE ai_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [conversationId]);
  await recordUsage({ userId: req.auth.userId, profileId: req.params.profileId, planCode: entitlement.plan.code, usageType: 'CHAT', metadata: { conversationId } });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'AI_CHAT', resourceType: 'AI_CONVERSATION', resourceId: conversationId, metadata: { provider: result.provider }, ip: req.ip });
  res.status(201).json({
    conversationId,
    message: { id: assistantMessageId, role: 'ASSISTANT', content: result.content, createdAt: new Date().toISOString() },
    remaining: entitlement.remaining == null ? null : Math.max(0, entitlement.remaining - 1),
    disclaimer: 'Asistente para organizar información. No diagnostica ni indica tratamientos o urgencias.'
  });
}));

aiRouter.get('/profiles/:profileId/ai/analyses', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const [rows] = await db.execute(
    `SELECT id, purpose, mode, provider, model, status, output_json AS output, created_at AS createdAt
       FROM ai_analyses WHERE profile_id=? ORDER BY created_at DESC LIMIT 20`,
    [req.params.profileId]
  );
  res.json(rows.map((row) => ({ ...row, output: typeof row.output === 'string' ? JSON.parse(row.output) : row.output })));
}));
