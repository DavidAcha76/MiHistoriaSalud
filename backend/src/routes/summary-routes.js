import express from 'express';
import { db } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { assertProfileAccess } from '../middleware/profile-access.js';
import { asyncHandler } from '../utils/async-handler.js';
import { audit } from '../services/audit-service.js';

export const summaryRouter = express.Router();
summaryRouter.use(requireAuth);

async function query(sql, params) {
  const [rows] = await db.execute(sql, params);
  return rows;
}

summaryRouter.get('/profiles/:profileId/consultation-summary', asyncHandler(async (req, res) => {
  const profile = await assertProfileAccess(req.auth.userId, req.params.profileId);
  const p = [profile.id];
  const [allergies, medications, diagnoses, antecedents, surgeries, vaccines, labs] = await Promise.all([
    query(`SELECT e.id, e.event_date AS eventDate, e.title, a.allergen, a.reaction, a.severity, a.status FROM health_events e JOIN allergies a ON a.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC`, p),
    query(`SELECT e.id, e.event_date AS eventDate, e.title, m.medication_name AS medicationName, m.dose, m.frequency, m.route, m.status, m.start_date AS startDate, m.end_date AS endDate FROM health_events e JOIN medications m ON m.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC`, p),
    query(`SELECT e.id, e.event_date AS eventDate, e.title, d.diagnosis_name AS diagnosisName, d.status, d.diagnosed_by AS diagnosedBy FROM health_events e JOIN diagnoses d ON d.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`, p),
    query(`SELECT e.id, e.event_date AS eventDate, e.title, a.category, a.condition_name AS conditionName, a.relationship_person AS relationshipPerson, a.status FROM health_events e JOIN antecedents a ON a.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 15`, p),
    query(`SELECT e.id, e.event_date AS eventDate, e.title, s.procedure_name AS procedureName, s.facility FROM health_events e JOIN surgeries s ON s.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`, p),
    query(`SELECT e.id, e.event_date AS eventDate, e.title, v.vaccine_name AS vaccineName, v.dose_number AS doseNumber, v.provider FROM health_events e JOIN vaccinations v ON v.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`, p),
    query(`SELECT e.id, e.event_date AS eventDate, e.title, l.test_name AS testName, l.value_text AS valueText, l.value_numeric AS valueNumeric, l.unit, l.reference_range AS referenceRange, l.flag, l.laboratory FROM health_events e JOIN lab_results l ON l.event_id=e.id WHERE e.profile_id=? ORDER BY e.event_date DESC LIMIT 10`, p)
  ]);
  await audit({ userId: req.auth.userId, profileId: profile.id, action: 'READ', resourceType: 'CONSULTATION_SUMMARY', resourceId: profile.id, ip: req.ip });
  res.json({
    generatedAt: new Date().toISOString(),
    profile: { id: profile.id, displayName: profile.display_name, birthDate: profile.birth_date, relationship: profile.relationship },
    allergies, medications, diagnoses, antecedents, surgeries, vaccines, recentLabs: labs,
    notice: 'Vista estructurada generada a partir de datos registrados por el usuario. No constituye un diagnóstico ni reemplaza la historia clínica oficial.'
  });
}));
