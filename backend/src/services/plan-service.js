import { createHash } from 'node:crypto';
import { getAiAvailability } from './ai-service.js';
import { db } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';
import { boliviaWeek } from './ai-week.js';

export const PLAN_DEFINITIONS = {
  FREE: { code: 'FREE', name: 'Gratis', monthlyPrice: 0, analysisEveryDays: null, weeklyAnalysisLimit: 1, weeklyChatLimit: 10 },
  SILVER: { code: 'SILVER', name: 'Plata', monthlyPrice: 19, analysisEveryDays: 7, weeklyChatLimit: 10 },
  GOLD: { code: 'GOLD', name: 'Oro', monthlyPrice: 39, analysisEveryDays: 3, weeklyChatLimit: null }
};

export const PLAN_CODES = Object.keys(PLAN_DEFINITIONS);
const PLAN_RANK = { FREE: 0, SILVER: 1, GOLD: 2 };

// mysql2 is configured for UTC and dateStrings; SQL timestamps omit the zone.
function databaseDate(value) {
  return new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:/.test(value) ? `${value.replace(' ', 'T')}Z` : value);
}

export function addCalendarMonth(value) {
  const date = new Date(value);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return date;
}

async function readSubscription(userId, executor = db, currentRead = false) {
  const [rows] = await executor.execute(
    `SELECT plan_code AS planCode, status, provider, activated_at AS activatedAt, updated_at AS updatedAt,
            current_period_start AS currentPeriodStart, current_period_end AS currentPeriodEnd,
            cancel_at_period_end AS cancelAtPeriodEnd, canceled_at AS canceledAt,
            ai_benefit_grant_id AS benefitGrantId
       FROM user_subscriptions WHERE user_id=? LIMIT 1${currentRead ? ' FOR UPDATE' : ''}`,
    [userId]
  );
  return rows[0] || null;
}

async function reconcileSubscription(userId, subscription, executor = db) {
  if (!subscription || subscription.status !== 'SIMULATED_ACTIVE' || !['SILVER', 'GOLD'].includes(subscription.planCode)) return subscription;
  const now = new Date();
  const end = subscription.currentPeriodEnd ? databaseDate(subscription.currentPeriodEnd) : null;
  if (end && end > now) return subscription;

  if (subscription.cancelAtPeriodEnd) {
    await executor.execute(
      `UPDATE user_subscriptions
       SET plan_code='FREE', status='CANCELED', canceled_at=NOW(), cancel_at_period_end=FALSE
       WHERE user_id=? AND status='SIMULATED_ACTIVE' AND plan_code=?
         AND current_period_end <=> ? AND cancel_at_period_end=TRUE`,
      [userId, subscription.planCode, subscription.currentPeriodEnd]
    );
    // Another status reader may already have reconciled the expired row.
    // Inside a transaction, use its current value rather than an older snapshot.
    return readSubscription(userId, executor, executor !== db);
  }

  let periodStart = end || now;
  let periodEnd = addCalendarMonth(periodStart);
  while (periodEnd <= now) {
    periodStart = periodEnd;
    periodEnd = addCalendarMonth(periodStart);
  }
  await executor.execute(
    `UPDATE user_subscriptions
     SET current_period_start=?, current_period_end=?, canceled_at=NULL
     WHERE user_id=? AND status='SIMULATED_ACTIVE' AND plan_code=?
       AND current_period_end <=> ? AND cancel_at_period_end=FALSE`,
    [periodStart, periodEnd, userId, subscription.planCode, subscription.currentPeriodEnd]
  );
  return readSubscription(userId, executor, executor !== db);
}

function presentPlan(subscription) {
  const activePaidPlan = subscription?.status === 'SIMULATED_ACTIVE' && ['SILVER', 'GOLD'].includes(subscription.planCode);
  const code = activePaidPlan ? subscription.planCode : 'FREE';
  return {
    ...PLAN_DEFINITIONS[code],
    simulated: true,
    subscription: {
      status: subscription?.status || 'FREE',
      activatedAt: subscription?.activatedAt || null,
      currentPeriodStart: activePaidPlan ? subscription?.currentPeriodStart || null : null,
      currentPeriodEnd: activePaidPlan ? subscription?.currentPeriodEnd || null : null,
      cancelAtPeriodEnd: activePaidPlan && Boolean(subscription?.cancelAtPeriodEnd),
      canceledAt: subscription?.canceledAt || null,
      benefitGrantId: activePaidPlan ? subscription?.benefitGrantId || null : null,
      autoRenews: activePaidPlan && !subscription?.cancelAtPeriodEnd
    }
  };
}

