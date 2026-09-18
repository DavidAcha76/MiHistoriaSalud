/* Revisión local con API interceptada: nunca escribe ni consulta datos de producción.
 * npm install --prefix .ui-qa --no-save --package-lock=false playwright
 * npm run build:web && node scripts/verify-ui.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('../.ui-qa/node_modules/playwright');

const root = path.resolve(__dirname, '../dist');
const output = path.resolve(__dirname, '../.ui-qa/results');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const user = { id: 'qa-user', fullName: 'Elena de prueba', email: 'elena@example.test' };
const profiles = [{ id: 'qa-profile', displayName: 'Elena de prueba', relationship: 'SELF' }, { id: 'qa-family', displayName: 'Familiar de prueba con nombre largo', relationship: 'PARENT' }];
const event = { id: 'qa-event', title: 'Consulta de control', eventDate: '2026-09-15', eventType: 'CONSULTATION', description: 'Registro ficticio para comprobar la interfaz.' };
const results = [];

async function mockApi(context, signedIn) {
  const state = { requests: [], eventsFail: false, confirmed: false };
  if (signedIn) await context.addInitScript(({ user, profile }) => {
    localStorage.setItem('mihistoria.access', 'local-qa-only');
    localStorage.setItem('mihistoria.refresh', 'local-qa-only');
    localStorage.setItem('mihistoria.user', JSON.stringify(user));
    localStorage.setItem('mihistoria.profile', profile);
  }, { user, profile: profiles[0].id });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.hostname !== 'api.clinia.win' || !url.pathname.startsWith('/api/')) return route.abort();
    const endpoint = url.pathname.slice(4);
    state.requests.push({ endpoint, method: request.method(), body: request.postDataJSON() });
    let data;
    let status = 200;
    if (endpoint === '/auth/me') data = user;
    else if (endpoint === '/profiles') data = profiles;
    else if (endpoint.endsWith('/confirm')) { state.confirmed = true; data = { confirmed: true }; }
    else if (endpoint.endsWith('/medication-regimens')) {
      data = request.method() === 'POST' ? { id: 'qa-medication' } : [{ id: 'qa-medication', profileId: 'qa-profile', medicationName: 'Medicamento de prueba', dose: 'Dosis según receta', scheduleDays: [0, 1, 2, 3, 4, 5, 6], scheduleTimes: ['08:00'], startDate: '2026-09-01', isActive: true, adherence: { confirmed: state.confirmed ? 1 : 0, total: 1, missed: 0, percentage: state.confirmed ? 100 : 0, pending: state.confirmed ? [] : [{ scheduledDate: '2026-09-16', scheduledTime: '08:00' }] } }];
    } else if (endpoint.endsWith('/events')) {
      if (state.eventsFail) { status = 503; data = { error: 'Servicio temporalmente no disponible' }; }
      else data = request.method() === 'POST' ? { id: 'qa-new-event' } : { items: endpoint.includes('qa-family') ? [] : [event], page: 1, pageSize: 20, total: endpoint.includes('qa-family') ? 0 : 1, totalPages: 1 };
    } else if (endpoint.endsWith('/consultation-summary')) data = { generatedAt: '2026-09-16T12:00:00Z', profile: { displayName: 'Elena de prueba' }, allergies: [], medications: [], diagnoses: [], antecedents: [], surgeries: [], vaccines: [], recentLabs: [], notice: 'Resumen de datos ficticios.' };
    else if (endpoint.endsWith('/versions')) data = [];
    else if (endpoint.endsWith('/events/qa-event')) data = { ...event, details: {}, documents: [] };
    else if (endpoint === '/notifications' || endpoint.endsWith('/documents')) data = [];
    else if (endpoint === '/auth/logout') data = {};
    else { status = 404; data = { error: `No hay fixture para ${endpoint}` }; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  return state;
}

async function checkLayout(page, label) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => Array.from(document.querySelectorAll('body *')).filter((element) => {
    if (element.closest('[aria-hidden="true"]')) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && (rect.right > innerWidth + 2 || rect.left < -2);
  }).slice(0, 5).map((element) => ({ tag: element.tagName, text: element.textContent.slice(0, 80), width: element.getBoundingClientRect().width })));
  assert.deepEqual(overflow, [], `${label}: contenido fuera del ancho disponible`);
  results.push(`${label}: sin desbordamiento horizontal`);
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const server = http.createServer(async (req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try { const body = await fs.readFile(file); res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      await mockApi(context, false);
      const page = await context.newPage();
      await page.goto(address);
      await page.getByRole('button', { name: 'Entrar a mi cuenta', exact: true }).waitFor();
      await checkLayout(page, `Acceso ${width}px`);
      if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, `login-${width}.png`) });
      await page.getByRole('button', { name: 'Entrar a mi cuenta', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Escribe tu correo' }).waitFor();
      await page.getByRole('button', { name: 'Mostrar contraseña', exact: true }).click();
      assert.equal(await page.getByLabel('Contraseña', { exact: true }).evaluate(input => input.type), 'text');
      await page.getByLabel('Contraseña', { exact: true }).focus();
      await page.keyboard.press('Tab');
      const focus = await page.evaluate(() => ({ tag: document.activeElement.tagName, outline: getComputedStyle(document.activeElement).outlineWidth }));
      assert.notEqual(focus.tag, 'BODY');
      assert.equal(focus.outline, '3px');
      await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
      await page.getByText('Repite tu contraseña', { exact: true }).waitFor();
      await checkLayout(page, `Registro ${width}px`);
      await context.close();
    }
    for (const width of [320, 390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 }, reducedMotion: 'reduce' });
      const state = await mockApi(context, true);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(address);
      await page.getByRole('heading', { name: 'Hola, Elena' }).waitFor();
      await page.getByRole('button', { name: 'Ver Consulta de control', exact: false }).waitFor();
      await checkLayout(page, `Inicio ${width}px`);
      await page.screenshot({ path: path.join(output, `home-${width}.png`) });
      await page.getByRole('button', { name: /^Mis documentos\./ }).click();
      await page.getByText(/Aún no guardaste documentos/).waitFor();
      await checkLayout(page, `Documentos ${width}px`);
      await page.getByRole('button', { name: '+ Subir documento', exact: true }).click();
      await checkLayout(page, `Subir documento ${width}px`);
      await page.getByRole('button', { name: 'Volver a la pantalla anterior', exact: true }).click();
      await page.getByRole('button', { name: 'Volver a la pantalla anterior', exact: true }).click();
      await page.getByRole('button', { name: /^Preparar mi consulta\./ }).click();
      await page.getByText('Resumen de datos ficticios.', { exact: true }).waitFor();
      await checkLayout(page, `Resumen ${width}px`);
      await page.getByRole('button', { name: 'Volver a la pantalla anterior', exact: true }).click();
      const tabs = page.getByRole('tablist', { name: 'Navegación principal' });
      await tabs.getByRole('tab', { name: 'Medicinas', exact: true }).click();
      await page.getByRole('button', { name: 'Ya tomé la de las 08:00', exact: true }).waitFor();
      await checkLayout(page, `Medicamentos ${width}px`);
      await page.screenshot({ path: path.join(output, `medicines-${width}.png`) });
      await page.getByRole('button', { name: 'Ya tomé la de las 08:00', exact: true }).click();
      await page.getByRole('button', { name: 'Cancelar y volver', exact: true }).click();
      assert.equal(state.requests.filter(r => r.endpoint.endsWith('/confirm')).length, 0);
      await page.getByRole('button', { name: 'Ya tomé la de las 08:00', exact: true }).click();
      await page.getByRole('button', { name: 'Sí, ya la tomé', exact: true }).click();
      await page.getByText('Por ahora no hay tomas pendientes de confirmar.', { exact: true }).waitFor();
      const confirmations = state.requests.filter(r => r.endpoint.endsWith('/confirm'));
      assert.equal(confirmations.length, 1);
      assert.deepEqual(confirmations[0].body, { scheduledDate: '2026-09-16', scheduledTime: '08:00' });
      await page.getByRole('button', { name: '+ Añadir un medicamento', exact: true }).click();
      await page.getByLabel('Medicamento o pastilla', { exact: true }).fill('Ejemplo de prueba');
      await page.getByRole('button', { name: 'Guardar horario de medicamento', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Elige una hora válida' }).waitFor();
      await page.getByLabel('Hora de la toma 1', { exact: true }).fill('09:30');
      await checkLayout(page, `Formulario de medicamentos ${width}px`);
      await page.getByRole('button', { name: 'Guardar horario de medicamento', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Horario guardado' }).waitFor();
      const savedMedication = state.requests.find(r => r.endpoint.endsWith('/medication-regimens') && r.method === 'POST');
      assert.deepEqual(savedMedication.body.scheduleTimes, ['09:30']);
      await page.getByRole('button', { name: 'Cerrar mensaje de confirmación' }).click();
      await tabs.getByRole('tab', { name: 'Inicio', exact: true }).click();
      await page.getByRole('button', { name: '+ Añadir un registro de salud', exact: true }).click();
      await page.getByLabel('¿Qué molestia sentiste?', { exact: true }).fill('Molestia de prueba');
      assert.equal(await page.getByLabel('Zona del cuerpo (opcional)', { exact: true }).count(), 0);
      await checkLayout(page, `Formulario de registro ${width}px`);
      await page.getByRole('button', { name: 'Tipo de registro: Molestia o síntoma', exact: true }).click();
      await page.getByRole('button', { name: 'Molestia o síntoma. Algo que sentiste o notas en tu cuerpo.', exact: true }).waitFor();
      await checkLayout(page, `Selector de tipo ${width}px`);
      await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
      await page.getByRole('button', { name: 'Guardar mi registro', exact: true }).click();
      await page.getByRole('status').filter({ hasText: 'Registro guardado' }).waitFor();
      assert.equal(state.requests.find(r => r.endpoint.endsWith('/events') && r.method === 'POST').body.details.symptom_name, 'Molestia de prueba');
      await page.getByRole('button', { name: 'Cerrar mensaje de confirmación' }).click();
      await tabs.getByRole('tab', { name: 'Historial', exact: true }).click();
      await page.getByRole('button', { name: 'Abrir Consulta de control', exact: true }).waitFor();
      await checkLayout(page, `Historial ${width}px`);
      await page.getByRole('button', { name: 'Filtrar por fecha o tipo de registro', exact: true }).click();
      await checkLayout(page, `Filtros ${width}px`);
      await page.getByRole('button', { name: 'Molestia o síntoma', exact: true }).click();
      await page.getByRole('button', { name: 'Buscar en mi historial', exact: true }).click();
      await page.getByRole('button', { name: 'Quitar filtros y ver todo', exact: true }).waitFor();
      await tabs.getByRole('tab', { name: 'Más opciones', exact: true }).click();
      await checkLayout(page, `Más opciones ${width}px`);
      await tabs.getByRole('tab', { name: 'Inicio', exact: true }).click();
      await page.getByRole('button', { name: 'Cambiar de persona', exact: true }).click();
      await page.getByRole('button', { name: profiles[1].displayName, exact: true }).click();
      await page.getByText('Aquí comienza tu historia', { exact: true }).waitFor();
      await checkLayout(page, `Perfil familiar ${width}px`);
      state.eventsFail = true;
      await tabs.getByRole('tab', { name: 'Historial', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'No pudimos cargar el historial' }).waitFor();
      await checkLayout(page, `Error de conexión ${width}px`);
      assert.deepEqual(errors, [], 'No debe haber errores de JavaScript');
      results.push(`${width}px: formularios, confirmación y cancelación de toma, filtros, perfiles y errores verificados`);
      await context.close();
    }
    for (const [label, viewport, enlarge] of [
      ['móvil horizontal', { width: 844, height: 390 }, false],
      ['espacio de escritorio a zoom 200%', { width: 720, height: 450 }, false],
      ['texto al 200%', { width: 390, height: 844 }, true]
    ]) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
      await mockApi(context, true);
      const page = await context.newPage();
      await page.goto(address);
      await page.getByRole('button', { name: 'Ver Consulta de control', exact: false }).waitFor();
      if (enlarge) await page.evaluate(() => {
        const sizes = Array.from(document.querySelectorAll('body *')).filter(element => Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim()) && !/material/i.test(getComputedStyle(element).fontFamily)).map(element => ({ element, size: parseFloat(getComputedStyle(element).fontSize), line: parseFloat(getComputedStyle(element).lineHeight) }));
        sizes.forEach(({ element, size, line }) => { element.style.fontSize = `${size * 2}px`; if (Number.isFinite(line)) element.style.lineHeight = `${line * 2}px`; });
      });
      await checkLayout(page, label);
      await page.screenshot({ path: path.join(output, enlarge ? 'home-text-200.png' : `home-${viewport.width}x${viewport.height}.png`) });
      await context.close();
    }
    await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
    console.log(results.join('\n'));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
