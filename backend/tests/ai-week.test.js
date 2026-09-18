import test from 'node:test';
import assert from 'node:assert/strict';
import { boliviaWeek } from '../src/services/ai-week.js';

test('la semana cambia exactamente a las 04:00 UTC del lunes, incluido año nuevo', () => {
  for (const [instant, start, end] of [
    ['2026-09-21T03:59:59.999Z', '2026-09-14T04:00:00.000Z', '2026-09-21T04:00:00.000Z'],
    ['2026-09-21T04:00:00Z', '2026-09-21T04:00:00.000Z', '2026-09-28T04:00:00.000Z'],
    ['2027-01-01T12:00:00Z', '2026-12-28T04:00:00.000Z', '2027-01-04T04:00:00.000Z']
  ]) {
    const week = boliviaWeek(new Date(instant));
    assert.equal(week.start.toISOString(), start);
    assert.equal(week.end.toISOString(), end);
    assert.equal(week.timeZone, 'America/La_Paz');
  }
});

test('el horario de verano de EEUU y la zona del servidor no cambian la semana boliviana', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = zone;
      for (const monday of ['2026-03-09', '2026-11-02']) {
        const week = boliviaWeek(new Date(`${monday}T04:00:00Z`));
        assert.equal(week.start.toISOString(), `${monday}T04:00:00.000Z`);
      }
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
