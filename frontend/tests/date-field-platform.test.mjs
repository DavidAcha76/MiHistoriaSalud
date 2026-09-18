import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const componentDirectory = path.resolve('src', 'components');

test('la web resuelve el campo de fecha del navegador, no el selector nativo', async () => {
  const webField = await fs.readFile(path.join(componentDirectory, 'DateField.web.tsx'), 'utf8');

  assert.match(webField, /type: 'date'/);
  assert.doesNotMatch(webField, /datetimepicker/i);
  assert.match(webField, /showPicker/);
  assert.match(webField, /input\.click\(\)/);
  await assert.rejects(fs.access(path.join(componentDirectory, 'DateField.ts')), { code: 'ENOENT' });
  await fs.access(path.join(componentDirectory, 'DateField.d.ts'));
});

test('la hora de un medicamento también usa el selector propio del navegador', async () => {
  const webField = await fs.readFile(path.join(componentDirectory, 'TimeField.web.tsx'), 'utf8');

  assert.match(webField, /type: 'time'/);
  assert.doesNotMatch(webField, /datetimepicker/i);
  assert.match(webField, /showPicker/);
  await assert.rejects(fs.access(path.join(componentDirectory, 'TimeField.ts')), { code: 'ENOENT' });
  await fs.access(path.join(componentDirectory, 'TimeField.d.ts'));
});
