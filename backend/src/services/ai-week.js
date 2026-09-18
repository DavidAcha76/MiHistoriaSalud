export const AI_TIME_ZONE = 'America/La_Paz';
const DAY_MS = 86400000;
// Bolivia uses UTC-04:00. SQL stays in UTC; only the quota calendar uses Bolivia.
const BOLIVIA_OFFSET_MS = -4 * 60 * 60 * 1000;

export function boliviaWeek(now = new Date()) {
  const local = new Date(now.getTime() + BOLIVIA_OFFSET_MS);
  const monday = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  const start = new Date(monday - BOLIVIA_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 7 * DAY_MS), timeZone: AI_TIME_ZONE };
}
