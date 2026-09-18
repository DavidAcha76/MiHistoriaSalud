import { db } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function pad(value) {
  return String(value).padStart(2, '0');
}

export function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function localTimeValue(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateAtNoon(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function addDays(value, amount) {
  const date = dateAtNoon(value);
  date.setDate(date.getDate() + amount);
  return localDateValue(date);
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value || '[]'); } catch { return []; }
}

function normalizeRegimen(row) {
  return {
    ...row,
    scheduleDays: parseArray(row.scheduleDays).map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6).sort((a, b) => a - b),
    scheduleTimes: parseArray(row.scheduleTimes).filter((time) => typeof time === 'string' && TIME_PATTERN.test(time)).sort()
  };
}

function isPausedOn(date, pauses) {
  return pauses.some((pause) => date >= pause.startsOn && (!pause.endsOn || date <= pause.endsOn));
}

export function scheduledSlots(regimen, now = new Date(), lookbackDays = 30, pauses = []) {
  const today = localDateValue(now);
  const firstDate = regimen.startDate > addDays(today, -(lookbackDays - 1)) ? regimen.startDate : addDays(today, -(lookbackDays - 1));
  const lastDate = regimen.endDate && regimen.endDate < today ? regimen.endDate : today;
  if (firstDate > lastDate) return [];

  const slots = [];
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    if (isPausedOn(date, pauses)) continue;
    if (!regimen.scheduleDays.includes(dateAtNoon(date).getDay())) continue;
    for (const time of regimen.scheduleTimes) {
      if (date === today && time > localTimeValue(now)) continue;
      slots.push({ scheduledDate: date, scheduledTime: time });
    }
  }
  return slots;
}

export function summarizeMedicationAdherence(regimen, doses, now = new Date(), pauses = []) {
  const expected = scheduledSlots(regimen, now, 30, pauses);
  const recorded = new Map(doses.map((dose) => [`${dose.scheduledDate}|${dose.scheduledTime}`, dose]));
  const confirmed = expected.filter((slot) => recorded.get(`${slot.scheduledDate}|${slot.scheduledTime}`)?.status === 'CONFIRMED').length;
  const today = localDateValue(now);
  const pending = expected.filter((slot) => slot.scheduledDate === today && recorded.get(`${slot.scheduledDate}|${slot.scheduledTime}`)?.status !== 'CONFIRMED');
  const total = expected.length;
  return {
    confirmed,
    total,
    missed: Math.max(0, total - confirmed - pending.length),
    pending,
    percentage: total ? Math.round((confirmed / total) * 100) : 0
  };
}

async function regimenById(regimenId, profileId) {
  const [rows] = await db.execute(
    `SELECT id, profile_id AS profileId, medication_name AS medicationName, dose,
            schedule_days AS scheduleDays, schedule_times AS scheduleTimes,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
            notes, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
       FROM medication_regimens WHERE id=? AND profile_id=? LIMIT 1`,
    [regimenId, profileId]
  );
  if (!rows.length) throw new HttpError(404, 'Registro de medicamento no encontrado.');
  return normalizeRegimen({ ...rows[0], isActive: Boolean(rows[0].isActive) });
}