export async function getPlan(userId, executor = db) {
  const subscription = await reconcileSubscription(userId, await readSubscription(userId, executor), executor);
  return presentPlan(subscription);
}

export async function activateSimulatedPlan(userId, planCode) {
  if (!PLAN_DEFINITIONS[planCode]) throw new HttpError(400, 'Plan no válido.');
  if (planCode === 'FREE') return scheduleSimulatedCancellation(userId);
  return withAccountTransaction(userId, async (connection) => {
    const current = await getPlan(userId, connection);
    // Retries and selecting the current plan do not purchase another cycle.
    if (current.code === planCode) return current;
    const benefitGrantId = PLAN_RANK[planCode] > PLAN_RANK[current.code]
      ? randomId() : current.subscription.benefitGrantId;
    const periodStart = new Date();
    const periodEnd = addCalendarMonth(periodStart);
    await connection.execute(
      `INSERT INTO user_subscriptions
        (user_id, plan_code, status, provider, current_period_start, current_period_end, cancel_at_period_end, canceled_at, ai_benefit_grant_id)
       VALUES (?, ?, 'SIMULATED_ACTIVE', 'simulation', ?, ?, FALSE, NULL, ?)
       ON DUPLICATE KEY UPDATE plan_code=VALUES(plan_code), status='SIMULATED_ACTIVE', provider='simulation',
         activated_at=CURRENT_TIMESTAMP, current_period_start=VALUES(current_period_start), current_period_end=VALUES(current_period_end),
         cancel_at_period_end=FALSE, canceled_at=NULL, ai_benefit_grant_id=VALUES(ai_benefit_grant_id)`,
      [userId, planCode, periodStart, periodEnd, benefitGrantId]
    );
    return getPlan(userId, connection);
  });
}

export async function scheduleSimulatedCancellation(userId) {
  return withAccountTransaction(userId, async (connection) => {
    const plan = await getPlan(userId, connection);
    if (plan.code !== 'FREE') await connection.execute('UPDATE user_subscriptions SET cancel_at_period_end=TRUE WHERE user_id=?', [userId]);
    return getPlan(userId, connection);
  });
}

export async function resumeSimulatedPlan(userId) {
  return withAccountTransaction(userId, async (connection) => {
    const plan = await getPlan(userId, connection);
    if (plan.code === 'FREE') throw new HttpError(409, 'No hay un plan simulado activo para reanudar.');
    await connection.execute('UPDATE user_subscriptions SET cancel_at_period_end=FALSE WHERE user_id=?', [userId]);
    return getPlan(userId, connection);
  });
}

export async function getAiConsent(profileId, executor = db) {
  const [rows] = await executor.execute(
    `SELECT granted_at, revoked_at, consent_version
       FROM ai_consents WHERE profile_id=? LIMIT 1`,
    [profileId]
  );
  const consent = rows[0];
  return {
    granted: Boolean(consent?.granted_at && !consent.revoked_at),
    grantedAt: consent?.granted_at || null,
    revokedAt: consent?.revoked_at || null,
    version: consent?.consent_version || null
  };
}

export async function setAiConsent({ profileId, userId, granted }) {
  if (granted) {
    await db.execute(
      `INSERT INTO ai_consents (profile_id, granted_by_user_id, granted_at, revoked_at, consent_version)
       VALUES (?, ?, CURRENT_TIMESTAMP, NULL, '2026-08-28')
       ON DUPLICATE KEY UPDATE granted_by_user_id=VALUES(granted_by_user_id), granted_at=CURRENT_TIMESTAMP, revoked_at=NULL, consent_version='2026-08-28'`,
      [profileId, userId]
    );
  } else {
    await db.execute('UPDATE ai_consents SET revoked_at=CURRENT_TIMESTAMP WHERE profile_id=?', [profileId]);
  }
  return getAiConsent(profileId);
}

