import type { EventType } from '../types/domain';

export const eventLabels: Record<EventType, string> = {
  SYMPTOM: 'Molestia o síntoma', CONSULTATION: 'Consulta médica', MEDICATION: 'Medicamento', LAB_RESULT: 'Resultado de examen',
  ANTECEDENT: 'Antecedente', DIAGNOSIS: 'Diagnóstico informado', TREATMENT: 'Tratamiento', ALLERGY: 'Alergia', VACCINE: 'Vacuna', SURGERY: 'Cirugía', OTHER: 'Otro dato de salud'
};
export const eventTypeLabel = (value?: string) => eventLabels[value as EventType] || 'Registro de salud';
export const detailLabels: Record<string, string> = {
  category: 'Tipo de antecedente', condition_name: 'Condición', relationship_person: 'Parentesco', onset_date: 'Fecha de inicio', status: 'Estado',
  professional_name: 'Profesional', specialty: 'Especialidad', facility: 'Centro médico', reason: 'Motivo', diagnosis_name: 'Diagnóstico informado', diagnosed_by: 'Indicado por',
  treatment_name: 'Tratamiento', instructions: 'Indicaciones', start_date: 'Fecha de inicio', end_date: 'Fecha de fin', medication_name: 'Medicamento', dose: 'Dosis', frequency: 'Frecuencia', route: 'Vía de administración',
  allergen: 'Causa de la alergia', reaction: 'Reacción', severity: 'Intensidad registrada', vaccine_name: 'Vacuna', dose_number: 'Número de dosis', lot_number: 'Lote', provider: 'Centro o proveedor',
  procedure_name: 'Procedimiento', test_name: 'Examen', value_text: 'Resultado', value_numeric: 'Valor', unit: 'Unidad', reference_range: 'Rango de referencia', flag: 'Observación del laboratorio', laboratory: 'Laboratorio',
  symptom_name: 'Molestia', body_area: 'Zona del cuerpo', intensity: 'Intensidad (0 a 10)', resolved_date: 'Fecha en que terminó', triggers_text: 'Qué la empeora', relief_text: 'Qué la alivia', associated_symptoms: 'Otras molestias', impact_text: 'Efecto en tus actividades'
};
export function detailValue(key: string, value: unknown) {
  if (value == null || value === '') return 'Sin registrar';
  if (key.endsWith('_date')) return readableDate(String(value));
  const labels: Record<string, string> = { ACTIVE: 'Presente o vigente', RESOLVED: 'Resuelto', UNKNOWN: 'No estoy seguro', RECURRENT: 'Ha vuelto', PAUSED: 'Pausado', FINISHED: 'Finalizado', SUSPECTED: 'Sospecha registrada', UNDER_OBSERVATION: 'En seguimiento', PERSONAL: 'Personal', FAMILY: 'Familiar', OTHER: 'Otro' };
  return key === 'status' || key === 'category' ? labels[String(value)] || String(value) : String(value);
}
export function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function readableDate(value?: string) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' });
}
