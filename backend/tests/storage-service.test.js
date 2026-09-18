import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { openPrivateFile, savePrivateFile } from '../src/services/storage-service.js';

async function readStream(stream) {
  const parts = [];
  for await (const part of stream) parts.push(part);
  return Buffer.concat(parts);
}

test('el almacenamiento de base conserva una única copia que cualquier instancia puede leer', async () => {
  const originalDriver = env.storage.driver;
  env.storage.driver = 'database';
  try {
    const file = {
      originalname: 'resultado.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('contenido clínico de prueba')
    };
    const saved = await savePrivateFile(file, '00000000-0000-4000-8000-000000000001');
    assert.equal(saved.driver, 'database');
    assert.match(saved.key, /\.pdf$/);
    assert.equal(await readStream((await openPrivateFile(saved.driver, saved.key, saved.content)).stream).then((body) => body.toString()), 'contenido clínico de prueba');
  } finally {
    env.storage.driver = originalDriver;
  }
});

test('un documento de base sin contenido no se entrega', async () => {
  await assert.rejects(() => openPrivateFile('database', 'missing'), { status: 404 });
});
