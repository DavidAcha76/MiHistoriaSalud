import type { PlanStatus } from '../types/domain';

export const aiDate = (value: string | null) => value ? `${new Date(/^\d{4}-\d{2}-\d{2} \d{2}:/.test(value) ? `${value.replace(' ', 'T')}Z` : value).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/La_Paz' })} (Bolivia)` : 'Ahora';

export function aiBlockedReason(status: PlanStatus | null, feature: 'analysis' | 'chat') {
  if (!status) return 'Cargando disponibilidad…';
  if (!status.service?.available) return 'El servicio de IA aún no está disponible. Intenta más tarde.';
  if (!status.consent.granted) return 'Autoriza el uso de IA para este perfil desde el centro de IA.';
  if (feature === 'analysis') {
    return status.analysis.availableNow ? '' : `Tu próxima revisión estará disponible el ${aiDate(status.analysis.nextAnalysisAt)}.`;
  }
  if (status.chat.limit === 0) return 'El chat no está habilitado en este plan.';
  if (status.chat.limit != null && status.chat.usedThisWeek >= status.chat.limit) return `Agotaste tus ${status.chat.limit} mensajes semanales. Se renuevan el ${aiDate(status.chat.resetsAt)}.`;
  return '';
}
