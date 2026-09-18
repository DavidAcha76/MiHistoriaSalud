import test from 'node:test';
import assert from 'node:assert/strict';
import { answerOrganizerChat } from '../src/services/ai-service.js';
import { env } from '../src/config/env.js';

test('el asistente en modo demo mantiene el límite ante solicitudes clínicas', async (t) => {
  const previous = env.ai.mockMode;
  env.ai.mockMode = true;
  t.after(() => { env.ai.mockMode = previous; });
  const response = await answerOrganizerChat([], '¿Qué medicamento debo tomar para este dolor?');
  assert.equal(response.provider, 'local-demo');
  assert.match(response.content, /no puedo diagnosticar/i);
  assert.match(response.content, /profesional de salud/i);
});
