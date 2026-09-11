import { db } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';

export const PLAN_DEFINITIONS = {
  FREE: { code: 'FREE', name: 'Gratis', monthlyPrice: 0, analysisEveryDays: 14, weeklyChatLimit: 0 },
  SILVER: { code: 'SILVER', name: 'Plata', monthlyPrice: 19, analysisEveryDays: 7, weeklyChatLimit: 10 },
  GOLD: { code: 'GOLD', name: 'Oro', monthlyPrice: 39, analysisEveryDays: 3, weeklyChatLimit: null }
};

export const PLAN_CODES = Object.keys(PLAN_DEFINITIONS);

function startOfUtcWeek(now = new Date()) {
  const value = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() - day + 1);
  return value;
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

async function readSubscription(userId) {
  const [rows] = await db.execute(
    `SELECT plan_code AS planCode, status, provider, activated_at AS activatedAt, updated_at AS updatedAt,
            current_period_start AS currentPeriodStart, current_period_end AS currentPeriodEnd,
            cancel_at_period_end AS cancelAtPeriodEnd, canceled_at AS canceledAt
       FROM user_subscriptions WHERE user_id=? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function reconcileSubscription(userId, subscription) {
  if (!subscription || subscription.status !== 'SIMULATED_ACTIVE' || !['SILVER', 'GOLD'].includes(subscription.planCode)) return subscription;
  const now = new Date();
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null;
  if (end && end > now) return subscription;

  if (subscription.cancelAtPeriodEnd) {
    await db.execute(
      `UPDATE user_subscriptions
       SET plan_code='FREE', status='CANCELED', canceled_at=NOW(), cancel_at_period_end=FALSE
       WHERE user_id=?`,
      [userId]
    );
    return readSubscription(userId);
  }

  let periodStart = end || now;
  let periodEnd = addCalendarMonth(periodStart);
  while (periodEnd <= now) {
    periodStart = periodEnd;
    periodEnd = addCalendarMonth(periodStart);
  }
  await db.execute(
    `UPDATE user_subscriptions
     SET current_period_start=?, current_period_end=?, canceled_at=NULL
     WHERE user_id=?`,
    [periodStart, periodEnd, userId]
  );
  return readSubscription(userId);
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
      autoRenews: activePaidPlan && !subscription?.cancelAtPeriodEnd
    }
  };
}

export async function getPlan(userId) {
  const subscription = await reconcileSubscription(userId, await readSubscription(userId));
  return presentPlan(subscription);
}

export async function activateSimulatedPlan(userId, planCode) {
  if (!PLAN_DEFINITIONS[planCode]) throw new HttpError(400, 'Plan no válido.');
  if (planCode === 'FREE') return scheduleSimulatedCancellation(userId);
  const periodStart = new Date();
  const periodEnd = addCalendarMonth(periodStart);
  await db.execute(
    `INSERT INTO user_subscriptions
      (user_id, plan_code, status, provider, current_period_start, current_period_end, cancel_at_period_end, canceled_at)
     VALUES (?, ?, 'SIMULATED_ACTIVE', 'simulation', ?, ?, FALSE, NULL)
     ON DUPLICATE KEY UPDATE plan_code=VALUES(plan_code), status='SIMULATED_ACTIVE', provider='simulation',
       activated_at=CURRENT_TIMESTAMP, current_period_start=VALUES(current_period_start), current_period_end=VALUES(current_period_end),
       cancel_at_period_end=FALSE, canceled_at=NULL`,
    [userId, planCode, periodStart, periodEnd]
  );
  return getPlan(userId);
}

export async function scheduleSimulatedCancellation(userId) {
  const subscription = await reconcileSubscription(userId, await readSubscription(userId));
  if (!subscription || subscription.status !== 'SIMULATED_ACTIVE' || !['SILVER', 'GOLD'].includes(subscription.planCode)) return getPlan(userId);
  await db.execute('UPDATE user_subscriptions SET cancel_at_period_end=TRUE WHERE user_id=?', [userId]);
  return getPlan(userId);
}

export async function resumeSimulatedPlan(userId) {
  const subscription = await reconcileSubscription(userId, await readSubscription(userId));
  if (!subscription || subscription.status !== 'SIMULATED_ACTIVE' || !['SILVER', 'GOLD'].includes(subscription.planCode)) {
    throw new HttpError(409, 'No hay un plan simulado activo para reanudar.');
  }
  await db.execute('UPDATE user_subscriptions SET cancel_at_period_end=FALSE WHERE user_id=?', [userId]);
  return getPlan(userId);
}

export async function getAiConsent(profileId) {
  const [rows] = await db.execute(
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

export async function recordUsage({ userId, profileId, planCode, usageType, metadata = null }) {
  await db.execute(
    `INSERT INTO ai_usage_ledger (id, user_id, profile_id, plan_code, usage_type, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [randomId(), userId, profileId, planCode, usageType, metadata ? JSON.stringify(metadata) : null]
  );
}

export async function ensureAnalysisAllowed({ userId, profileId }) {
  const [plan, consent] = await Promise.all([getPlan(userId), getAiConsent(profileId)]);
  if (!consent.granted) throw new HttpError(403, 'Debes aceptar el uso de IA para este perfil antes de solicitar un análisis.');
  const [rows] = await db.execute(
    `SELECT occurred_at FROM ai_usage_ledger
      WHERE user_id=? AND profile_id=? AND usage_type='ANALYSIS'
      ORDER BY occurred_at DESC LIMIT 1`,
    [userId, profileId]
  );
  const last = rows[0]?.occurred_at;
  if (last) {
    const next = new Date(new Date(last).getTime() + plan.analysisEveryDays * 24 * 60 * 60 * 1000);
    if (next > new Date()) {
      throw new HttpError(429, `El plan ${plan.name} permite un análisis cada ${plan.analysisEveryDays} días.`, { nextAvailableAt: next.toISOString() });
    }
  }
  return plan;
}

export async function ensureChatAllowed({ userId, profileId }) {
  const [plan, consent] = await Promise.all([getPlan(userId), getAiConsent(profileId)]);
  if (!consent.granted) throw new HttpError(403, 'Debes aceptar el uso de IA para este perfil antes de usar el asistente.');
  if (plan.weeklyChatLimit === 0) throw new HttpError(403, 'El asistente conversacional está disponible desde el plan Plata.');
  const since = startOfUtcWeek();
  const [rows] = await db.execute(
    `SELECT COALESCE(SUM(units), 0) AS used FROM ai_usage_ledger
      WHERE user_id=? AND profile_id=? AND usage_type='CHAT' AND occurred_at >= ?`,
    [userId, profileId, since]
  );
  const used = Number(rows[0].used);
  if (plan.weeklyChatLimit != null && used >= plan.weeklyChatLimit) {
    throw new HttpError(429, `Usaste las ${plan.weeklyChatLimit} consultas semanales del plan Plata.`, { resetsAt: new Date(since.getTime() + 7 * 86400000).toISOString() });
  }
  return { plan, used, remaining: plan.weeklyChatLimit == null ? null : Math.max(0, plan.weeklyChatLimit - used) };
}

export async function getPlanStatus({ userId, profileId }) {
  const [plan, consent] = await Promise.all([getPlan(userId), getAiConsent(profileId)]);
  const since = startOfUtcWeek();
  const [[chatRows], [analysisRows]] = await Promise.all([
    db.execute(`SELECT COALESCE(SUM(units), 0) AS used FROM ai_usage_ledger WHERE user_id=? AND profile_id=? AND usage_type='CHAT' AND occurred_at >= ?`, [userId, profileId, since]),
    db.execute(`SELECT occurred_at FROM ai_usage_ledger WHERE user_id=? AND profile_id=? AND usage_type='ANALYSIS' ORDER BY occurred_at DESC LIMIT 1`, [userId, profileId])
  ]);
  const lastAnalysisAt = analysisRows[0]?.occurred_at || null;
  const nextAnalysisAt = lastAnalysisAt ? new Date(new Date(lastAnalysisAt).getTime() + plan.analysisEveryDays * 86400000).toISOString() : null;
  return {
    plan,
    consent,
    chat: { usedThisWeek: Number(chatRows[0].used), limit: plan.weeklyChatLimit, resetsAt: new Date(since.getTime() + 7 * 86400000).toISOString() },
    analysis: { everyDays: plan.analysisEveryDays, lastAnalysisAt, nextAnalysisAt, availableNow: !nextAnalysisAt || new Date(nextAnalysisAt) <= new Date() }
  };
}
