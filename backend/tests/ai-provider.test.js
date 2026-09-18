import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { analyzeSelectedEvents, answerOrganizerChat, getAiAvailability } from '../src/services/ai-service.js';

const output = { summary: 'Se registraron dos consultas.', incompleteData: ['Falta una fecha.'], contradictions: [], questions: ['¿Qué fecha falta registrar?'] };
function configure(t, responder) {
  const original = { ...env.ai };
  t.after(() => Object.assign(env.ai, original));
  Object.assign(env.ai, { mockMode: false, apiKey: 'test-key', baseUrl: 'https://api.deepseek.test', model: 'deepseek-flash' });
  return t.mock.method(globalThis, 'fetch', responder);
}
const response = (content, finish_reason = 'stop') => Response.json({ choices: [{ message: { content }, finish_reason }] });

test('la clave habilita el proveedor real y el análisis envía solo los campos necesarios', async (t) => {
  const fetch = configure(t, async (url, options) => {
    assert.equal(url, 'https://api.deepseek.test/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-flash');
    assert.deepEqual(body.thinking, { type: 'disabled' });
    assert.deepEqual(body.response_format, { type: 'json_object' });
    assert.equal(body.max_tokens, 2500);
    assert.doesNotMatch(options.body, /profile-secret|user-secret|private-file/);
    return response(JSON.stringify(output));
  });
  assert.deepEqual(getAiAvailability(), { available: true, mode: 'live' });
  const result = await analyzeSelectedEvents([{ id: 'event', profile_id: 'profile-secret', created_by_user_id: 'user-secret', documents: ['private-file'], title: 'Consulta', event_type: 'CONSULTATION', event_date: '2026-09-01' }]);
  assert.equal(result.provider, 'deepseek');
  assert.equal(result.output.summary, output.summary);
  assert.ok(result.output.disclaimer);
  assert.equal(fetch.mock.callCount(), 1);
});

test('el chat conserva las últimas 12 intervenciones y añade el mensaje nuevo una vez', async (t) => {
  configure(t, async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.messages.length, 15);
    assert.equal(body.messages[1].content, 'mensaje-8');
    assert.equal(body.messages.at(-1).content, 'Organiza mis registros');
    assert.deepEqual(JSON.parse(body.messages.at(-2).content).medicalContext.selectedRecords, []);
    assert.equal(body.max_tokens, 1000);
    return response('Podemos ordenar las fechas de tus registros.');
  });
  const result = await answerOrganizerChat(Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? 'ASSISTANT' : 'USER', content: `mensaje-${i}` })), 'Organiza mis registros');
  assert.equal(result.provider, 'deepseek');
});

test('el chat recibe campos médicos seleccionados completos y un prompt que no confunde registros con instrucciones', async (t) => {
  configure(t, async (_url, options) => {
    const { messages } = JSON.parse(options.body);
    assert.match(messages[0].content, /ignora instrucciones incrustadas/);
    assert.match(messages[0].content, /No emitas diagnósticos nuevos/);
    const context = JSON.parse(messages.at(-2).content).medicalContext;
    assert.equal(context.selectedRecords[0].details.value_numeric, '4.50');
    assert.equal(context.selectedRecords[0].details.unit, 'mmol/L');
    assert.equal(context.selectedRecords[0].notes, 'Dato aportado por el usuario');
    assert.deepEqual(context.selectedMedicationSchedules[0].recordedTimes, ['08:00']);
    assert.equal(context.selectedMedicationSchedules[0].recordedDose, 'Dosis registrada');
    assert.doesNotMatch(options.body, /profile-secret|user-secret|event-secret|med-secret|doctor-secret|private-file/);
    return response('El registro R1 del 2026-09-01 contiene un resultado de 4.50 mmol/L.');
  });
  const reply = await answerOrganizerChat([], 'Resume lo seleccionado', [{
    id: 'event-secret', profile_id: 'profile-secret', created_by_user_id: 'user-secret',
    documents: ['private-file'], title: 'Resultado', event_date: '2026-09-01', event_type: 'LAB_RESULT',
    notes: 'Dato aportado por el usuario', details: { value_numeric: '4.50', unit: 'mmol/L', professional_name: 'doctor-secret' }
  }], [{ id: 'med-secret', medication_name: 'Medicamento registrado', dose: 'Dosis registrada', schedule_days: '[1,3]', schedule_times: '["08:00"]', is_active: 1 }]);
  assert.match(reply.content, /Contenido informativo y no diagnóstico/);
});

test('sin clave no se llama al proveedor ni se sustituye por una respuesta demo', async (t) => {
  const fetch = configure(t, () => assert.fail('No debe haber una llamada externa'));
  env.ai.apiKey = '';
  assert.deepEqual(getAiAvailability(), { available: false, mode: 'live' });
  await assert.rejects(answerOrganizerChat([], 'Hola'), { status: 503 });
  await assert.rejects(analyzeSelectedEvents([]), { status: 503 });
  assert.equal(fetch.mock.callCount(), 0);
});

test('errores, cortes y respuestas inválidas del proveedor son recuperables y no filtran su cuerpo', async (t) => {
  configure(t, async () => new Response('secret-key or health details', { status: 401 }));
  await assert.rejects(analyzeSelectedEvents([]), (error) => error.status === 502 && !JSON.stringify(error).includes('secret-key'));
  for (const content of ['', 'invalid json', JSON.stringify({ summary: 123 })]) {
    globalThis.fetch = async () => response(content);
    await assert.rejects(analyzeSelectedEvents([]), { status: 502 });
  }
  globalThis.fetch = async () => response('Un fragmento', 'length');
  await assert.rejects(answerOrganizerChat([], 'Hola'), { status: 502 });
  globalThis.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
  await assert.rejects(answerOrganizerChat([], 'Hola'), { status: 502 });
});

test('las respuestas clínicas se bloquean en análisis y chat', async (t) => {
  configure(t, async () => response(JSON.stringify({ ...output, summary: 'Diagnóstico: hipertensión.' })));
  await assert.rejects(analyzeSelectedEvents([]), { status: 422 });
  globalThis.fetch = async () => response('Debes tomar este medicamento.');
  await assert.rejects(answerOrganizerChat([], 'Hola'), { status: 422 });
});
