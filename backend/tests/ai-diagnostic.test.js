import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAiConfiguration } from '../scripts/check-ai.js';

const config = { apiKey: 'private-key', model: 'deepseek-flash', baseUrl: 'https://api.deepseek.com', mockMode: false };

test('autenticación y modelo válidos no se confunden con saldo disponible', async () => {
  const calls = [];
  const report = await checkAiConfiguration(config, async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer private-key');
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, undefined);
    return Response.json(url.endsWith('/models') ? { data: [{ id: config.model }] } : { is_available: false, balance_infos: [{ total_balance: 'private-amount' }] });
  });
  assert.equal(report.ok, false);
  assert.equal(report.checks.at(-1).code, 'AI_PROVIDER_BALANCE');
  assert.equal(calls.length, 2);
  assert.doesNotMatch(JSON.stringify(report), /private-key|private-amount/);
});

test('el diagnóstico acepta modelo y saldo, y oculta errores privados', async () => {
  const ready = await checkAiConfiguration(config, async (url) => Response.json(url.endsWith('/models') ? { data: [{ id: config.model }] } : { is_available: true }));
  assert.equal(ready.ok, true);
  const denied = await checkAiConfiguration(config, async () => new Response('private-key', { status: 401 }));
  assert.equal(denied.ok, false);
  assert.equal(denied.checks[0].code, 'AI_PROVIDER_AUTH');
  assert.doesNotMatch(JSON.stringify(denied), /private-key/);
});

test('el diagnóstico no envía claves a destinos distintos de DeepSeek ni comprueba el modo demo', async () => {
  for (const changes of [{ baseUrl: 'https://untrusted.example' }, { mockMode: true }, { apiKey: '' }]) {
    const report = await checkAiConfiguration({ ...config, ...changes }, () => assert.fail('No debe llamar a la red'));
    assert.equal(report.ok, false);
  }
});
