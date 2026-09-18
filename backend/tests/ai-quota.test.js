import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { ensureAnalysisAllowed, ensureChatAllowed, withAiQuota, getPlanStatus } from '../src/services/plan-service.js';

const identity = { userId: 'user', profileId: 'profile' };
const now = new Date('2026-09-18T12:00:00Z');
function database(t, { plan = 'SILVER', consent = true, ledger = [], canceled = false } = {}) {
  t.mock.timers.enable({ apis: ['Date'], now });
  const oldAi = { ...env.ai };
  env.ai.mockMode = true;
  t.after(() => Object.assign(env.ai, oldAi));
  const state = { plan, ledger, pending: [], locks: new Set(), releases: 0, rollbacks: 0, commits: 0, canceled };
  async function execute(sql, params) {
    if (sql.includes('FROM user_subscriptions')) return [[{ planCode: state.canceled ? 'FREE' : state.plan, status: state.canceled ? 'CANCELED' : 'SIMULATED_ACTIVE', currentPeriodEnd: '2026-10-01T00:00:00Z' }]];
    if (sql.includes('FROM ai_consents')) return [consent ? [{ granted_at: now, revoked_at: null }] : []];
    const scoped = state.ledger.filter((x) => x.userId === params[0] && (!sql.includes('profile_id=?') || x.profileId === params[1]));
    if (sql.includes('SELECT occurred_at')) return [scoped.filter((x) => x.type === 'ANALYSIS').sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 1).map((x) => ({ occurred_at: x.date }))];
    if (sql.includes('SUM(units)')) {
      const index = sql.includes('profile_id=?') ? 2 : 1;
      return [[{ used: scoped.filter((x) => x.type === params[index] && new Date(x.date) >= params[index + 1] && new Date(x.date) < params[index + 2]).reduce((sum, x) => sum + (x.units || 1), 0) }]];
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }
  t.mock.method(db, 'execute', execute);
  t.mock.method(db, 'getConnection', async () => {
    let pending = [];
    let held;
    return {
      async execute(sql, params) {
        if (sql.includes('GET_LOCK')) {
          if (state.locks.has(params[0])) return [[{ acquired: 0 }]];
          state.locks.add(params[0]); held = params[0]; return [[{ acquired: 1 }]];
        }
        if (sql.includes('RELEASE_LOCK')) { state.locks.delete(held); return [[{ released: 1 }]]; }
        if (sql.includes('INSERT INTO ai_usage_ledger')) { pending.push({ userId: params[1], profileId: params[2], plan: params[3], type: params[4], date: params[6], metadata: JSON.parse(params[5]) }); return [{ affectedRows: 1 }]; }
        return execute(sql, params);
      },
      async beginTransaction() {},
      async commit() { state.ledger.push(...pending); pending = []; state.commits++; },
      async rollback() { pending = []; state.rollbacks++; },
      release() { state.releases++; },
      destroy() { state.locks.delete(held); }
    };
  });
  return state;
}
const entry = (type, date = now, profileId = identity.profileId) => ({ ...identity, profileId, type, date });
const completed = async () => ({ value: 'completed', metadata: { mode: 'MANUAL' } });

for (const [plan, days] of [['SILVER', 7], ['GOLD', 3]]) {
  test(`${plan}: se permite el primer análisis y se respeta el intervalo de ${days} días`, async (t) => {
    const state = database(t, { plan });
    assert.equal((await ensureAnalysisAllowed(identity)).code, plan);
    state.ledger.push(entry('ANALYSIS', new Date(now.getTime() - days * 86400000 + 1)));
    await assert.rejects(ensureAnalysisAllowed(identity), { status: 429 });
    state.ledger[0].date = new Date(now.getTime() - days * 86400000);
    assert.equal((await ensureAnalysisAllowed(identity)).code, plan);
  });
}

test('Gratis y una suscripción cancelada permiten diez mensajes por semana', async (t) => {
  const state = database(t, { plan: 'FREE' });
  assert.equal(await withAiQuota({ ...identity, usageType: 'CHAT' }, completed), 'completed');
  state.canceled = true;
  assert.equal((await ensureChatAllowed(identity)).remaining, 9);
  assert.equal(state.ledger.length, 1);
});

