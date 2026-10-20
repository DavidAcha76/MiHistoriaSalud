import type { MaterialCommunityIcons } from '@expo/vector-icons';
import type { AccessRole, AuditEntry } from '../types/domain';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Tone = 'primary' | 'accent' | 'ai' | 'warning' | 'danger' | 'neutral';

export const roleLabels: Record<AccessRole, string> = {
  OWNER: 'Titular',
  REPRESENTATIVE: 'Representante autorizado',
  VIEWER: 'Solo consulta'
};
export const roleHints: Record<Exclude<AccessRole, 'OWNER'>, string> = {
  REPRESENTATIVE: 'Puede consultar y actualizar registros, documentos y medicamentos.',
  VIEWER: 'Solo puede consultar la información; no puede modificarla.'
};

/** Grupos de filtro de la trazabilidad, alineados con el backend (RF-30). */
export const auditFilters = [
  { value: '', label: 'Todas' },
  { value: 'CHANGES', label: 'Cambios' },
  { value: 'ACCESS', label: 'Consultas' },
  { value: 'AI', label: 'IA' },
  { value: 'SHARING', label: 'Compartir y permisos' }
] as const;

const labels: Record<string, [string, IconName, Tone]> = {
  'READ:HEALTH_PROFILE': ['Se consultó el perfil', 'eye-outline', 'neutral'],
  'READ:CONSULTATION_SUMMARY': ['Se generó la vista para consulta', 'stethoscope', 'primary'],
  'CREATE:HEALTH_PROFILE': ['Perfil creado', 'account-plus-outline', 'primary'],
  'UPDATE:HEALTH_PROFILE': ['Datos del perfil actualizados', 'account-edit-outline', 'primary'],
  'DELETE_REQUEST:HEALTH_PROFILE': ['Se solicitó eliminar el perfil', 'account-remove-outline', 'danger'],
  'ACCESS_DENIED:HEALTH_PROFILE': ['Acceso rechazado por falta de permiso', 'shield-alert-outline', 'danger'],
  'CREATE:HEALTH_EVENT': ['Registro de salud creado', 'note-plus-outline', 'primary'],
  'UPDATE:HEALTH_EVENT': ['Registro de salud actualizado', 'note-edit-outline', 'primary'],
  'DELETE:HEALTH_EVENT': ['Registro de salud eliminado', 'note-remove-outline', 'danger'],
  'LINK:HEALTH_EVENT': ['Registros vinculados', 'link-variant', 'accent'],
  'UNLINK:HEALTH_EVENT': ['Vínculo entre registros eliminado', 'link-variant-off', 'neutral'],
  'UPLOAD:CLINICAL_DOCUMENT': ['Documento cargado', 'file-upload-outline', 'accent'],
  'DOWNLOAD:CLINICAL_DOCUMENT': ['Documento abierto o descargado', 'file-download-outline', 'neutral'],
  'DELETE:CLINICAL_DOCUMENT': ['Documento eliminado', 'file-remove-outline', 'danger'],
  'LINK:CLINICAL_DOCUMENT': ['Documento vinculado a un registro', 'paperclip', 'accent'],
  'UNLINK:CLINICAL_DOCUMENT': ['Documento desvinculado de su registro', 'link-variant-off', 'neutral'],
  'ANALYZE:AI_ANALYSIS': ['Revisión con IA solicitada', 'creation', 'ai'],
  'AI_CHAT:AI_CONVERSATION': ['Mensaje enviado al asistente de IA', 'chat-processing-outline', 'ai'],
  'AI_CONSENT_GRANTED:AI_CONSENT': ['Permiso de IA autorizado', 'shield-check-outline', 'ai'],
  'AI_CONSENT_REVOKED:AI_CONSENT': ['Permiso de IA retirado', 'shield-off-outline', 'warning'],
  'CREATE_SHARE_PACKAGE:SHARE_PACKAGE': ['Enlace para compartir creado', 'share-variant-outline', 'accent'],
  'REVOKE_SHARE_PACKAGE:SHARE_PACKAGE': ['Enlace para compartir revocado', 'link-variant-off', 'warning'],
  'EXPORT_DATA:HEALTH_PROFILE': ['Copia de los datos descargada', 'download-outline', 'neutral'],
  'AUTHORIZATION_GRANTED:PROFILE_AUTHORIZATION': ['Autorización concedida a otra cuenta', 'account-key-outline', 'accent'],
  'AUTHORIZATION_UPDATED:PROFILE_AUTHORIZATION': ['Autorización modificada', 'account-key-outline', 'accent'],
  'AUTHORIZATION_REVOKED:PROFILE_AUTHORIZATION': ['Autorización revocada', 'account-cancel-outline', 'warning'],
  'CREATE:MEDICATION_REGIMEN': ['Horario de medicamento registrado', 'pill', 'primary'],
  'UPDATE:MEDICATION_REGIMEN': ['Recordatorios de medicamento modificados', 'bell-cog-outline', 'primary'],
  'CONFIRM:MEDICATION_DOSE': ['Toma de medicamento confirmada', 'check-circle-outline', 'primary']
};

export function describeAudit(entry: AuditEntry): { title: string; icon: IconName; tone: Tone } {
  const match = labels[`${entry.action}:${entry.resourceType}`];
  if (match) return { title: match[0], icon: match[1], tone: match[2] };
  return { title: `${entry.action.toLowerCase().replace(/_/g, ' ')} · ${entry.resourceType.toLowerCase().replace(/_/g, ' ')}`, icon: 'history', tone: 'neutral' };
}
