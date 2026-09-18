import test from 'node:test';
import assert from 'node:assert/strict';
import { aiBlockedReason, aiDate } from '../src/utils/ai-access.ts';

const status = {
  service: { available: true, mode: 'live' },
  consent: { granted: true },
  analysis: { availableNow: true, nextAnalysisAt: null },
  chat: { limit: 10, usedThisWeek: 9, resetsAt: '2026-09-21T04:00:00Z' }
};

test('Gratis y Plata deshabilitan el chat en el décimo mensaje y Oro conserva el acceso', () => {
  assert.equal(aiBlockedReason(status, 'chat'), '');
  assert.match(aiBlockedReason({ ...status, chat: { ...status.chat, usedThisWeek: 10 } }, 'chat'), /Agotaste/);
  assert.equal(aiBlockedReason({ ...status, chat: { ...status.chat, limit: null, usedThisWeek: 100 } }, 'chat'), '');
  assert.match(aiBlockedReason({ ...status, chat: { ...status.chat, limit: 0 } }, 'chat'), /no está habilitado/);
});

test('la renovación muestra lunes a medianoche de Bolivia aunque el dispositivo esté en EEUU', () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = 'America/Los_Angeles';
    const date = aiDate('2026-09-21T04:00:00Z');
    assert.match(date, /21/);
    assert.match(date, /0:00|12:00/);
    assert.match(date, /Bolivia/);
    process.env.TZ = 'Asia/Tokyo';
    assert.equal(aiDate('2026-09-21T04:00:00Z'), date);
  } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('una API anterior sin estado de proveedor no rompe la pantalla ni habilita envíos', () => {
  const { service, ...legacy } = status;
  for (const feature of ['chat', 'analysis']) assert.match(aiBlockedReason(legacy, feature), /no está disponible/);
  assert.match(aiBlockedReason({ ...status, consent: { granted: false } }, 'chat'), /Autoriza/);
});

test('el historial presenta las fechas SQL UTC igual que las fechas ISO', () => {
  assert.equal(aiDate('2026-09-18 12:00:00'), aiDate('2026-09-18T12:00:00Z'));
});