test('sin consentimiento se bloquean análisis y chat antes de ejecutar el proveedor', async (t) => {
  database(t, { consent: false, plan: 'GOLD' });
  for (const usageType of ['ANALYSIS', 'CHAT']) await assert.rejects(withAiQuota({ ...identity, usageType }, () => assert.fail('No debe llamar a IA')), { status: 403 });
});

test('Plata permite el décimo mensaje y rechaza el undécimo; otras semanas y perfiles no consumen su cupo', async (t) => {
  const state = database(t, { ledger: [...Array.from({ length: 9 }, () => entry('CHAT')), entry('CHAT', new Date('2026-09-13T23:59:59Z')), entry('CHAT', now, 'other-profile')] });
  assert.equal((await ensureChatAllowed(identity)).remaining, 1);
  await withAiQuota({ ...identity, usageType: 'CHAT' }, completed);
  await assert.rejects(withAiQuota({ ...identity, usageType: 'CHAT' }, () => assert.fail('No debe llamar a IA')), { status: 429 });
  const status = await getPlanStatus(identity);
  assert.equal(status.chat.usedThisWeek, 10);
  assert.equal(status.chat.resetsAt, '2026-09-21T04:00:00.000Z');
  assert.equal(state.ledger.at(-1).plan, 'SILVER');
});

test('Oro conserva el chat sin cuota funcional', async (t) => {
  database(t, { plan: 'GOLD', ledger: Array.from({ length: 100 }, () => entry('CHAT')) });
  assert.equal((await ensureChatAllowed(identity)).remaining, null);
  assert.equal(await withAiQuota({ ...identity, usageType: 'CHAT' }, completed), 'completed');
});

test('dos perfiles Gratis simultáneos no gastan el último mensaje dos veces', async (t) => {
  const state = database(t, { plan: 'FREE', ledger: Array.from({ length: 9 }, () => entry('CHAT')) });
  let finish;
  let ready;
  const started = new Promise((resolve) => { ready = resolve; });
  const first = withAiQuota({ ...identity, usageType: 'CHAT' }, async () => {
    ready();
    await new Promise((resolve) => { finish = resolve; });
    return completed();
  });
  await started;
  await assert.rejects(withAiQuota({ ...identity, profileId: 'another-profile', usageType: 'CHAT' }, () => assert.fail('No debe llamar a IA')), { status: 429 });
  finish();
  await first;
  assert.equal(state.ledger.length, 10);
  assert.equal(state.locks.size, 0);
  assert.equal(state.releases, 2);
});

test('el consumo previo de otro plan se conserva al cambiar de suscripción', async (t) => {
  const state = database(t, { plan: 'GOLD' });
  await withAiQuota({ ...identity, usageType: 'ANALYSIS' }, completed);
  state.ledger[0].plan = 'SILVER';
  await assert.rejects(withAiQuota({ ...identity, usageType: 'ANALYSIS' }, completed), { status: 429 });
  assert.equal(state.ledger.length, 1);
});

test('fallos del proveedor liberan el bloqueo y no consumen cuota', async (t) => {
  const state = database(t);
  await assert.rejects(withAiQuota({ ...identity, usageType: 'ANALYSIS' }, async () => { throw new Error('provider failed'); }), /provider failed/);
  assert.equal(state.ledger.length, 0);
  assert.equal(state.rollbacks, 1);
  assert.equal(state.locks.size, 0);
  await withAiQuota({ ...identity, usageType: 'ANALYSIS' }, async () => ({ value: 'no new data' }));
  assert.equal(state.ledger.length, 0);
  await withAiQuota({ ...identity, usageType: 'ANALYSIS' }, completed);
  assert.equal(state.ledger.length, 1);
});

