import test from 'node:test';
import assert from 'node:assert/strict';
import { logError } from '../src/utils/logger.js';

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
