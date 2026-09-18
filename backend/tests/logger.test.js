import test from 'node:test';
import assert from 'node:assert/strict';
import { logError } from '../src/utils/logger.js';
import { errorHandler } from '../src/middleware/errors.js';
import { HttpError } from '../src/utils/http-error.js';

test('los logs de error no escriben mensajes potencialmente sensibles', () => {
  const output = [];
  const original = console.error;
  console.error = (line) => output.push(line);
  try {
    const error = new Error('password=secret-token y datos clínicos');
    error.code = 'ER_ACCESS_DENIED_ERROR';
    logError('database_startup_failed', error, { requestId: 'request-1' });
  } finally {
    console.error = original;
  }
  assert.equal(output.length, 1);
  assert.match(output[0], /database_startup_failed/);
  assert.match(output[0], /ER_ACCESS_DENIED_ERROR/);
  assert.doesNotMatch(output[0], /secret-token|password|clínicos/);
});

test('los errores del proveedor se pueden rastrear por solicitud sin registrar su contenido', (t) => {
  const lines = [];
  t.mock.method(console, 'error', (line) => lines.push(JSON.parse(line)));
  let result;
  const response = { status(value) { assert.equal(value, 502); return this; }, json(value) { result = value; } };
  errorHandler(new HttpError(502, 'private clinical text', { code: 'AI_PROVIDER_BALANCE', providerStatus: 402 }),
    { requestId: 'request-1', method: 'POST', path: '/private-profile', body: { message: 'private message' } }, response);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].requestId, result.requestId);
  assert.equal(lines[0].errorCode, 'AI_PROVIDER_BALANCE');
  assert.equal(lines[0].providerStatus, 402);
  assert.doesNotMatch(JSON.stringify(lines), /private|clinical/);
});
