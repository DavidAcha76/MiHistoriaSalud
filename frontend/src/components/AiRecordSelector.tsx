import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { AppText as Text } from './AppText';
import { Card, Disclosure, Field, FormError, LoadingState, Muted, SecondaryButton } from './ui';
import type { MedicationRegimen, PagedEvents } from '../types/domain';
import { eventTypeLabel } from '../utils/presentation';
import { colors } from '../theme/colors';

type Props = { profileId: string; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean;
  medicationIds?: string[]; onMedicationChange?: (ids: string[]) => void };

export function AiRecordSelector({ profileId, selected, onChange, disabled, medicationIds = [], onMedicationChange }: Props) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<PagedEvents | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [medications, setMedications] = useState<MedicationRegimen[]>([]);
  const [medicationError, setMedicationError] = useState('');
  const includeMedications = Boolean(onMedicationChange);
  useEffect(() => {
    let active = true;
    setLoading(true); setData(null); setError('');
    apiRequest<PagedEvents>(`/profiles/${profileId}/events?${new URLSearchParams({ pageSize: '20', page: String(page), q: search })}`)
      .then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setError('No pudimos cargar los registros para seleccionar.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [profileId, page, search, retry]);
  useEffect(() => {
    if (!includeMedications) return;
    let active = true;
    setMedications([]); setMedicationError('');
    apiRequest<MedicationRegimen[]>(`/profiles/${profileId}/medication-regimens`)
      .then((value) => { if (active) setMedications(value); })
      .catch(() => { if (active) setMedicationError('No pudimos cargar los horarios de medicamentos.'); });
    return () => { active = false; };
  }, [profileId, includeMedications, retry]);
  const toggle = (id: string, ids: string[], change: (next: string[]) => void) => change(ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  function option(id: string, title: string, subtitle: string, ids: string[], change: (next: string[]) => void) {
    const checked = ids.includes(id);
    const blocked = Boolean(disabled || (!checked && ids.length >= 50));
    return <Pressable key={id} accessibilityRole="checkbox" accessibilityLabel={title} accessibilityState={{ checked, disabled: blocked }} aria-checked={checked} disabled={blocked} onPress={() => toggle(id, ids, change)}>
      <Card style={{ borderColor: checked ? colors.ai : colors.border, opacity: blocked ? .6 : 1 }}><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <MaterialCommunityIcons name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={checked ? colors.ai : colors.muted} />
        <View style={{ flex: 1 }}><Text style={{ fontWeight: '800' }}>{title}</Text><Muted>{subtitle}</Muted></View>
      </View></Card>
    </Pressable>;
  }
  return <>
    <Muted>{selected.length} registros{includeMedications ? ` y ${medicationIds.length} horarios de medicamentos` : ''} seleccionados. Puedes elegir hasta 50 de cada lista.</Muted>
    <Disclosure title="Elegir información médica para la IA">
      <Muted>Al enviar, autorizas usar estos datos actuales. Los archivos adjuntos no se envían. La selección puede abarcar varias páginas.</Muted>
      <Field label="Buscar registros para IA" value={query} onChangeText={setQuery} editable={!disabled} />
      <SecondaryButton title="Buscar registros" disabled={disabled || loading} onPress={() => { setSearch(query.trim()); setPage(1); }} />
      {loading ? <LoadingState /> : null}
      <FormError message={error} />
      {data?.items.map((event) => option(event.id, event.title, `${event.eventDate || event.event_date} · ${eventTypeLabel(event.eventType || event.event_type)}`, selected, onChange))}
      {data && !data.items.length ? <Muted>No hay registros que coincidan.</Muted> : null}
      {data && data.totalPages > 1 ? <><Muted>Página {page} de {data.totalPages}</Muted><SecondaryButton title="Registros anteriores" disabled={disabled || loading || page <= 1} onPress={() => setPage(page - 1)} /><SecondaryButton title="Siguientes registros" disabled={disabled || loading || page >= data.totalPages} onPress={() => setPage(page + 1)} /></> : null}
      {onMedicationChange ? <><Muted>Horarios de medicamentos registrados</Muted><FormError message={medicationError} />{medications.map((item) => option(item.id, item.medicationName, `${item.dose || 'Sin dosis registrada'} · ${item.isActive ? 'Recordatorio activo' : 'Recordatorio pausado'}`, medicationIds, onMedicationChange))}</> : null}
      {error || medicationError ? <SecondaryButton title="Volver a cargar selección" onPress={() => setRetry(retry + 1)} /> : null}
      <SecondaryButton title="Quitar toda la selección" disabled={disabled || (!selected.length && !medicationIds.length)} onPress={() => { onChange([]); onMedicationChange?.([]); }} />
    </Disclosure>
  </>;
}
