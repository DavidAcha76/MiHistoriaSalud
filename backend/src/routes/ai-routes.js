import express from 'express';
import { z } from 'zod';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';
import { audit } from '../services/audit-service.js';
import { analyzeSelectedEvents, answerOrganizerChat, hashAiInput, selectedEventVersions, AI_PROMPT_VERSION } from '../services/ai-service.js';
import { loadSelectedMedicalRecords } from '../services/ai-context-service.js';
import { getEventsWithDetails } from '../services/event-service.js';
import { getPlanStatus, setAiConsent, withAiQuota } from '../services/plan-service.js';

export const aiRouter = express.Router();
aiRouter.use(requireAuth);

const analysisSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1).max(50),
  purpose: z.string().trim().min(3).max(300).optional().default('Revisión informativa de registros seleccionados')
});
const consentSchema = z.object({ granted: z.boolean() });
const chatSchema = z.object({
  conversationId: z.string().uuid().optional(), message: z.string().trim().min(1).max(1500),
  eventIds: z.array(z.string().uuid()).max(50).default([]),
  medicationIds: z.array(z.string().uuid()).max(50).default([])
});

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
  const payload = await withAiQuota({ userId: req.auth.userId, profileId: req.params.profileId, usageType: 'ANALYSIS' }, async ({ connection: db, plan }) => {
    const events = await getEventsWithDetails(req.params.profileId, body.eventIds, db);
    if (events.length !== [...new Set(body.eventIds)].length) throw new HttpError(400, 'Uno o más registros seleccionados no pertenecen al perfil.');

    const analysisId = randomId();
    const inputHash = hashAiInput(events);
    await db.execute(
      `INSERT INTO ai_analyses (id, profile_id, requested_by_user_id, purpose, mode, selected_event_ids, selected_event_versions, input_snapshot_hash, provider, model, status)
       VALUES (?, ?, ?, ?, 'MANUAL', ?, ?, ?, 'pending', 'pending', 'PROCESSING')`,
      [analysisId, req.params.profileId, req.auth.userId, body.purpose, JSON.stringify(body.eventIds), JSON.stringify(selectedEventVersions(events)), inputHash]
    );

    try {
      const result = await analyzeSelectedEvents(events, body.purpose);
      await db.execute(
        `UPDATE ai_analyses SET provider=?, model=?, status='COMPLETED', output_json=?, safety_flags=? WHERE id=?`,
        [result.provider, result.model, JSON.stringify(result.output), JSON.stringify([]), analysisId]
      );
      return { value: { id: analysisId, provider: result.provider, model: result.model, createdAt: new Date().toISOString(), plan: plan.code, ...result.output }, metadata: { analysisId, mode: 'MANUAL', selectedCount: events.length, promptVersion: AI_PROMPT_VERSION } };
    } catch (error) {
      await db.execute(`UPDATE ai_analyses SET status='REJECTED', output_json=NULL, safety_flags=? WHERE id=?`, [JSON.stringify(error.details?.flags || [error.message]), analysisId]);
      return { failure: error };
    }
  });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'ANALYZE', resourceType: 'AI_ANALYSIS', resourceId: payload.id, metadata: { provider: payload.provider }, ip: req.ip });
  res.status(201).json(payload);
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
      WHERE conversation_id=? ORDER BY created_at DESC, message_order DESC LIMIT 100`,
    [conversation.id]
  );
  res.json({ conversation, messages: messages.reverse() });
}));

aiRouter.post('/profiles/:profileId/ai/chat', asyncHandler(async (req, res) => {
  await assertProfileAccess(req.auth.userId, req.params.profileId);
  const body = chatSchema.parse(req.body);
  const payload = await withAiQuota({ userId: req.auth.userId, profileId: req.params.profileId, usageType: 'CHAT' }, async ({ connection: db, remaining }) => {
    const { events, medications } = await loadSelectedMedicalRecords(req.params.profileId, body.eventIds, body.medicationIds, db);
    let conversationId = body.conversationId;
    if (conversationId) {
      const [rows] = await db.execute('SELECT id FROM ai_conversations WHERE id=? AND profile_id=? AND user_id=? LIMIT 1', [conversationId, req.params.profileId, req.auth.userId]);
      if (!rows.length) throw new HttpError(404, 'Conversación no encontrada.');
    } else {
      conversationId = randomId();
      await db.execute('INSERT INTO ai_conversations (id, profile_id, user_id) VALUES (?, ?, ?)', [conversationId, req.params.profileId, req.auth.userId]);
    }
    const [history] = await db.execute(
      `SELECT role, content FROM ai_messages WHERE conversation_id=? ORDER BY created_at DESC, message_order DESC LIMIT 12`,
      [conversationId]
    );
    const result = await answerOrganizerChat(history.reverse(), body.message, events, medications);
    const userMessageId = randomId();
    const assistantMessageId = randomId();
    await db.execute(
      "INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (?, ?, 'USER', ?), (?, ?, 'ASSISTANT', ?)",
      [userMessageId, conversationId, body.message, assistantMessageId, conversationId, result.content]
    );
    await db.execute('UPDATE ai_conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?', [conversationId]);
    return { value: {
      conversationId,
      message: { id: assistantMessageId, role: 'ASSISTANT', content: result.content, createdAt: new Date().toISOString() },
      remaining: remaining == null ? null : Math.max(0, remaining - 1),
      disclaimer: 'Asistente para organizar información. No diagnostica ni indica tratamientos o urgencias.'
    }, metadata: { conversationId, promptVersion: AI_PROMPT_VERSION, provider: result.provider, model: result.model,
      selectedEventVersions: selectedEventVersions(events), selectedMedicationIds: medications.map((item) => item.id),
      contextHash: hashAiInput({ events, medications }) } };
  });
  await audit({ userId: req.auth.userId, profileId: req.params.profileId, action: 'AI_CHAT', resourceType: 'AI_CONVERSATION', resourceId: payload.conversationId, ip: req.ip });
  res.status(201).json(payload);
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
