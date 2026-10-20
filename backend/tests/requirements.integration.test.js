import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { db } from '../src/config/db.js';
import { app } from '../src/app.js';

// Opt-in y solo contra una base local de pruebas: escribe cuentas y registros ficticios reales.
// Uso: REQUIREMENTS_DB_TESTS=true DOTENV_CONFIG_PATH=<.env de una base local *_test> node --test tests/requirements.integration.test.js
const safeDatabase = ['127.0.0.1', 'localhost', '::1'].includes(env.db.host) && /_test$/.test(env.db.name);
const enabled = process.env.REQUIREMENTS_DB_TESTS === 'true';

test('requisitos del proyecto sobre una base local de pruebas', { skip: !enabled ? 'REQUIREMENTS_DB_TESTS no está activo' : !safeDatabase ? 'La base no es local ni termina en _test' : false }, async (t) => {
  const originalMail = { ...env.mail }, originalAi = { ...env.ai };
  env.mail.driver = 'log';
  env.ai.mockMode = true;
  t.after(() => { Object.assign(env.mail, originalMail); Object.assign(env.ai, originalAi); });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(async () => { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); await db.end(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (path, { token, method = 'GET', body, form } = {}) => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${path}`, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
    const text = await response.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: response.status, data };
  };
  const stamp = Date.now();
  const register = async (name) => (await call('/auth/register', { method: 'POST', body: { fullName: name, email: `${name.toLowerCase()}-${stamp}@example.test`, password: 'Prueba1234' } })).data;
  const ana = await register('Ana');
  const beto = await register('Beto');
  const anaProfile = ana.defaultProfileId;

  await t.test('PS-11: los intentos fallidos se auditan y bloquean temporalmente la cuenta', async () => {
    const email = `beto-${stamp}@example.test`;
    for (let i = 0; i < env.security.maxFailedLogins; i++) assert.equal((await call('/auth/login', { method: 'POST', body: { email, password: 'Incorrecta1' } })).status, 401);
    const blocked = await call('/auth/login', { method: 'POST', body: { email, password: 'Prueba1234' } });
    assert.equal(blocked.status, 429);
    const [rows] = await db.execute("SELECT action, COUNT(*) AS total FROM audit_logs WHERE user_id = ? AND action IN ('LOGIN_FAILED', 'LOGIN_BLOCKED') GROUP BY action", [beto.user.id]);
    assert.deepEqual(Object.fromEntries(rows.map((row) => [row.action, Number(row.total)])), { LOGIN_FAILED: env.security.maxFailedLogins, LOGIN_BLOCKED: 1 });
  });

  await t.test('PF-19: cerrar sesión invalida inmediatamente el token de acceso', async () => {
    const session = (await call('/auth/login', { method: 'POST', body: { email: `ana-${stamp}@example.test`, password: 'Prueba1234' } })).data;
    assert.equal((await call('/auth/me', { token: session.accessToken })).status, 200);
    assert.equal((await call('/auth/logout', { method: 'POST', body: { refreshToken: session.refreshToken } })).status, 204);
    assert.equal((await call('/auth/me', { token: session.accessToken })).status, 401);
  });

  await t.test('RF-03: la recuperación no revela cuentas y permite fijar una contraseña nueva', async () => {
    const logs = [];
    const spy = t.mock.method(console, 'log', (line) => logs.push(String(line)));
    const unknown = await call('/auth/recover', { method: 'POST', body: { email: `nadie-${stamp}@example.test` } });
    const known = await call('/auth/recover', { method: 'POST', body: { email: `ana-${stamp}@example.test` } });
    spy.mock.restore();
    assert.equal(unknown.status, 202);
    assert.equal(known.status, 202);
    assert.equal(unknown.data.message, known.data.message);
    const token = /restablecer=([A-Za-z0-9_-]+)/.exec(logs.join('\n'))?.[1];
    assert.ok(token, 'el modo de desarrollo muestra el enlace');
    assert.equal((await call('/auth/reset', { method: 'POST', body: { token, password: 'debil' } })).status, 400);
    assert.equal((await call('/auth/reset', { method: 'POST', body: { token, password: 'NuevaClave2026' } })).status, 200);
    assert.equal((await call('/auth/reset', { method: 'POST', body: { token, password: 'OtraClave2026' } })).status, 400, 'el token es de un solo uso');
    assert.equal((await call('/auth/me', { token: ana.accessToken })).status, 401, 'restablecer cierra las sesiones anteriores');
    const login = await call('/auth/login', { method: 'POST', body: { email: `ana-${stamp}@example.test`, password: 'NuevaClave2026' } });
    assert.equal(login.status, 200);
    ana.accessToken = login.data.accessToken;
  });

  const bSession = (await call('/auth/register', { method: 'POST', body: { fullName: 'Carla', email: `carla-${stamp}@example.test`, password: 'Prueba1234' } })).data;
  const carla = bSession.accessToken;
  let authorizationId;

  await t.test('RF-07 / CU-03: la autorización define consulta o actualización y su revocación bloquea el acceso', async () => {
    assert.equal((await call(`/profiles/${anaProfile}/events`, { token: carla })).status, 404);
    const grant = await call(`/profiles/${anaProfile}/authorizations`, { token: ana.accessToken, method: 'POST', body: { email: `carla-${stamp}@example.test`, role: 'VIEWER' } });
    assert.equal(grant.status, 201);
    authorizationId = grant.data.id;
    const shared = (await call('/profiles', { token: carla })).data.find((profile) => profile.id === anaProfile);
    assert.equal(shared.accessRole, 'VIEWER');
    assert.equal((await call(`/profiles/${anaProfile}/events`, { token: carla })).status, 200);
    const event = { eventType: 'CONSULTATION', title: 'Control', eventDate: '2026-10-01', details: {} };
    assert.equal((await call(`/profiles/${anaProfile}/events`, { token: carla, method: 'POST', body: event })).status, 403);
    assert.equal((await call(`/profiles/${anaProfile}/authorizations`, { token: carla })).status, 403, 'solo la persona titular gestiona autorizaciones');
    assert.equal((await call(`/profiles/${anaProfile}/authorizations/${authorizationId}`, { token: ana.accessToken, method: 'PATCH', body: { role: 'REPRESENTATIVE' } })).status, 200);
    assert.equal((await call(`/profiles/${anaProfile}/events`, { token: carla, method: 'POST', body: event })).status, 201);
    assert.equal((await call(`/profiles/${anaProfile}/authorizations/${authorizationId}`, { token: ana.accessToken, method: 'DELETE' })).status, 204);
    assert.equal((await call(`/profiles/${anaProfile}/events`, { token: carla })).status, 404);
    const [denied] = await db.execute("SELECT COUNT(*) AS total FROM audit_logs WHERE action = 'ACCESS_DENIED' AND resource_id = ?", [anaProfile]);
    assert.ok(Number(denied[0].total) >= 2, 'los intentos rechazados quedan auditados');
  });

  const ids = {};
  await t.test('CU-06: los valores no válidos se rechazan sin guardar información parcial', async () => {
    const invalid = await call(`/profiles/${anaProfile}/events`, { token: ana.accessToken, method: 'POST', body: { eventType: 'LAB_RESULT', title: 'Glucosa', eventDate: '2026-10-02', details: { test_name: 'Glucosa', value_numeric: 'alto' } } });
    assert.equal(invalid.status, 400);
    const lab = await call(`/profiles/${anaProfile}/events`, { token: ana.accessToken, method: 'POST', body: { eventType: 'LAB_RESULT', title: 'Glucosa en ayunas', eventDate: '2026-10-02', details: { test_name: 'Glucosa', value_numeric: '95', unit: 'mg/dL' } } });
    const medication = await call(`/profiles/${anaProfile}/events`, { token: ana.accessToken, method: 'POST', body: { eventType: 'MEDICATION', title: 'Tratamiento indicado', eventDate: '2026-10-03', details: { medication_name: 'Losartán', dose: '50 mg' } } });
    assert.equal(lab.status, 201);
    assert.equal(medication.status, 201);
    ids.lab = lab.data.id; ids.medication = medication.data.id;
    const [rows] = await db.execute("SELECT COUNT(*) AS total FROM health_events WHERE profile_id = ? AND title = 'Glucosa'", [anaProfile]);
    assert.equal(Number(rows[0].total), 0);
  });

  await t.test('RF-18: un resultado y un documento se vinculan con otro registro', async () => {
    const link = await call(`/profiles/${anaProfile}/events/${ids.medication}/links`, { token: ana.accessToken, method: 'POST', body: { linkedEventId: ids.lab } });
    assert.equal(link.status, 201);
    assert.deepEqual(link.data.linkedEvents.map((event) => event.id), [ids.lab]);
    const reverse = await call(`/profiles/${anaProfile}/events/${ids.lab}`, { token: ana.accessToken });
    assert.deepEqual(reverse.data.linkedEvents.map((event) => event.id), [ids.medication]);

    const form = new FormData();
    form.append('file', new Blob([Buffer.from('%PDF-1.4\nprueba sintética')], { type: 'application/pdf' }), 'receta.pdf');
    const upload = await call(`/profiles/${anaProfile}/documents`, { token: ana.accessToken, method: 'POST', form });
    assert.equal(upload.status, 201);
    assert.match(upload.data.sha256, /^[a-f0-9]{64}$/);
    const fake = new FormData();
    fake.append('file', new Blob([Buffer.from('MZ ejecutable disfrazado de PDF....')], { type: 'application/pdf' }), 'informe.pdf');
    assert.equal((await call(`/profiles/${anaProfile}/documents`, { token: ana.accessToken, method: 'POST', form: fake })).status, 400);
    const linked = await call(`/profiles/${anaProfile}/documents/${upload.data.id}`, { token: ana.accessToken, method: 'PATCH', body: { eventId: ids.medication } });
    assert.equal(linked.data.eventTitle, 'Tratamiento indicado');
    ids.document = upload.data.id;
    assert.equal((await call(`/profiles/${anaProfile}/documents/${ids.document}/download`, { token: carla })).status, 404, 'PS-02: sin autorización no se obtiene el documento');
  });

  await t.test('RF-23: la búsqueda encuentra campos estructurados y documentos', async () => {
    const result = await call(`/profiles/${anaProfile}/search?q=losart`, { token: ana.accessToken });
    assert.equal(result.status, 200);
    assert.deepEqual(result.data.events.items.map((event) => event.id), [ids.medication]);
    assert.equal((await call(`/profiles/${anaProfile}/search?q=receta`, { token: ana.accessToken })).data.documents.length, 1);
    assert.equal((await call(`/profiles/${anaProfile}/search?q=`, { token: ana.accessToken })).status, 400);
  });

  await t.test('RF-25: la vista estructurada usa las secciones elegidas y señala datos no registrados', async () => {
    const summary = await call(`/profiles/${anaProfile}/consultation-summary?sections=medications,recentLabs`, { token: ana.accessToken });
    assert.deepEqual(summary.data.selectedSections, ['medications', 'recentLabs']);
    assert.deepEqual(summary.data.allergies, []);
    assert.deepEqual(summary.data.medications[0].missing, ['Frecuencia', 'Fecha de inicio']);
    assert.deepEqual(summary.data.recentLabs[0].missing, ['Rango de referencia']);
  });

  await t.test('RF-27 a RF-29: la revisión guarda finalidad, fecha y registros incluidos', async () => {
    await call(`/profiles/${anaProfile}/ai/consent`, { token: ana.accessToken, method: 'PUT', body: { granted: true } });
    const review = await call(`/profiles/${anaProfile}/ai/review`, { token: ana.accessToken, method: 'POST', body: { eventIds: [ids.lab], purpose: 'Revisar consistencia del resultado', focus: 'CONSISTENCY' } });
    assert.equal(review.status, 201, JSON.stringify(review.data));
    assert.equal(review.data.focus, 'CONSISTENCY');
    assert.ok(review.data.createdAt);
    assert.match(review.data.disclaimer, /no diagnóstico/);
    const history = (await call(`/profiles/${anaProfile}/ai/analyses`, { token: ana.accessToken })).data;
    assert.equal(history[0].focus, 'CONSISTENCY');
    assert.deepEqual(history[0].selectedEvents.map((event) => event.id), [ids.lab]);
  });

  await t.test('RF-30: la trazabilidad se filtra por tipo y no expone IP ni secretos', async () => {
    const changes = await call(`/profiles/${anaProfile}/audit?type=CHANGES&pageSize=50`, { token: ana.accessToken });
    assert.equal(changes.status, 200);
    assert.ok(changes.data.items.some((item) => item.action === 'LINK'));
    assert.ok(changes.data.items.every((item) => !('ip' in item) && !('ipAddress' in item) && !('metadata' in item)));
    assert.equal((await call(`/profiles/${anaProfile}/audit`, { token: carla })).status, 404);
  });
});
