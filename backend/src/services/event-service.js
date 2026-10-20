import { db } from '../config/db.js';
import { HttpError } from '../utils/http-error.js';
import { randomId } from '../utils/security.js';

export const EVENT_TYPES = [
  'ANTECEDENT', 'CONSULTATION', 'DIAGNOSIS', 'TREATMENT', 'MEDICATION',
  'ALLERGY', 'VACCINE', 'SURGERY', 'LAB_RESULT', 'SYMPTOM', 'OTHER'
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
  LAB_RESULT: { table: 'lab_results', fields: ['test_name', 'value_text', 'value_numeric', 'unit', 'reference_range', 'flag', 'laboratory'] },
  SYMPTOM: { table: 'symptoms', fields: ['symptom_name', 'body_area', 'intensity', 'onset_date', 'resolved_date', 'status', 'triggers_text', 'relief_text', 'associated_symptoms', 'impact_text'] }
};

const fieldLabels = {
  onset_date: 'Fecha de inicio', start_date: 'Fecha de inicio', end_date: 'Fecha de fin', resolved_date: 'Fecha en que terminó',
  value_numeric: 'Valor numérico', category: 'Categoría del antecedente', status: 'Estado'
};
const dateFields = new Set(['onset_date', 'start_date', 'end_date', 'resolved_date']);
const textLimits = {
  condition_name: 180, relationship_person: 120, status: 80, professional_name: 160, specialty: 120, facility: 180, reason: 1000,
  diagnosis_name: 180, diagnosed_by: 160, treatment_name: 180, instructions: 5000, medication_name: 180, dose: 120, frequency: 120,
  route: 120, allergen: 180, reaction: 500, severity: 80, vaccine_name: 180, dose_number: 80, lot_number: 100, provider: 180,
  procedure_name: 180, test_name: 180, value_text: 500, unit: 80, reference_range: 180, flag: 80, laboratory: 180,
  symptom_name: 180, body_area: 180, triggers_text: 5000, relief_text: 5000, associated_symptoms: 5000, impact_text: 5000
};
const allowedValues = {
  ANTECEDENT: { category: ['PERSONAL', 'FAMILY', 'OTHER'] },
  SYMPTOM: { status: ['ACTIVE', 'RESOLVED', 'RECURRENT', 'UNKNOWN'] }
};

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** CU-06 / PF-06: los valores inválidos se rechazan con un mensaje claro antes de tocar la base. */
function validateDetails(type, cleaned) {
  for (const [field, value] of Object.entries(cleaned)) {
    if (value == null) continue;
    const label = fieldLabels[field] || field;
    if (dateFields.has(field)) {
      if (!isRealDate(String(value))) throw new HttpError(400, `«${label}» debe ser una fecha válida (AAAA-MM-DD).`);
    } else if (field === 'value_numeric') {
      const number = Number(String(value).replace(',', '.'));
      if (!Number.isFinite(number) || Math.abs(number) >= 1e12) throw new HttpError(400, '«Valor numérico» solo admite números; usa «Valor textual» para otros resultados.');
      cleaned[field] = number;
    } else if (typeof value === 'string' && textLimits[field] && value.length > textLimits[field]) {
      throw new HttpError(400, `El campo «${label}» admite hasta ${textLimits[field]} caracteres.`);
    }
    const allowed = allowedValues[type]?.[field];
    if (allowed && !allowed.includes(value)) throw new HttpError(400, `«${label}» tiene un valor no permitido.`);
  }
  for (const [start, end] of [['start_date', 'end_date'], ['onset_date', 'resolved_date']]) {
    if (cleaned[start] && cleaned[end] && cleaned[end] < cleaned[start]) {
      throw new HttpError(400, `«${fieldLabels[end]}» no puede ser anterior a «${fieldLabels[start]}».`);
    }
  }
  return cleaned;
}

export function cleanDetails(type, details = {}) {
  const config = detailMap[type];
  if (!config) return null;
  const cleaned = Object.fromEntries(config.fields.map((field) => {
    const value = details[field];
    return [field, value === '' ? null : typeof value === 'string' ? value.trim() || null : (value ?? null)];
  }));
  validateDetails(type, cleaned);
  if (type === 'SYMPTOM') {
    if (!cleaned.symptom_name || String(cleaned.symptom_name).trim().length < 2) {
      throw new HttpError(400, 'El nombre de la molestia o síntoma es obligatorio.');
    }
    if (cleaned.intensity != null) {
      const intensity = Number(cleaned.intensity);
      if (!Number.isInteger(intensity) || intensity < 0 || intensity > 10) {
        throw new HttpError(400, 'La intensidad del síntoma debe estar entre 0 y 10.');
      }
      cleaned.intensity = intensity;
    }
  }
  return cleaned;
}

