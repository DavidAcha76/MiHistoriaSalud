import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectAiOutput, normalizeAiPayload } from '../src/services/ai-safety.js';

test('acepta un resumen informativo neutro', () => {
  const out = normalizeAiPayload({ summary: 'Se seleccionaron tres registros con fechas distintas.', incompleteData: ['Falta la fuente de un registro.'], contradictions: [], questions: [] });
  assert.equal(inspectAiOutput(out).safe, true);
});

test('bloquea una salida que afirma un diagnóstico', () => {
  const out = normalizeAiPayload({ summary: 'Diagnóstico: hipertensión.', incompleteData: [], contradictions: [], questions: [] });
  assert.equal(inspectAiOutput(out).safe, false);
});

test('bloquea una recomendación de estudio', () => {
  const out = normalizeAiPayload({ summary: 'Recomiendo realizar un estudio de imagen.', incompleteData: [], contradictions: [], questions: [] });
  assert.equal(inspectAiOutput(out).safe, false);
});
