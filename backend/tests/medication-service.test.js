import test from 'node:test';
import assert from 'node:assert/strict';
import { scheduledSlots, summarizeMedicationAdherence } from '../src/services/medication-service.js';

const regimen = {
  startDate: '2026-09-10',
  endDate: null,
  scheduleDays: [1, 3, 5],
  scheduleTimes: ['08:00', '20:00']
};

test('solo genera tomas ya vencidas según los días y horas configurados', () => {
  const now = new Date(2026, 8, 16, 12, 30); // miércoles
  assert.deepEqual(scheduledSlots(regimen, now, 7), [
    { scheduledDate: '2026-09-11', scheduledTime: '08:00' },
    { scheduledDate: '2026-09-11', scheduledTime: '20:00' },
    { scheduledDate: '2026-09-14', scheduledTime: '08:00' },
    { scheduledDate: '2026-09-14', scheduledTime: '20:00' },
    { scheduledDate: '2026-09-16', scheduledTime: '08:00' }
  ]);
});

test('resume la adherencia y mantiene las tomas de hoy pendientes', () => {
  const now = new Date(2026, 8, 16, 12, 30);
  const adherence = summarizeMedicationAdherence(regimen, [
    { scheduledDate: '2026-09-11', scheduledTime: '08:00', status: 'CONFIRMED' },
    { scheduledDate: '2026-09-14', scheduledTime: '20:00', status: 'CONFIRMED' }
  ], now);
  assert.equal(adherence.total, 5);
  assert.equal(adherence.confirmed, 2);
  assert.equal(adherence.missed, 2);
  assert.equal(adherence.percentage, 40);
  assert.deepEqual(adherence.pending, [{ scheduledDate: '2026-09-16', scheduledTime: '08:00' }]);
});

test('no considera como esperados los días en que el recordatorio estuvo pausado', () => {
  const now = new Date(2026, 8, 16, 12, 30);
  const slots = scheduledSlots(regimen, now, 7, [{ startsOn: '2026-09-14', endsOn: '2026-09-15' }]);
  assert.deepEqual(slots, [
    { scheduledDate: '2026-09-11', scheduledTime: '08:00' },
    { scheduledDate: '2026-09-11', scheduledTime: '20:00' },
    { scheduledDate: '2026-09-16', scheduledTime: '08:00' }
  ]);
});
