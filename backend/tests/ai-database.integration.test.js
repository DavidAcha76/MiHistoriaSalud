import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createDatabaseConnection } from '../src/config/mysql-connection.js';
import { db } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { createAccessToken } from '../src/services/token-service.js';
import { getEventsWithDetails } from '../src/services/event-service.js';
import { boliviaWeek } from '../src/services/ai-week.js';
import { app } from '../src/app.js';

// Opt-in: all names below shadow the application's tables for this connection.
// No real records are selected or modified; closing it removes the fixtures.
test('IA: migración y rutas HTTP sobre tablas temporales de MySQL/MariaDB', { skip: process.env.AI_DATABASE_TESTS !== 'true' }, async (t) => {
  const conn = await createDatabaseConnection({ multipleStatements: true });
  t.after(() => conn.end());
  const [timezone] = await conn.query('SELECT TIMEDIFF(NOW(), UTC_TIMESTAMP()) AS utcOffset');
  assert.equal(timezone[0].utcOffset, '00:00:00');
  const schemas = {
    health_profiles: 'id CHAR(36) PRIMARY KEY, owner_user_id CHAR(36), display_name VARCHAR(120), birth_date DATE, relationship VARCHAR(20), notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    health_events: 'id CHAR(36) PRIMARY KEY, profile_id CHAR(36), event_type VARCHAR(30), title VARCHAR(180), description TEXT, source VARCHAR(255), event_date DATE, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    health_event_versions: 'id BIGINT PRIMARY KEY AUTO_INCREMENT, event_id CHAR(36), version_number INT',
    ai_analyses: "id CHAR(36) PRIMARY KEY, profile_id CHAR(36), requested_by_user_id CHAR(36), purpose VARCHAR(300), mode VARCHAR(20), selected_event_ids JSON, input_snapshot_hash CHAR(64), provider VARCHAR(80), model VARCHAR(120), status VARCHAR(20), output_json JSON, safety_flags JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    ai_messages: 'id CHAR(36) PRIMARY KEY, conversation_id CHAR(36), role VARCHAR(20), content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    ai_conversations: "id CHAR(36) PRIMARY KEY, profile_id CHAR(36), user_id CHAR(36), title VARCHAR(180) DEFAULT 'Prueba', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    ai_consents: "profile_id CHAR(36) PRIMARY KEY, granted_by_user_id CHAR(36), granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, revoked_at TIMESTAMP NULL, consent_version VARCHAR(40)",
    user_subscriptions: "user_id CHAR(36) PRIMARY KEY, plan_code VARCHAR(20), status VARCHAR(30), provider VARCHAR(30), activated_at DATETIME, updated_at DATETIME, current_period_start DATETIME, current_period_end DATETIME, cancel_at_period_end BOOLEAN DEFAULT FALSE, canceled_at DATETIME",
    ai_usage_ledger: 'id CHAR(36) PRIMARY KEY, user_id CHAR(36), profile_id CHAR(36), plan_code VARCHAR(20), usage_type VARCHAR(20), units INT DEFAULT 1, metadata_json JSON, occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
    in_app_notifications: 'id CHAR(36) PRIMARY KEY, user_id CHAR(36), profile_id CHAR(36), notification_type VARCHAR(50), title VARCHAR(180), body TEXT',
    audit_logs: 'id BIGINT PRIMARY KEY AUTO_INCREMENT, user_id CHAR(36), profile_id CHAR(36), action VARCHAR(50), resource_type VARCHAR(80), resource_id VARCHAR(80), metadata_json JSON, ip_address VARCHAR(64)'
  };
  for (const [table, columns] of Object.entries(schemas)) await conn.query(`CREATE TEMPORARY TABLE ${table} (${columns}) ENGINE=InnoDB`);
  await conn.query(await fs.readFile(new URL('../database/migrations/005_ai_review_versions_and_message_order.sql', import.meta.url), 'utf8'));
  await conn.query(await fs.readFile(new URL('../database/migrations/008_paid_plan_benefit_grants.sql', import.meta.url), 'utf8'));
  const originalAi = { ...env.ai };
  env.ai.mockMode = true;
  t.after(() => Object.assign(env.ai, originalAi));
  t.mock.method(db, 'execute', (...args) => conn.execute(...args));
  t.mock.method(db, 'getConnection', async () => ({
    execute: (...args) => conn.execute(...args),
    beginTransaction: () => conn.beginTransaction(), commit: () => conn.commit(), rollback: () => conn.rollback(),
    release() {}, destroy: () => conn.destroy()
  }));
  const userId = randomUUID(), profileId = randomUUID(), secondProfile = randomUUID();
  for (const id of [profileId, secondProfile]) {
    await conn.execute("INSERT INTO health_profiles (id, owner_user_id, display_name) VALUES (?, ?, 'Perfil ficticio')", [id, userId]);
    await conn.execute("INSERT INTO ai_consents (profile_id, granted_by_user_id, consent_version) VALUES (?, ?, 'test')", [id, userId]);
  }
  const ids = [];
  for (let i = 0; i < 55; i++) {
    const id = randomUUID(); ids.push(id);
    await conn.execute("INSERT INTO health_events (id, profile_id, event_type, title, event_date) VALUES (?, ?, 'OTHER', 'Registro ficticio', '2026-09-18')", [id, profileId]);
    await conn.execute('INSERT INTO health_event_versions (event_id, version_number) VALUES (?, 1)', [id]);
  }

  await t.test('la selección respeta las versiones y no puede leer registros de otro perfil', async () => {
    const snapshot = await getEventsWithDetails(profileId, ids.slice(0, 50), conn);
    assert.equal(snapshot.length, 50);
    assert.ok(snapshot.every((event) => Number(event.record_version) === 1));
    assert.equal((await getEventsWithDetails(profileId, ids.slice(50), conn)).length, 5);
    assert.deepEqual(await getEventsWithDetails(secondProfile, ids, conn), []);
  });

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/profiles`;
  const headers = { Authorization: `Bearer ${createAccessToken({ id: userId, email: 'qa@example.test' })}`, 'Content-Type': 'application/json' };
  const request = (route, body, method = 'POST') => fetch(`${base}/${profileId}/ai/${route}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });

  await t.test('el análisis manual guarda versiones y Gratis comparte el cupo entre perfiles', async () => {
    const response = await request('analyze', { eventIds: [ids[0]], purpose: 'Prueba informativa' });
    assert.equal(response.status, 201, await response.clone().text());
    const output = await response.json();
    const [rows] = await conn.execute('SELECT selected_event_versions FROM ai_analyses WHERE id=?', [output.id]);
    const versions = typeof rows[0].selected_event_versions === 'string' ? JSON.parse(rows[0].selected_event_versions) : rows[0].selected_event_versions;
    assert.equal(versions[0].id, ids[0]);
    assert.equal((await request('analyze', { eventIds: [ids[1]] })).status, 429);
    const otherStatus = await (await fetch(`${base}/${secondProfile}/ai/status`, { headers })).json();
    assert.equal(otherStatus.analysis.availableNow, false);
    const status = await (await request('status', null, 'GET')).json();
    assert.equal(status.analysis.availableNow, false);
    assert.equal(status.analysis.limit, 1);
    assert.equal(status.analysis.resetsAt, boliviaWeek().end.toISOString());
  });

  await t.test('el chat rechaza registros ajenos sin consumir ni enviar a IA y recibe solo la selección actual', async () => {
    const id = randomUUID();
    await conn.execute("INSERT INTO health_events (id, profile_id, event_type, title, event_date) VALUES (?, ?, 'OTHER', 'Otro perfil privado', '2026-09-18')", [id, secondProfile]);
    assert.equal((await request('chat', { message: 'No autorizado', eventIds: [id] })).status, 400);
    const nativeFetch = globalThis.fetch;
    let calls = 0;
    env.ai.mockMode = false; env.ai.apiKey = 'fake-test-key';
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (String(url).startsWith('http://127.0.0.1')) return nativeFetch(url, options);
      calls++;
      const messages = JSON.parse(options.body).messages;
      const context = JSON.parse(messages.at(-2).content).medicalContext;
      assert.equal(context.selectedRecords.length, 1);
      assert.equal(context.selectedRecords[0].title, 'Registro ficticio actualizado');
      assert.doesNotMatch(options.body, /Otro perfil privado/);
      return Response.json({ choices: [{ message: { content: 'Resumen informativo de R1.' }, finish_reason: 'stop' }] });
    });
    try {
      await conn.execute("UPDATE health_events SET title='Registro ficticio actualizado' WHERE id=?", [ids[0]]);
      assert.equal((await request('chat', { message: 'Resume mi registro', eventIds: [ids[0]] })).status, 201);
      assert.equal(calls, 1);
    } finally {
      globalThis.fetch = nativeFetch;
      env.ai.mockMode = true;
    }
    await conn.execute("DELETE FROM ai_usage_ledger WHERE usage_type='CHAT'");
    await conn.execute('DELETE FROM ai_messages');
    await conn.execute('DELETE FROM ai_conversations');
  });

  await t.test('dos intercambios en el mismo segundo conservan su orden y Gratis bloquea el mensaje once', async () => {
    const first = await request('chat', { message: 'Primer mensaje ficticio' });
    assert.equal(first.status, 201, await first.clone().text());
    const { conversationId } = await first.json();
    assert.equal((await request('chat', { conversationId, message: 'Segundo mensaje ficticio' })).status, 201);
    await conn.execute('UPDATE ai_messages SET created_at=UTC_TIMESTAMP() WHERE conversation_id=?', [conversationId]);
    const latest = await (await request('chat/latest', null, 'GET')).json();
    assert.deepEqual(latest.messages.map((m) => m.role), ['USER', 'ASSISTANT', 'USER', 'ASSISTANT']);
    assert.equal(latest.messages[0].content, 'Primer mensaje ficticio');
    assert.equal(latest.messages[2].content, 'Segundo mensaje ficticio');
    // Match the application: usage is dated by the admitted request, not by
    // a temporary-table default or the database server's separate clock.
    await conn.execute("INSERT INTO ai_usage_ledger (id, user_id, profile_id, plan_code, usage_type, units, occurred_at) VALUES (?, ?, ?, 'FREE', 'CHAT', 8, ?)", [randomUUID(), userId, secondProfile, new Date()]);
    assert.equal((await request('chat', { conversationId, message: 'Mensaje sin cupo' })).status, 429);
    const [messages] = await conn.execute('SELECT COUNT(*) AS total FROM ai_messages');
    assert.equal(Number(messages[0].total), 4);
  });

  await t.test('SQL cuenta el lunes de Bolivia y excluye consumos anteriores al corte', async () => {
    const { start } = boliviaWeek();
    await conn.execute("UPDATE ai_usage_ledger SET occurred_at=?", [new Date(start.getTime() - 1000)]);
    const reset = await (await request('status', null, 'GET')).json();
    assert.equal(reset.chat.usedThisWeek, 0);
    assert.equal(reset.analysis.availableNow, true);
    await conn.execute("UPDATE ai_usage_ledger SET occurred_at=?", [start]);
    const current = await (await request('status', null, 'GET')).json();
    assert.equal(current.chat.usedThisWeek, 10);
    assert.equal(current.analysis.availableNow, false);
  });

  await t.test('subir de plan habilita beneficios; repetir, bajar, reanudar y volver a Gratis no regalan cupos', async () => {
    const billing = async (route, body) => {
      const response = await fetch(`${base.replace('/profiles', '')}/billing/${route}`, {
        method: 'POST', headers, ...(body ? { body: JSON.stringify(body) } : {})
      });
      assert.equal(response.status, 200, await response.clone().text());
      return (await response.json()).plan;
    };
    const silver = await billing('simulate-checkout', { planCode: 'SILVER' });
    assert.ok(silver.subscription.benefitGrantId);
    const status = () => request('status', null, 'GET').then(r => r.json());
    let current = await status();
    assert.equal(current.analysis.availableNow, true);
    assert.equal(current.chat.usedThisWeek, 0);
    assert.equal(current.chat.limit, 10);
    assert.equal((await request('analyze', { eventIds: [ids[0]] })).status, 201);
    assert.equal((await request('chat', { message: 'Mensaje de Plata' })).status, 201);
    const repeated = await billing('simulate-checkout', { planCode: 'SILVER' });
    assert.equal(repeated.subscription.benefitGrantId, silver.subscription.benefitGrantId);
    assert.equal(repeated.subscription.currentPeriodEnd, silver.subscription.currentPeriodEnd);
    await billing('cancel');
    await billing('resume');
    current = await status();
    assert.equal(current.plan.subscription.benefitGrantId, silver.subscription.benefitGrantId);
    assert.equal(current.analysis.availableNow, false);
    assert.equal(current.chat.usedThisWeek, 1);
    const otherStatus = await (await fetch(`${base}/${secondProfile}/ai/status`, { headers })).json();
    assert.equal(otherStatus.analysis.availableNow, true);
    assert.equal(otherStatus.chat.usedThisWeek, 0);
    const gold = await billing('simulate-checkout', { planCode: 'GOLD' });
    assert.notEqual(gold.subscription.benefitGrantId, silver.subscription.benefitGrantId);
    current = await status();
    assert.equal(current.analysis.availableNow, true);
    assert.equal(current.chat.limit, null);
    assert.equal((await request('analyze', { eventIds: [ids[0]] })).status, 201);
    assert.equal((await request('chat', { message: 'Mensaje de Oro' })).status, 201);
    // Equal timestamps must not mix the benefits granted by separate purchases.
    await conn.execute('UPDATE ai_usage_ledger SET occurred_at=UTC_TIMESTAMP()');
    const downgraded = await billing('simulate-checkout', { planCode: 'SILVER' });
    assert.equal(downgraded.subscription.benefitGrantId, gold.subscription.benefitGrantId);
    current = await status();
    assert.equal(current.analysis.availableNow, false);
    assert.equal(current.chat.usedThisWeek, 1);
    await billing('cancel');
    await conn.execute('UPDATE user_subscriptions SET current_period_end=? WHERE user_id=?', [new Date(Date.now() - 60000), userId]);
    current = await status();
    assert.equal(current.plan.code, 'FREE');
    assert.equal(current.analysis.availableNow, false);
    assert.equal(current.chat.usedThisWeek, 12);
    assert.equal((await request('chat', { message: 'No recuperar cupo Gratis' })).status, 429);
  });

  await t.test('leer más de 40 veces no gasta el límite técnico y el consentimiento sigue accesible al agotarlo', async () => {
    for (let i = 0; i < 45; i++) assert.equal((await request('status', null, 'GET')).status, 200);
    const first = await request('consent', { granted: false }, 'PUT');
    assert.equal(first.status, 200);
    assert.equal((await request('chat', { message: 'Sin permiso' })).status, 403);
    let technicalLimit = false;
    for (let i = 0; i < 40; i++) {
      const response = await request('chat', { message: 'Sin permiso' });
      if (response.status === 429) { technicalLimit = true; break; }
      assert.equal(response.status, 403);
    }
    assert.equal(technicalLimit, true);
    assert.equal((await request('consent', { granted: true }, 'PUT')).status, 200);
    assert.equal((await request('status', null, 'GET')).status, 200);
    assert.equal((await request('analyses', null, 'GET')).status, 200);
  });
});
