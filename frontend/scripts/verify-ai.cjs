// Local web export + intercepted API fixtures. No real account or AI call.
const { chromium } = require('../.ui-qa/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../dist');
const output = path.resolve(__dirname, '../.ui-qa/results');
fs.mkdirSync(output, { recursive: true });
const user = { id: 'qa-user', fullName: 'Persona de prueba', email: 'qa@example.test' };
const profiles = [{ id: 'qa-profile', displayName: 'Perfil de prueba', relationship: 'SELF' }, { id: 'qa-family', displayName: 'Familiar de prueba', relationship: 'PARENT' }];
const result = { id: 'analysis', provider: 'test', model: 'test', summary: 'Revisión de prueba: hay un registro guardado.', incompleteData: ['Falta la fuente.'], contradictions: [], questions: ['¿Qué fecha falta confirmar?'], disclaimer: 'Contenido informativo y no diagnóstico.' };
let plan = 'FREE', used = 9, granted = true, available = true, analyzed = false;
let messages = [], chatCalls = 0, analysisCalls = 0;
const errors = [];
const status = (profileId) => ({
  plan: { code: plan, name: { FREE: 'Gratis', SILVER: 'Plata', GOLD: 'Oro' }[plan], monthlyPrice: { FREE: 0, SILVER: 19, GOLD: 39 }[plan], analysisEveryDays: { FREE: null, SILVER: 7, GOLD: 3 }[plan], weeklyAnalysisLimit: plan === 'FREE' ? 1 : undefined, weeklyChatLimit: { FREE: 10, SILVER: 10, GOLD: null }[plan], simulated: true, subscription: { status: plan === 'FREE' ? 'FREE' : 'SIMULATED_ACTIVE', currentPeriodStart: '2026-09-18T00:00:00Z', currentPeriodEnd: '2026-10-18T00:00:00Z', cancelAtPeriodEnd: false } },
  quotaScope: plan === 'FREE' ? 'ACCOUNT' : 'PROFILE', timeZone: 'America/La_Paz',
  service: { available, mode: 'live' },
  consent: { granted, grantedAt: '2026-09-18T00:00:00Z' },
  chat: { usedThisWeek: plan === 'FREE' || profileId === 'qa-profile' ? used : 0, limit: { FREE: 10, SILVER: 10, GOLD: null }[plan], resetsAt: '2026-09-21T04:00:00Z' },
  analysis: { everyDays: { FREE: null, SILVER: 7, GOLD: 3 }[plan], limit: plan === 'FREE' ? 1 : null, usedThisWeek: analyzed ? 1 : 0, availableNow: !analyzed, lastAnalysisAt: analyzed ? '2026-09-18T00:00:00Z' : null, nextAnalysisAt: analyzed ? '2026-09-21T04:00:00Z' : null }
});

