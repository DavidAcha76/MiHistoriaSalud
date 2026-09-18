import { HttpError } from '../utils/http-error.js';
import { getEventsWithDetails } from './event-service.js';

const clinicalFields = new Set([
  'category', 'condition_name', 'relationship_person', 'onset_date', 'status',
  'specialty', 'reason', 'diagnosis_name', 'treatment_name', 'instructions',
  'start_date', 'end_date', 'medication_name', 'dose', 'frequency', 'route',
  'allergen', 'reaction', 'severity', 'vaccine_name', 'dose_number', 'lot_number',
  'procedure_name', 'test_name', 'value_text', 'value_numeric', 'unit', 'reference_range', 'flag',
  'symptom_name', 'body_area', 'intensity', 'resolved_date', 'triggers_text',
  'relief_text', 'associated_symptoms', 'impact_text'
]);

export async function loadSelectedMedicalRecords(profileId, eventIds, medicationIds, executor) {
  const uniqueEvents = [...new Set(eventIds)];
  const events = await getEventsWithDetails(profileId, uniqueEvents, executor);
  if (events.length !== uniqueEvents.length) throw new HttpError(400, 'Uno o más registros seleccionados no pertenecen al perfil o ya no existen.');
  const uniqueMedications = [...new Set(medicationIds)];
  let medications = [];
  if (uniqueMedications.length) {
    [medications] = await executor.execute(
      `SELECT id, medication_name, dose, schedule_days, schedule_times, start_date, end_date, notes, is_active
         FROM medication_regimens WHERE profile_id=? AND id IN (${uniqueMedications.map(() => '?').join(',')}) ORDER BY start_date DESC`,
      [profileId, ...uniqueMedications]
    );
    if (medications.length !== uniqueMedications.length) throw new HttpError(400, 'Uno o más medicamentos seleccionados no pertenecen al perfil o ya no existen.');
  }
  return { events, medications };
}

const jsonArray = (value) => Array.isArray(value) ? value : JSON.parse(value || '[]');

export function medicalContext(events = [], medications = []) {
  const context = {
    scope: 'Solo información seleccionada por el usuario para esta solicitud; no representa el historial completo.',
    selectedRecords: events.map((event, index) => ({
      reference: `R${index + 1}`,
      type: event.event_type, date: event.event_date, title: event.title,
      description: event.description || null, notes: event.notes || null,
      details: Object.fromEntries(Object.entries(event.details || {}).filter(([key]) => clinicalFields.has(key)))
    })),
    selectedMedicationSchedules: medications.map((item, index) => ({
      reference: `M${index + 1}`, name: item.medication_name, recordedDose: item.dose,
      recordedDays: jsonArray(item.schedule_days), recordedTimes: jsonArray(item.schedule_times),
      startDate: item.start_date, endDate: item.end_date, notes: item.notes,
      reminderActive: Boolean(item.is_active)
    })),
    limitations: 'No se envían archivos PDF ni imágenes. Un campo vacío no demuestra ausencia de una condición. Un horario registrado no confirma una toma ni la vigencia clínica del tratamiento.'
  };
  if (JSON.stringify(context).length > 60000) {
    throw new HttpError(413, 'La selección contiene demasiado texto. Selecciona menos registros para enviarlos completos.');
  }
  return context;
}
