import { db } from '../config/db.js';

async function query(sql, params) {
  const [rows] = await db.execute(sql, params);
  return rows;
}

/**
 * RF-25 / CU-10: vista determinista, sin IA. Cada sección agrupa registros por fecha y
 * señala qué datos clave no se registraron, sin completar valores inexistentes.
 */
const SECTIONS = {
  allergies: {
    sql: `SELECT e.id, e.event_date AS eventDate, e.title, a.allergen, a.reaction, a.severity, a.status FROM health_events e JOIN allergies a ON a.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC`,
    required: [['reaction', 'Reacción'], ['severity', 'Intensidad']]
  },
  medications: {
    sql: `SELECT e.id, e.event_date AS eventDate, e.title, m.medication_name AS medicationName, m.dose, m.frequency, m.route, m.status, m.start_date AS startDate, m.end_date AS endDate FROM health_events e JOIN medications m ON m.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC`,
    required: [['dose', 'Dosis'], ['frequency', 'Frecuencia'], ['startDate', 'Fecha de inicio']]
  },
  diagnoses: {
    sql: `SELECT e.id, e.event_date AS eventDate, e.title, d.diagnosis_name AS diagnosisName, d.status, d.diagnosed_by AS diagnosedBy FROM health_events e JOIN diagnoses d ON d.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`,
    required: [['status', 'Estado'], ['diagnosedBy', 'Profesional o fuente']]
  },
  antecedents: {
    sql: `SELECT e.id, e.event_date AS eventDate, e.title, a.category, a.condition_name AS conditionName, a.relationship_person AS relationshipPerson, a.status FROM health_events e JOIN antecedents a ON a.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 15`,
    required: [['category', 'Personal o familiar'], ['status', 'Estado']]
  },
  treatments: {
    sql: `SELECT e.id, e.event_date AS eventDate, e.title, t.treatment_name AS treatmentName, t.instructions, t.start_date AS startDate, t.end_date AS endDate FROM health_events e JOIN treatments t ON t.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`,
    required: [['instructions', 'Indicaciones'], ['startDate', 'Fecha de inicio']]
  },
  surgeries: {
    sql: `SELECT e.id, e.event_date AS eventDate, e.title, s.procedure_name AS procedureName, s.facility FROM health_events e JOIN surgeries s ON s.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`,
    required: [['facility', 'Centro']]
  },
  vaccines: {
    sql: `SELECT e.id, e.event_date AS eventDate, e.title, v.vaccine_name AS vaccineName, v.dose_number AS doseNumber, v.provider FROM health_events e JOIN vaccinations v ON v.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`,
    required: [['doseNumber', 'Número de dosis']]
  },
  recentLabs: {
    sql: `SELECT e.id, e.event_date AS eventDate, e.title, l.test_name AS testName, l.value_text AS valueText, l.value_numeric AS valueNumeric, l.unit, l.reference_range AS referenceRange, l.flag, l.laboratory FROM health_events e JOIN lab_results l ON l.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`,
    required: [['value', 'Valor'], ['unit', 'Unidad'], ['referenceRange', 'Rango de referencia']]
  }
};
export const SUMMARY_SECTIONS = Object.keys(SECTIONS);

function missingFields(item, required) {
  return required.filter(([key]) => {
    const value = key === 'value' ? item.valueText ?? item.valueNumeric : item[key];
    return value == null || String(value).trim() === '';
  }).map(([, label]) => label);
}

export async function buildConsultationSummary(profile, sections = SUMMARY_SECTIONS) {
  const selected = SUMMARY_SECTIONS.filter((key) => sections.includes(key));
  const results = await Promise.all(selected.map((key) => query(SECTIONS[key].sql, [profile.id])));
  const data = Object.fromEntries(SUMMARY_SECTIONS.map((key) => [key, []]));
  selected.forEach((key, index) => {
    data[key] = results[index].map((item) => ({ ...item, missing: missingFields(item, SECTIONS[key].required) }));
  });
  return {
    generatedAt: new Date().toISOString(),
    profile: { id: profile.id, displayName: profile.display_name, birthDate: profile.birth_date, relationship: profile.relationship },
    selectedSections: selected,
    ...data,
    notice: 'Vista estructurada generada a partir de datos registrados por el usuario. No constituye un diagnóstico ni reemplaza la historia clínica oficial.'
  };
}
