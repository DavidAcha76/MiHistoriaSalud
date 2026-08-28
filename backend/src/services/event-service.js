import { db } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';

export const EVENT_TYPES = [
  'ANTECEDENT', 'CONSULTATION', 'DIAGNOSIS', 'TREATMENT', 'MEDICATION',
  'ALLERGY', 'VACCINE', 'SURGERY', 'LAB_RESULT', 'OTHER'
];

const detailMap = {
  ANTECEDENT: { table: 'antecedents', fields: ['category', 'condition_name', 'relationship_person', 'onset_date', 'status'] },
  CONSULTATION: { table: 'consultations', fields: ['professional_name', 'specialty', 'facility', 'reason'] },
  DIAGNOSIS: { table: 'diagnoses', fields: ['diagnosis_name', 'status', 'diagnosed_by'] },
  TREATMENT: { table: 'treatments', fields: ['treatment_name', 'instructions', 'start_date', 'end_date'] },
  MEDICATION: { table: 'medications', fields: ['medication_name', 'dose', 'frequency', 'route', 'start_date', 'end_date', 'status'] },
  ALLERGY: { table: 'allergies', fields: ['allergen', 'reaction', 'severity', 'status'] },
  VACCINE: { table: 'vaccinations', fields: ['vaccine_name', 'dose_number', 'lot_number', 'provider'] },
  SURGERY: { table: 'surgeries', fields: ['procedure_name', 'facility', 'professional_name'] },
  LAB_RESULT: { table: 'lab_results', fields: ['test_name', 'value_text', 'value_numeric', 'unit', 'reference_range', 'flag', 'laboratory'] }
};

function cleanDetails(type, details = {}) {
  const config = detailMap[type];
  if (!config) return null;
  return Object.fromEntries(config.fields.map((field) => [field, details[field] ?? null]));
}

async function insertDetails(conn, eventId, type, details) {
  const config = detailMap[type];
  if (!config) return;
  const values = cleanDetails(type, details);
  const columns = ['event_id', ...config.fields];
  const placeholders = columns.map(() => '?').join(',');
  await conn.execute(
    `INSERT INTO ${config.table} (${columns.join(',')}) VALUES (${placeholders})`,
    [eventId, ...config.fields.map((f) => values[f])]
  );
}

async function updateDetails(conn, eventId, type, details) {
  const config = detailMap[type];
  if (!config) return;
  const values = cleanDetails(type, details);
  const set = config.fields.map((f) => `${f} = ?`).join(', ');
  await conn.execute(`UPDATE ${config.table} SET ${set} WHERE event_id = ?`, [...config.fields.map((f) => values[f]), eventId]);
}

export async function createEvent({ profileId, userId, body }) {
  const id = randomId();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO health_events (id, profile_id, event_type, title, description, event_date, source, notes, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, profileId, body.eventType, body.title, body.description || null, body.eventDate, body.source || null, body.notes || null, userId]
    );
    await insertDetails(conn, id, body.eventType, body.details || {});
    await conn.commit();
    return getEventById(id, profileId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}

export async function getEventById(eventId, profileId) {
  const [rows] = await db.execute(
    `SELECT * FROM health_events WHERE id = ? AND profile_id = ? LIMIT 1`, [eventId, profileId]
  );
  if (!rows.length) throw new HttpError(404, 'Evento no encontrado.');
  const event = rows[0];
  const config = detailMap[event.event_type];
  if (config) {
    const [details] = await db.execute(`SELECT * FROM ${config.table} WHERE event_id = ? LIMIT 1`, [eventId]);
    event.details = details[0] || null;
  } else event.details = null;
  const [docs] = await db.execute(
    `SELECT id, original_name, mime_type, size_bytes, created_at FROM clinical_documents WHERE event_id = ? ORDER BY created_at DESC`, [eventId]
  );
  event.documents = docs;
  return event;
}

export async function getEventsWithDetails(profileId, eventIds) {
  if (!eventIds.length) return [];
  const unique = [...new Set(eventIds)].slice(0, 50);
  const placeholders = unique.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT * FROM health_events WHERE profile_id = ? AND id IN (${placeholders}) ORDER BY event_date DESC`,
    [profileId, ...unique]
  );
  const result = [];
  for (const row of rows) {
    const config = detailMap[row.event_type];
    let details = null;
    if (config) {
      const [detailRows] = await db.execute(`SELECT * FROM ${config.table} WHERE event_id = ? LIMIT 1`, [row.id]);
      details = detailRows[0] || null;
      if (details) delete details.event_id;
    }
    result.push({ ...row, details });
  }
  return result;
}

export async function updateEvent({ eventId, profileId, body }) {
  const current = await getEventById(eventId, profileId);
  if (body.eventType && body.eventType !== current.event_type) throw new HttpError(400, 'No se permite cambiar el tipo de un evento existente.');
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE health_events SET title=?, description=?, event_date=?, source=?, notes=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=? AND profile_id=?`,
      [body.title ?? current.title, body.description ?? current.description, body.eventDate ?? current.event_date, body.source ?? current.source, body.notes ?? current.notes, eventId, profileId]
    );
    if (body.details) await updateDetails(conn, eventId, current.event_type, { ...(current.details || {}), ...body.details });
    await conn.commit();
    return getEventById(eventId, profileId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}