(async () => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const target = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
    const types = { '.html': 'text/html', '.js': 'application/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
    res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
    fs.createReadStream(target).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' }).catch((error) => { server.close(); throw error; });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(({ user }) => {
      localStorage.setItem('mihistoria.access', 'qa-access');
      localStorage.setItem('mihistoria.refresh', 'qa-refresh');
      localStorage.setItem('mihistoria.user', JSON.stringify(user));
      localStorage.setItem('mihistoria.profile', 'qa-profile');
    }, { user });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', async (route) => {
      const req = route.request(), url = new URL(req.url()), endpoint = url.pathname.replace(/^\/api/, '');
      if (url.hostname === '127.0.0.1') return route.continue();
      if (url.hostname !== 'api.clinia.win' || !url.pathname.startsWith('/api/')) return route.abort();
      const profileId = endpoint.split('/')[2];
      let payload;
      if (endpoint === '/auth/me') payload = user;
      else if (endpoint === '/profiles') payload = profiles;
      else if (endpoint.endsWith('/ai/status')) payload = status(profileId);
      else if (endpoint.endsWith('/events')) payload = { items: [{ id: 'event-1', title: 'Consulta de prueba', eventType: 'CONSULTATION', eventDate: '2026-09-18' }], total: 1, page: 1, pageSize: 50, totalPages: 1 };
      else if (endpoint.endsWith('/medication-regimens')) payload = [{ id: 'medicine-1', medicationName: 'Medicamento registrado', dose: 'Según receta', isActive: true, adherence: { confirmed: 0, total: 0, missed: 0, percentage: 0, pending: [] } }];
      else if (endpoint.endsWith('/ai/chat/latest')) payload = { conversation: messages.length && profileId === 'qa-profile' ? { id: 'conversation-1' } : null, messages: profileId === 'qa-profile' ? messages : [] };
      else if (endpoint.endsWith('/ai/chat')) {
        chatCalls++; used++;
        const body = req.postDataJSON();
        assert.deepEqual(body.eventIds, ['event-1']);
        assert.deepEqual(body.medicationIds, ['medicine-1']);
        const reply = { id: 'reply-1', role: 'ASSISTANT', content: 'Respuesta exclusiva del perfil principal.' };
        messages.push({ id: 'message-1', role: 'USER', content: body.message }, reply);
        payload = { conversationId: 'conversation-1', message: reply, remaining: 0 };
      }
      else if (endpoint.endsWith('/ai/analyze')) { analysisCalls++; analyzed = true; payload = result; }
      else if (endpoint.endsWith('/ai/consent')) { granted = req.postDataJSON().granted; payload = { granted }; }
      else if (endpoint.endsWith('/ai/analyses')) payload = [{ id: 'analysis-1', purpose: 'Organizar registros de prueba', createdAt: '2026-09-18T00:00:00Z', mode: 'SCHEDULED', status: 'COMPLETED', output: result }];
      else if (endpoint === '/notifications') payload = [];
      else { errors.push(`Unexpected API endpoint: ${endpoint}`); payload = {}; }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const aiTab = page.getByRole('tab', { name: 'IA, inteligencia artificial', exact: true });
    await aiTab.click();
    await page.getByText('1 de 10 mensajes disponibles', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'ai-mobile.png'), fullPage: true });
    assert.equal(await page.getByRole('tab').count(), 5);
    await page.getByRole('button', { name: /^Hablar con el asistente\./ }).click();
    assert.equal(chatCalls, 0);
    assert.equal(analysisCalls, 0);
    await page.getByRole('button', { name: 'Elegir información médica para la IA', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Consulta de prueba', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Medicamento registrado', exact: true }).check();
    await page.screenshot({ path: path.join(output, 'ai-selection.png'), fullPage: true });
    await page.getByRole('textbox', { name: 'Mensaje', exact: true }).fill('Organiza este registro de prueba');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await page.getByText('0 de 10 mensajes disponibles', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Enviar', exact: true }).getAttribute('aria-disabled'), 'true');
    assert.equal(chatCalls, 1);
    await page.getByRole('button', { name: 'Cambiar de persona', exact: true }).click();
    await page.getByRole('button', { name: 'Familiar de prueba', exact: true }).click();
    await page.getByText('0 de 10 mensajes disponibles', { exact: true }).waitFor();
    await page.getByText(/0 registros y 0 horarios de medicamentos seleccionados/).waitFor();
    assert.equal(await page.getByText('Respuesta exclusiva del perfil principal.', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Cambiar de persona', exact: true }).click();
    await page.getByRole('button', { name: 'Perfil de prueba', exact: true }).click();
    await page.getByText('0 de 10 mensajes disponibles', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Ir al centro de IA', exact: true }).click();
    await page.getByRole('button', { name: /^Revisar mis registros\./ }).click();
    await page.getByRole('button', { name: 'Elegir información médica para la IA', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Consulta de prueba', exact: true }).check();
    await page.getByRole('button', { name: 'Revisar 1 registro(s)', exact: true }).click();
    await page.getByText(result.summary, { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Revisar 0 registro(s)', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Revisar 0 registro(s)', exact: true }).getAttribute('aria-disabled'), 'true');
    assert.equal(analysisCalls, 1);
    await page.getByRole('button', { name: 'Ver mis revisiones guardadas', exact: true }).click();
    await page.getByRole('button', { name: 'Ver revisión completa', exact: true }).click();
    await page.getByText('¿Qué fecha falta confirmar?', { exact: false }).filter({ visible: true }).waitFor();
    await aiTab.click();
    await page.getByRole('button', { name: /^Mi plan y suscripción\./ }).click();
    await page.getByRole('button', { name: 'Ir al centro de IA: uso y permisos', exact: true }).click();
    await page.getByRole('heading', { name: 'Tu centro de IA', exact: true }).waitFor();
    plan = 'FREE';
    await page.getByRole('tab', { name: 'Inicio', exact: true }).click();
    await aiTab.click();
    await page.getByText('Plan Gratis', { exact: true }).filter({ visible: true }).waitFor();
    await page.getByRole('button', { name: /^Hablar con el asistente\./ }).click();
    await page.getByText(/Agotaste tus 10 mensajes semanales/).filter({ visible: true }).waitFor();
    assert.equal(await page.getByRole('textbox', { name: 'Mensaje', exact: true }).isEditable(), false);
    await page.getByRole('button', { name: 'Ir al centro de IA', exact: true }).click();
    await page.getByRole('button', { name: 'Retirar permiso de IA', exact: true }).click();
    await page.getByRole('button', { name: 'Autorizar uso de IA', exact: true }).waitFor();
    assert.equal(granted, false);
    await page.getByRole('button', { name: 'Autorizar uso de IA', exact: true }).click();
    await page.getByRole('button', { name: 'Retirar permiso de IA', exact: true }).waitFor();
    plan = 'GOLD'; available = false;
    await page.getByRole('tab', { name: 'Inicio', exact: true }).click();
    await aiTab.click();
    await page.getByText('El servicio de IA aún no está disponible. Puedes consultar tus revisiones guardadas.', { exact: true }).waitFor();
    await page.setViewportSize({ width: 320, height: 780 });
    await page.getByRole('heading', { name: 'Tu centro de IA', exact: true }).scrollIntoViewIfNeeded();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, 'ai-320.png'), fullPage: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    available = true;
    await page.getByRole('tab', { name: 'Inicio', exact: true }).click();
    await aiTab.click();
    await page.getByText('Chat sin cuota funcional', { exact: true }).waitFor();
    await page.screenshot({ path: path.join(output, 'ai-desktop.png'), fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ success: true, chatCalls, analysisCalls, widths: [320, 390, 1440], checks: ['manual only', 'free account quota', 'selected medical context', 'gold', 'profile isolation', 'analysis quota', 'history', 'plan return', 'consent', 'unconfigured service'], errors }));
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
