import test from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarMonth, PLAN_DEFINITIONS } from '../src/services/plan-service.js';

test('los planes aplican los intervalos y cuotas definidos', () => {
  assert.equal(PLAN_DEFINITIONS.FREE.analysisEveryDays, null);
  assert.equal(PLAN_DEFINITIONS.FREE.weeklyAnalysisLimit, 1);
  assert.equal(PLAN_DEFINITIONS.FREE.weeklyChatLimit, 10);
  assert.equal(PLAN_DEFINITIONS.SILVER.analysisEveryDays, 7);
  assert.equal(PLAN_DEFINITIONS.SILVER.weeklyChatLimit, 10);
  assert.equal(PLAN_DEFINITIONS.GOLD.analysisEveryDays, 3);
  assert.equal(PLAN_DEFINITIONS.GOLD.weeklyChatLimit, null);
  assert.equal(PLAN_DEFINITIONS.SILVER.monthlyPrice, 19);
});

test('el período simulado avanza un mes calendario sin desbordar el día', () => {
  assert.equal(addCalendarMonth(new Date('2026-01-31T12:00:00.000Z')).toISOString(), '2026-02-28T12:00:00.000Z');
  assert.equal(addCalendarMonth(new Date('2028-01-31T12:00:00.000Z')).toISOString(), '2028-02-29T12:00:00.000Z');
});