async function writeVersion(conn, { eventId, profileId, snapshot, action, userId }) {
  const [rows] = await conn.execute(
    'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM health_event_versions WHERE event_id=?',
    [eventId]
  );
  await conn.execute(
    `INSERT INTO health_event_versions (event_id, profile_id, version_number, action, snapshot_json, changed_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [eventId, profileId, rows[0].next_version, action, JSON.stringify(snapshot), userId]
  );
}

function snapshotFor(event, details) {
  return {
    id: event.id,
    profileId: event.profile_id || event.profileId,
    eventType: event.event_type || event.eventType,
    title: event.title,
    description: event.description || null,
    eventDate: event.event_date || event.eventDate,
    source: event.source || null,
    notes: event.notes || null,
    details: details || null
  };
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
    await writeVersion(conn, {
      eventId: id,
      profileId,
      action: 'CREATE',
      userId,
      snapshot: snapshotFor({ id, profileId, eventType: body.eventType, title: body.title, description: body.description, eventDate: body.eventDate, source: body.source, notes: body.notes }, cleanDetails(body.eventType, body.details || {}))
    });
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
  event.linkedEvents = await getLinkedEvents(eventId, profileId);
  return event;
}

/** RF-18: registros del mismo perfil vinculados a este evento, en ambas direcciones. */
export async function getLinkedEvents(eventId, profileId) {
  const [rows] = await db.execute(
    `SELECT e.id, e.title, e.event_type AS eventType, e.event_date AS eventDate
       FROM health_event_links l
       JOIN health_events e ON e.id = CASE WHEN l.event_id = ? THEN l.linked_event_id ELSE l.event_id END
      WHERE l.profile_id = ? AND (l.event_id = ? OR l.linked_event_id = ?)
      ORDER BY e.event_date DESC, e.created_at DESC`,
    [eventId, profileId, eventId, eventId]
  );
  return rows;
}

const orderedPair = (a, b) => (a < b ? [a, b] : [b, a]);

export async function linkEvents({ profileId, eventId, linkedEventId, userId }) {
  if (eventId === linkedEventId) throw new HttpError(400, 'Un registro no puede vincularse consigo mismo.');
  const [rows] = await db.execute('SELECT id FROM health_events WHERE profile_id = ? AND id IN (?, ?)', [profileId, eventId, linkedEventId]);
  if (rows.length !== 2) throw new HttpError(404, 'Uno de los registros no existe en este perfil.');
  const [first, second] = orderedPair(eventId, linkedEventId);
  const [result] = await db.execute(
    `INSERT IGNORE INTO health_event_links (event_id, linked_event_id, profile_id, created_by_user_id) VALUES (?, ?, ?, ?)`,
    [first, second, profileId, userId]
  );
  return { created: result.affectedRows > 0 };
}

export async function unlinkEvents({ profileId, eventId, linkedEventId }) {
  const [first, second] = orderedPair(eventId, linkedEventId);
  const [result] = await db.execute('DELETE FROM health_event_links WHERE event_id = ? AND linked_event_id = ? AND profile_id = ?', [first, second, profileId]);
  if (!result.affectedRows) throw new HttpError(404, 'Los registros no estaban vinculados.');
}

/** RF-23: busca en el registro general y en los campos estructurados de cada tipo. */
export function searchCondition(rawQuery) {
  const q = String(rawQuery || '').trim().slice(0, 100);
  if (!q) return null;
  const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  const detailColumns = [
    ['medications', ['medication_name', 'dose', 'frequency']], ['allergies', ['allergen', 'reaction']],
    ['vaccinations', ['vaccine_name', 'provider']], ['lab_results', ['test_name', 'value_text', 'laboratory']],
    ['diagnoses', ['diagnosis_name', 'diagnosed_by']], ['antecedents', ['condition_name', 'relationship_person']],
    ['surgeries', ['procedure_name', 'facility', 'professional_name']], ['treatments', ['treatment_name', 'instructions']],
    ['symptoms', ['symptom_name', 'body_area']], ['consultations', ['professional_name', 'specialty', 'facility', 'reason']]
  ];
  const subqueries = detailColumns.map(([table, columns]) => `SELECT event_id FROM ${table} WHERE ${columns.map((column) => `${column} LIKE ?`).join(' OR ')}`);
  const params = [like, like, like, like, ...detailColumns.flatMap(([, columns]) => columns.map(() => like))];
  return { sql: `(title LIKE ? OR description LIKE ? OR source LIKE ? OR notes LIKE ? OR id IN (${subqueries.join(' UNION ')}))`, params, q };
}

export async function getEventsWithDetails(profileId, eventIds, executor = db) {
  if (!eventIds.length) return [];
  const unique = [...new Set(eventIds)].slice(0, 50);
  const placeholders = unique.map(() => '?').join(',');
  const [rows] = await executor.execute(
    `SELECT e.*, COALESCE((SELECT MAX(v.version_number) FROM health_event_versions v WHERE v.event_id=e.id), 0) AS record_version
       FROM health_events e WHERE e.profile_id = ? AND e.id IN (${placeholders}) ORDER BY e.event_date DESC`,
    [profileId, ...unique]
  );
  const result = [];
  for (const row of rows) {
    const config = detailMap[row.event_type];
    let details = null;
    if (config) {
      const [detailRows] = await executor.execute(`SELECT * FROM ${config.table} WHERE event_id = ? LIMIT 1`, [row.id]);
      details = detailRows[0] || null;
      if (details) delete details.event_id;
    }
    result.push({ ...row, details });
  }
  return result;
}

export async function updateEvent({ eventId, profileId, userId, body }) {
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
    const nextDetails = body.details ? { ...(current.details || {}), ...body.details } : current.details;
    if (body.details) await updateDetails(conn, eventId, current.event_type, nextDetails);
    await writeVersion(conn, {
      eventId,
      profileId,
      action: 'UPDATE',
      userId,
      snapshot: snapshotFor({
        ...current,
        title: body.title ?? current.title,
        description: body.description ?? current.description,
        event_date: body.eventDate ?? current.event_date,
        source: body.source ?? current.source,
        notes: body.notes ?? current.notes
      }, cleanDetails(current.event_type, nextDetails || {}))
    });
    await conn.commit();
    return getEventById(eventId, profileId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}

export async function deleteEvent({ eventId, profileId, userId }) {
  const current = await getEventById(eventId, profileId);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await writeVersion(conn, {
      eventId,
      profileId,
      action: 'DELETE',
      userId,
      snapshot: snapshotFor(current, cleanDetails(current.event_type, current.details || {}))
    });
    await conn.execute('DELETE FROM health_events WHERE id=? AND profile_id=?', [eventId, profileId]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally { conn.release(); }
}