test('Gratis renueva exactamente el lunes boliviano y no acumula cupos ni los multiplica por perfil', async (t) => {
  const state = database(t, { plan: 'FREE' });
  t.mock.timers.setTime(Date.parse('2026-09-21T03:59:59.999Z'));
  await withAiQuota({ ...identity, usageType: 'ANALYSIS' }, completed);
  assert.equal(state.ledger[0].date.toISOString(), '2026-09-21T03:59:59.000Z');
  for (let i = 0; i < 10; i++) await withAiQuota({ ...identity, usageType: 'CHAT' }, completed);
  const other = { ...identity, profileId: 'another-profile' };
  await assert.rejects(ensureAnalysisAllowed(other), { status: 429 });
  await assert.rejects(ensureChatAllowed(other), { status: 429 });
  const status = await getPlanStatus(other);
  assert.equal(status.analysis.usedThisWeek, 1);
  assert.equal(status.analysis.resetsAt, '2026-09-21T04:00:00.000Z');
  assert.equal(status.quotaScope, 'ACCOUNT');
  t.mock.timers.setTime(Date.parse('2026-09-21T04:00:00.000Z'));
  assert.equal((await ensureAnalysisAllowed(identity)).code, 'FREE');
  assert.equal((await ensureChatAllowed(identity)).remaining, 10);
  // A week without activity does not grant two analyses or twenty messages.
  t.mock.timers.setTime(Date.parse('2026-09-28T04:00:00.000Z'));
  assert.equal((await ensureChatAllowed(identity)).remaining, 10);
  await withAiQuota({ ...other, usageType: 'ANALYSIS' }, completed);
  await assert.rejects(ensureAnalysisAllowed(identity), { status: 429 });
  // Usage remains counted after the profile FK is set to NULL on deletion.
  state.ledger.at(-1).profileId = null;
  await assert.rejects(ensureAnalysisAllowed(identity), { status: 429 });
});

test('una respuesta que cruza el lunes consume la semana de la solicitud', async (t) => {
  const state = database(t, { plan: 'FREE' });
  t.mock.timers.setTime(Date.parse('2026-09-21T03:59:59Z'));
  await withAiQuota({ ...identity, usageType: 'ANALYSIS' }, async () => {
    t.mock.timers.setTime(Date.parse('2026-09-21T04:00:01Z'));
    return completed();
  });
  assert.equal(state.ledger[0].date.toISOString(), '2026-09-21T03:59:59.000Z');
  assert.equal((await getPlanStatus(identity)).analysis.availableNow, true);
});

test('el descenso a Gratis cuenta los usos de los demás perfiles y de planes anteriores', async (t) => {
  database(t, { canceled: true, ledger: [entry('ANALYSIS', now, 'family'), { ...entry('CHAT', now, 'family'), units: 10 }] });
  await assert.rejects(ensureAnalysisAllowed(identity), { status: 429 });
  await assert.rejects(ensureChatAllowed(identity), { status: 429 });
});

test('sin configuración del proveedor no se gasta el cupo', async (t) => {
  const state = database(t);
  env.ai.mockMode = false; env.ai.apiKey = '';
  await assert.rejects(withAiQuota({ ...identity, usageType: 'CHAT' }, () => assert.fail('No debe llamar a IA')), { status: 503 });
  assert.equal(state.ledger.length, 0);
  assert.equal(state.locks.size, 0);
});

test('un análisis rechazado puede guardarse en el historial sin cobrar cuota y conserva el error original', async (t) => {
  const state = database(t);
  const failure = new Error('Respuesta bloqueada');
  await assert.rejects(withAiQuota({ ...identity, usageType: 'ANALYSIS' }, async () => ({ failure })), (error) => error === failure);
  assert.equal(state.commits, 1);
  assert.equal(state.ledger.length, 0);
  assert.equal(state.locks.size, 0);
});

test('las fechas SQL sin zona respetan el instante UTC de disponibilidad en desarrollo y hosting', async (t) => {
  database(t, { ledger: [entry('ANALYSIS', '2026-09-11 12:00:00')] });
  assert.equal((await ensureAnalysisAllowed(identity)).code, 'SILVER');
  const status = await getPlanStatus(identity);
  assert.equal(status.analysis.nextAnalysisAt, now.toISOString());
  assert.equal(status.analysis.availableNow, true);
});
