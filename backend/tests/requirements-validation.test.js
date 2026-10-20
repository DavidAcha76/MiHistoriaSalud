import test from 'node:test';
import assert from 'node:assert/strict';
import { detectFileType, validateFile } from '../src/services/storage-service.js';
import { cleanDetails, searchCondition } from '../src/services/event-service.js';
import { canWrite } from '../src/middleware/profile-access.js';

const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n');
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);
const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(30)]);
const file = (buffer, mimetype, originalname) => ({ buffer, mimetype, originalname, size: buffer.length });

test('RNF-07: el tipo se detecta por la firma del contenido', () => {
  assert.equal(detectFileType(pdf), 'application/pdf');
  assert.equal(detectFileType(png), 'image/png');
  assert.equal(detectFileType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)])), 'image/webp');
  assert.equal(detectFileType(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(12)])), 'image/jpeg');
  assert.equal(detectFileType(exe), null);
});

test('PS-07: se rechaza un archivo cuyo tipo declarado no coincide con su contenido', () => {
  assert.throws(() => validateFile(file(exe, 'application/pdf', 'informe.pdf')), /Solo se permiten/);
  assert.throws(() => validateFile(file(png, 'application/pdf', 'informe.pdf')), /no coincide con el tipo declarado/);
  assert.throws(() => validateFile(file(pdf, 'application/pdf', 'informe.png')), /extensión del archivo no coincide/);
  assert.throws(() => validateFile(file(Buffer.alloc(0), 'application/pdf', 'vacio.pdf')), /vacío/);
});

test('un PDF real se acepta aunque el cliente lo declare como binario genérico y obtiene su hash', () => {
  const result = validateFile(file(pdf, 'application/octet-stream', 'receta.pdf'));
  assert.equal(result.mimeType, 'application/pdf');
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('CU-06: los detalles con fechas o valores numéricos inválidos se rechazan', () => {
  assert.throws(() => cleanDetails('LAB_RESULT', { test_name: 'Glucosa', value_numeric: 'alto' }), /solo admite números/);
  assert.throws(() => cleanDetails('MEDICATION', { medication_name: 'X', start_date: '2026-02-30' }), /fecha válida/);
  assert.throws(() => cleanDetails('TREATMENT', { treatment_name: 'X', start_date: '2026-05-10', end_date: '2026-05-01' }), /no puede ser anterior/);
  assert.throws(() => cleanDetails('ANTECEDENT', { category: 'VECINO' }), /valor no permitido/);
  const lab = cleanDetails('LAB_RESULT', { test_name: ' Glucosa ', value_numeric: '95,5', unit: 'mg/dL' });
  assert.equal(lab.value_numeric, 95.5);
  assert.equal(lab.test_name, 'Glucosa');
});

test('RF-23: la búsqueda cubre campos estructurados y escapa comodines', () => {
  assert.equal(searchCondition('   '), null);
  const search = searchCondition('100%_ok');
  assert.ok(search.params.every((value) => value === '%100\\%\\_ok%'));
  assert.match(search.sql, /medications/);
  assert.match(search.sql, /lab_results/);
});

test('RF-07: solo el titular y los representantes pueden modificar un perfil', () => {
  assert.equal(canWrite('OWNER'), true);
  assert.equal(canWrite('REPRESENTATIVE'), true);
  assert.equal(canWrite('VIEWER'), false);
  assert.equal(canWrite(undefined), false);
});
