import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSelectedMedicalRecords, medicalContext } from '../src/services/ai-context-service.js';

test('la lectura de contexto filtra eventos y medicamentos por el mismo perfil', async () => {
  const calls = [];
  const executor = { async execute(sql, params) {
    calls.push({ sql, params });
    if (sql.includes('FROM health_events')) return [[{ id: 'event', event_type: 'OTHER', profile_id: 'profile', record_version: 2 }]];
    return [[{ id: 'medicine', dose: 'dato registrado' }]];
  } };
  const result = await loadSelectedMedicalRecords('profile', ['event', 'event'], ['medicine'], executor);
  assert.equal(result.events.length, 1);
  assert.equal(result.medications.length, 1);
  for (const call of calls) { assert.equal(call.params[0], 'profile'); assert.match(call.sql, /profile_id\s*=\s*\?/); }
  await assert.rejects(loadSelectedMedicalRecords('profile', ['event', 'foreign'], [], executor), { status: 400 });
  await assert.rejects(loadSelectedMedicalRecords('profile', [], ['medicine', 'foreign'], executor), { status: 400 });
});

test('el contexto vacío no consulta todo el historial y el excesivo se rechaza sin truncar hechos', async () => {
  const executor = { execute() { assert.fail('Sin selección no se consulta el historial'); } };
  assert.deepEqual(await loadSelectedMedicalRecords('profile', [], [], executor), { events: [], medications: [] });
  assert.throws(() => medicalContext([{ notes: 'x'.repeat(60001) }]), { status: 413 });
  assert.equal(medicalContext([{ details: { intensity: 0, value_numeric: 0, event_id: 'secret' } }]).selectedRecords[0].details.intensity, 0);
});