export async function recordUsage({ userId, profileId, planCode, usageType, metadata = null, occurredAt = new Date(), benefitGrantId = null }, executor = db) {
  await executor.execute(
    `INSERT INTO ai_usage_ledger (id, user_id, profile_id, plan_code, usage_type, metadata_json, occurred_at, benefit_grant_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [randomId(), userId, profileId, planCode, usageType, metadata ? JSON.stringify(metadata) : null, occurredAt, benefitGrantId]
  );
}

// FREE counts the entire account ledger, including paid usage. Paid upgrades
// grant fresh allowances per profile; downgrades keep the current grant.
function usageScope(plan, userId, profileId) {
  if (plan.code === 'FREE') return { sql: 'user_id=?', params: [userId] };
  const scope = { sql: 'user_id=? AND profile_id=?', params: [userId, profileId] };
  if (plan.subscription.benefitGrantId) {
    scope.sql += ' AND benefit_grant_id=?';
    scope.params.push(plan.subscription.benefitGrantId);
  }
  return scope;
}

async function weeklyUsage(plan, { userId, profileId }, usageType, week, executor) {
  const scope = usageScope(plan, userId, profileId);
  const [rows] = await executor.execute(
    `SELECT COALESCE(SUM(units), 0) AS used FROM ai_usage_ledger
      WHERE ${scope.sql} AND usage_type=? AND occurred_at >= ? AND occurred_at < ?`,
    [...scope.params, usageType, week.start, week.end]
  );
  return Number(rows[0].used);
}

async function analysisStatus(plan, identity, now, executor) {
  const week = boliviaWeek(now);
  const scope = usageScope(plan, identity.userId, identity.profileId);
  const [rows] = await executor.execute(
    `SELECT occurred_at FROM ai_usage_ledger WHERE ${scope.sql} AND usage_type='ANALYSIS'
      ORDER BY occurred_at DESC LIMIT 1`, scope.params
  );
  const lastAnalysisAt = rows[0]?.occurred_at ? databaseDate(rows[0].occurred_at).toISOString() : null;
  const weekly = plan.weeklyAnalysisLimit != null;
  const usedThisWeek = weekly ? await weeklyUsage(plan, identity, 'ANALYSIS', week, executor) : null;
  const nextAnalysisAt = weekly
    ? (usedThisWeek >= plan.weeklyAnalysisLimit ? week.end.toISOString() : null)
    : (lastAnalysisAt ? new Date(databaseDate(lastAnalysisAt).getTime() + plan.analysisEveryDays * 86400000).toISOString() : null);
  return { everyDays: plan.analysisEveryDays, limit: plan.weeklyAnalysisLimit ?? null, usedThisWeek,
    resetsAt: weekly ? week.end.toISOString() : null, lastAnalysisAt, nextAnalysisAt,
    availableNow: !nextAnalysisAt || new Date(nextAnalysisAt) <= now };
}

export async function ensureAnalysisAllowed({ userId, profileId }, executor = db, now = new Date()) {
  const [plan, consent] = await Promise.all([getPlan(userId, executor), getAiConsent(profileId, executor)]);
  if (!consent.granted) throw new HttpError(403, 'Debes aceptar el uso de IA para este perfil antes de solicitar un análisis.');
  const status = await analysisStatus(plan, { userId, profileId }, now, executor);
  if (!status.availableNow) {
    const message = plan.weeklyAnalysisLimit != null
      ? 'Ya usaste el análisis semanal de tu cuenta Gratis. Se renueva el lunes a las 00:00 de Bolivia; no es acumulable.'
      : `El plan ${plan.name} permite un análisis cada ${plan.analysisEveryDays} días.`;
    throw new HttpError(429, message, { nextAvailableAt: status.nextAnalysisAt, resetsAt: status.resetsAt, timeZone: boliviaWeek(now).timeZone });
  }
  return plan;
}

export async function ensureChatAllowed({ userId, profileId }, executor = db, now = new Date()) {
  const [plan, consent] = await Promise.all([getPlan(userId, executor), getAiConsent(profileId, executor)]);
  if (!consent.granted) throw new HttpError(403, 'Debes aceptar el uso de IA para este perfil antes de usar el asistente.');
  const week = boliviaWeek(now);
  const used = await weeklyUsage(plan, { userId, profileId }, 'CHAT', week, executor);
  if (plan.weeklyChatLimit != null && used >= plan.weeklyChatLimit) {
    throw new HttpError(429, `Usaste los ${plan.weeklyChatLimit} mensajes semanales del plan ${plan.name}. Se renuevan el lunes a las 00:00 de Bolivia; no son acumulables.`, { resetsAt: week.end.toISOString(), timeZone: week.timeZone });
  }
  return { plan, used, remaining: plan.weeklyChatLimit == null ? null : Math.max(0, plan.weeklyChatLimit - used) };
}

export async function getPlanStatus({ userId, profileId }) {
  const now = new Date();
  const [plan, consent] = await Promise.all([getPlan(userId), getAiConsent(profileId)]);
  const week = boliviaWeek(now);
  const [used, analysis] = await Promise.all([
    weeklyUsage(plan, { userId, profileId }, 'CHAT', week, db),
    analysisStatus(plan, { userId, profileId }, now, db)
  ]);
  return {
    plan,
    consent,
    service: getAiAvailability(),
    quotaScope: plan.code === 'FREE' ? 'ACCOUNT' : 'PROFILE',
    timeZone: week.timeZone,
    chat: { usedThisWeek: used, limit: plan.weeklyChatLimit, resetsAt: week.end.toISOString() },
    analysis
  };
}

// Purchases and AI requests share a lock: an in-flight response must finish
// before an upgrade assigns the next grant, including across API processes.
async function withAccountTransaction(userId, work) {
  const connection = await db.getConnection();
  const lockName = `ai:${createHash('sha256').update(userId).digest('hex').slice(0, 60)}`;
  let locked = false;
  let transaction = false;
  let reusable = true;
  try {
    const [rows] = await connection.execute('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
    locked = Number(rows[0]?.acquired) === 1;
    if (!locked) throw new HttpError(429, 'Hay otra solicitud de IA o cambio de plan en curso para esta cuenta. Espera a que termine.');
    await connection.beginTransaction();
    transaction = true;
    const value = await work(connection);
    await connection.commit();
    transaction = false;
    return value;
  } catch (error) {
    if (transaction) {
      try { await connection.rollback(); } catch { reusable = false; }
    }
    throw error;
  } finally {
    if (locked) {
      try {
        const [rows] = await connection.execute('SELECT RELEASE_LOCK(?) AS released', [lockName]);
        if (Number(rows[0]?.released) !== 1) reusable = false;
      } catch { reusable = false; }
    }
    if (reusable) connection.release();
    else connection.destroy();
  }
}

export async function withAiQuota({ userId, profileId, usageType }, work) {
  if (!['ANALYSIS', 'CHAT'].includes(usageType)) throw new Error('Tipo de uso de IA no válido.');
  const result = await withAccountTransaction(userId, async (connection) => {
    // TIMESTAMP(0) must not round 23:59:59.999 into the following week.
    const occurredAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const entitlement = usageType === 'ANALYSIS'
      ? { plan: await ensureAnalysisAllowed({ userId, profileId }, connection, occurredAt) }
      : await ensureChatAllowed({ userId, profileId }, connection, occurredAt);
    if (!getAiAvailability().available) throw new HttpError(503, 'El servicio de IA aún no está disponible. Intenta más tarde.');
    const result = await work({ connection, ...entitlement });
    if (result.metadata) await recordUsage({ userId, profileId, planCode: entitlement.plan.code, usageType,
      metadata: result.metadata, occurredAt, benefitGrantId: entitlement.plan.subscription.benefitGrantId }, connection);
    return result;
  });
  // A rejected analysis is saved for the history without consuming quota.
  if (result.failure) throw result.failure;
  return result.value;
}