export async function createMedicationRegimen({ profileId, userId, body }) {
  const id = randomId();
  const scheduleDays = [...new Set(body.scheduleDays)].sort((a, b) => a - b);
  const scheduleTimes = [...new Set(body.scheduleTimes)].sort();
  await db.execute(
    `INSERT INTO medication_regimens
       (id, profile_id, created_by_user_id, medication_name, dose, schedule_days, schedule_times, start_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, profileId, userId, body.medicationName, body.dose || null, JSON.stringify(scheduleDays), JSON.stringify(scheduleTimes), body.startDate, body.notes || null]
  );
  return regimenById(id, profileId);
}

export async function listMedicationRegimens(profileId, now = new Date()) {
  const [rows] = await db.execute(
    `SELECT id, profile_id AS profileId, medication_name AS medicationName, dose,
            schedule_days AS scheduleDays, schedule_times AS scheduleTimes,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
            notes, is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
       FROM medication_regimens WHERE profile_id=? ORDER BY is_active DESC, created_at DESC`,
    [profileId]
  );
  const regimens = rows.map((row) => normalizeRegimen({ ...row, isActive: Boolean(row.isActive) }));
  if (!regimens.length) return [];
  const ids = regimens.map((regimen) => regimen.id);
  const startDate = addDays(localDateValue(now), -29);
  const placeholders = ids.map(() => '?').join(', ');
  const [doses] = await db.execute(
    `SELECT regimen_id AS regimenId, DATE_FORMAT(scheduled_date, '%Y-%m-%d') AS scheduledDate,
            TIME_FORMAT(scheduled_time, '%H:%i') AS scheduledTime, status, confirmed_at AS confirmedAt
       FROM medication_doses WHERE regimen_id IN (${placeholders}) AND scheduled_date >= ?`,
    [...ids, startDate]
  );
  const [pauses] = await db.execute(
    `SELECT regimen_id AS regimenId, DATE_FORMAT(starts_on, '%Y-%m-%d') AS startsOn,
            DATE_FORMAT(ends_on, '%Y-%m-%d') AS endsOn
       FROM medication_regimen_pauses WHERE regimen_id IN (${placeholders})`,
    ids
  );
  return regimens.map((regimen) => {
    const regimenDoses = doses.filter((dose) => dose.regimenId === regimen.id);
    const regimenPauses = pauses.filter((pause) => pause.regimenId === regimen.id);
    return { ...regimen, adherence: summarizeMedicationAdherence(regimen, regimenDoses, now, regimenPauses) };
  });
}

function assertScheduledSlot(regimen, scheduledDate, scheduledTime, now) {
  if (!TIME_PATTERN.test(scheduledTime) || scheduledDate < regimen.startDate || (regimen.endDate && scheduledDate > regimen.endDate)) {
    throw new HttpError(400, 'La toma no corresponde a este registro de medicamento.');
  }
  if (!regimen.scheduleDays.includes(dateAtNoon(scheduledDate).getDay()) || !regimen.scheduleTimes.includes(scheduledTime)) {
    throw new HttpError(400, 'La toma no corresponde al horario configurado.');
  }
  const today = localDateValue(now);
  if (scheduledDate > today || (scheduledDate === today && scheduledTime > localTimeValue(now))) {
    throw new HttpError(400, 'Solo puedes confirmar una toma cuando ya llegó su horario.');
  }
}

export async function confirmMedicationDose({ profileId, regimenId, scheduledDate, scheduledTime, now = new Date() }) {
  const regimen = await regimenById(regimenId, profileId);
  if (!regimen.isActive) throw new HttpError(400, 'Este medicamento está pausado.');
  assertScheduledSlot(regimen, scheduledDate, scheduledTime, now);
  const [existing] = await db.execute(
    'SELECT id FROM medication_doses WHERE regimen_id=? AND scheduled_date=? AND scheduled_time=? LIMIT 1',
    [regimenId, scheduledDate, scheduledTime]
  );
  if (existing.length) {
    await db.execute(
      `UPDATE medication_doses SET status='CONFIRMED', confirmed_at=COALESCE(confirmed_at, CURRENT_TIMESTAMP) WHERE id=?`,
      [existing[0].id]
    );
  } else {
    await db.execute(
      `INSERT INTO medication_doses (id, regimen_id, scheduled_date, scheduled_time, status, confirmed_at)
       VALUES (?, ?, ?, ?, 'CONFIRMED', CURRENT_TIMESTAMP)`,
      [randomId(), regimenId, scheduledDate, scheduledTime]
    );
  }
  return { regimenId, scheduledDate, scheduledTime, status: 'CONFIRMED' };
}

export async function setMedicationRegimenActive({ profileId, regimenId, isActive }) {
  const regimen = await regimenById(regimenId, profileId);
  if (regimen.isActive === isActive) return regimen;
  if (isActive) {
    await db.execute('UPDATE medication_regimen_pauses SET ends_on=CURDATE() WHERE regimen_id=? AND ends_on IS NULL', [regimenId]);
  } else {
    await db.execute(
      'INSERT INTO medication_regimen_pauses (id, regimen_id, starts_on) VALUES (?, ?, CURDATE())',
      [randomId(), regimenId]
    );
  }
  await db.execute('UPDATE medication_regimens SET is_active=? WHERE id=? AND profile_id=?', [isActive, regimenId, profileId]);
  return regimenById(regimenId, profileId);
}

export async function createDueMedicationReminders(now = new Date()) {
  const today = localDateValue(now);
  const [rows] = await db.execute(
    `SELECT r.id, r.profile_id AS profileId, p.owner_user_id AS userId,
            r.medication_name AS medicationName, r.schedule_days AS scheduleDays,
            r.schedule_times AS scheduleTimes, DATE_FORMAT(r.start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(r.end_date, '%Y-%m-%d') AS endDate
       FROM medication_regimens r
       JOIN health_profiles p ON p.id=r.profile_id
      WHERE r.is_active=TRUE AND r.start_date <= ? AND (r.end_date IS NULL OR r.end_date >= ?)`,
    [today, today]
  );
  let created = 0;
  for (const row of rows) {
    const regimen = normalizeRegimen(row);
    for (const slot of scheduledSlots(regimen, now, 1)) {
      const [existing] = await db.execute(
        'SELECT id FROM medication_doses WHERE regimen_id=? AND scheduled_date=? AND scheduled_time=? LIMIT 1',
        [regimen.id, slot.scheduledDate, slot.scheduledTime]
      );
      if (existing.length) continue;
      const [insert] = await db.execute(
        `INSERT IGNORE INTO medication_doses (id, regimen_id, scheduled_date, scheduled_time, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [randomId(), regimen.id, slot.scheduledDate, slot.scheduledTime]
      );
      if (!insert.affectedRows) continue;
      await db.execute(
        `INSERT INTO in_app_notifications (id, user_id, profile_id, notification_type, title, body)
         VALUES (?, ?, ?, 'MEDICATION_REMINDER', 'Recordatorio de medicamento', ?)`,
        [randomId(), row.userId, row.profileId, `Tienes registrada una toma de ${row.medicationName} a las ${slot.scheduledTime}. Confírmala cuando la hayas tomado.`]
      );
      created += 1;
    }
  }
  return { created };
}

export function startMedicationScheduler() {
  const run = () => createDueMedicationReminders().catch((error) => console.error('No se pudo crear recordatorios de medicamentos:', error.message));
  setTimeout(run, 5000).unref();
  setInterval(run, 60 * 1000).unref();
}
