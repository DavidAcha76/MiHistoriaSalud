import { db } from '../config/db.js';
import { randomId } from '../utils/security.js';
import { analyzeSelectedEvents, hashAiInput } from './ai-service.js';
import { getEventsWithDetails } from './event-service.js';
import { ensureAnalysisAllowed, recordUsage } from './plan-service.js';

const AUTO_PURPOSE = 'Revisión automática de registros nuevos o actualizados';

async function dueProfiles() {
  const [rows] = await db.execute(
    `SELECT p.id AS profile_id, p.owner_user_id AS user_id
       FROM health_profiles p
       JOIN ai_consents c ON c.profile_id=p.id AND c.revoked_at IS NULL`
  );
  return rows;
}

async function hasNewEvents(profileId, userId) {
  const [analysisRows] = await db.execute(
    `SELECT occurred_at FROM ai_usage_ledger
      WHERE profile_id=? AND user_id=? AND usage_type='ANALYSIS'
      ORDER BY occurred_at DESC LIMIT 1`,
    [profileId, userId]
  );
  const last = analysisRows[0]?.occurred_at;
  const [events] = await db.execute(
    `SELECT id FROM health_events WHERE profile_id=? ${last ? 'AND updated_at > ?' : ''}
      ORDER BY event_date DESC, updated_at DESC LIMIT 50`,
    last ? [profileId, last] : [profileId]
  );
  return events.map((event) => event.id);
}

async function runForProfile({ profile_id: profileId, user_id: userId }) {
  const plan = await ensureAnalysisAllowed({ userId, profileId });
  const eventIds = await hasNewEvents(profileId, userId);
  if (!eventIds.length) return { status: 'SKIPPED_NO_NEW_DATA', profileId };
  const events = await getEventsWithDetails(profileId, eventIds);
  const analysisId = randomId();
  await db.execute(
    `INSERT INTO ai_analyses (id, profile_id, requested_by_user_id, purpose, mode, selected_event_ids, input_snapshot_hash, provider, model, status)
     VALUES (?, ?, ?, ?, 'SCHEDULED', ?, ?, 'pending', 'pending', 'PROCESSING')`,
    [analysisId, profileId, userId, AUTO_PURPOSE, JSON.stringify(eventIds), hashAiInput(events)]
  );
  try {
    const result = await analyzeSelectedEvents(events, AUTO_PURPOSE);
    await db.execute(
      `UPDATE ai_analyses SET provider=?, model=?, status='COMPLETED', output_json=?, safety_flags=? WHERE id=?`,
      [result.provider, result.model, JSON.stringify(result.output), JSON.stringify([]), analysisId]
    );
    await recordUsage({ userId, profileId, planCode: plan.code, usageType: 'ANALYSIS', metadata: { analysisId, mode: 'SCHEDULED', selectedCount: events.length } });
    await db.execute(
      `INSERT INTO in_app_notifications (id, user_id, profile_id, notification_type, title, body)
       VALUES (?, ?, ?, 'AI_ANALYSIS_READY', 'Nueva revisión informativa disponible', ?)`,
      [randomId(), userId, profileId, `Se revisaron ${events.length} registros nuevos o actualizados. La revisión organiza datos y preguntas para una consulta; no da diagnósticos.`]
    );
    return { status: 'COMPLETED', profileId, analysisId };
  } catch (error) {
    await db.execute(`UPDATE ai_analyses SET status='REJECTED', safety_flags=? WHERE id=?`, [JSON.stringify(error.details?.flags || [error.message]), analysisId]);
    throw error;
  }
}

export async function runDueAiAnalyses() {
  const results = [];
  for (const profile of await dueProfiles()) {
    try {
      results.push(await runForProfile(profile));
    } catch (error) {
      if (error.status === 429) results.push({ status: 'NOT_DUE', profileId: profile.profile_id });
      else {
        console.error(`No se pudo ejecutar revisión automática para el perfil ${profile.profile_id}:`, error.message);
        results.push({ status: 'FAILED', profileId: profile.profile_id });
      }
    }
  }
  return results;
}

export function startAiScheduler() {
  const run = () => runDueAiAnalyses().catch((error) => console.error('No se pudo iniciar el ciclo de IA:', error.message));
  setTimeout(run, 5000).unref();
  setInterval(run, 60 * 60 * 1000).unref();
}
