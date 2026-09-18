import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Chip, Disclosure, Field, FormError, LoadingState, Muted, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../components/ui';
import { DateField } from '../components/DateField';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { EventType, PagedEvents } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { eventLabels, eventTypeLabel, readableDate } from '../utils/presentation';

type Filters = { q: string; from: string; to: string; type: '' | EventType };
const emptyFilters: Filters = { q: '', from: '', to: '', type: '' };
export function TimelineScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles();
  const [data, setData] = useState<PagedEvents | null>(null);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { setPage(1); setDraft(emptyFilters); setFilters(emptyFilters); }, [selectedProfile?.id]);
  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null); setError('');
    if (!selectedProfile) { setLoading(false); return; }
    setLoading(true);
    const query = new URLSearchParams({ pageSize: '20', page: String(page) });
    Object.entries(filters).forEach(([key, value]) => { if (value.trim()) query.set(key, value.trim()); });
    apiRequest<PagedEvents>(`/profiles/${selectedProfile.id}/events?${query}`).then((response) => { if (active) setData(response); }).catch(() => { if (active) setError('No pudimos cargar el historial. Revisa tu conexión y vuelve a intentar.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedProfile?.id, filters, page, reload]));
  function search() {
    if (draft.from && draft.to && draft.from > draft.to) return setError('La fecha de inicio debe ser anterior a la fecha final.');
    setPage(1); setFilters({ ...draft }); setError('');
  }
  const filtered = Object.values(filters).some(Boolean);
  return <Screen>
    <AppTitle title="Mi historial" subtitle="Encuentra tus registros de salud, del más reciente al más antiguo." />
    <ProfileSelector />
    <Field label="¿Qué quieres encontrar?" value={draft.q} onChangeText={(q) => setDraft((value) => ({ ...value, q }))} placeholder="Ej.: consulta, dolor de cabeza…" returnKeyType="search" onSubmitEditing={search} />
    <Disclosure title="Filtrar por fecha o tipo de registro">
      <DateField label="Desde la fecha" value={draft.from} onChange={(from) => setDraft((value) => ({ ...value, from }))} clearable />
      <DateField label="Hasta la fecha" value={draft.to} onChange={(to) => setDraft((value) => ({ ...value, to }))} clearable />
      <SectionTitle>Tipo de registro</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}><Chip label="Todos" selected={!draft.type} onPress={() => setDraft((value) => ({ ...value, type: '' }))} />{(Object.entries(eventLabels) as [EventType, string][]).map(([value, label]) => <Chip key={value} label={label} selected={draft.type === value} onPress={() => setDraft((current) => ({ ...current, type: value }))} />)}</View>
    </Disclosure>
    <PrimaryButton title="Buscar en mi historial" onPress={search} loading={loading} disabled={!selectedProfile} />
    {filtered ? <SecondaryButton title="Quitar filtros y ver todo" onPress={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); }} /> : null}
    <SecondaryButton title="+ Añadir un registro" onPress={() => navigation.navigate('EventForm')} disabled={!selectedProfile} />
    <SectionTitle>{filtered ? 'Resultados de tu búsqueda' : 'Tus registros'}</SectionTitle>
    {loading ? <LoadingState /> : error ? <><FormError message={error} /><SecondaryButton title="Volver a intentar" onPress={() => setReload((value) => value + 1)} /></> : null}
    {!loading && !error ? data?.items.map((event) => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${event.title}`} key={event.id} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })}><Card><Text style={{ color: colors.primary, fontSize: 16, lineHeight: 25, fontFamily: fonts.semibold, marginBottom: 6 }}>{readableDate(event.eventDate)}</Text><Text style={{ fontFamily: fonts.bold, fontSize: 20, lineHeight: 30, color: colors.text }}>{event.title}</Text><Muted>{eventTypeLabel(event.eventType)}{event.source ? ` · ${event.source}` : ''}</Muted>{event.description ? <Text numberOfLines={3} style={{ marginTop: 10, fontSize: 17, lineHeight: 27, color: colors.text }}>{event.description}</Text> : null}<Text style={{ marginTop: 12, color: colors.primary, fontFamily: fonts.bold, fontSize: 16 }}>Ver registro →</Text></Card></Pressable>) : null}
    {!loading && !error && data && !data.items.length ? <Card><Text style={{ fontSize: 19, lineHeight: 28, fontFamily: fonts.bold, color: colors.text, marginBottom: 8 }}>{filtered ? 'No encontramos coincidencias' : 'Tu historial está listo para empezar'}</Text><Muted>{filtered ? 'Prueba con otra palabra o quita los filtros para ver todos los registros.' : 'Añade una consulta, una molestia o un resultado. Lo encontrarás aquí por fecha.'}</Muted></Card> : null}
    {data && data.totalPages > 1 ? <View><Muted>Página {data.page} de {data.totalPages} · {data.total} registros</Muted><SecondaryButton title="Página anterior" disabled={page <= 1 || loading} onPress={() => setPage((value) => value - 1)} /><SecondaryButton title="Ver siguientes registros" disabled={page >= data.totalPages || loading} onPress={() => setPage((value) => value + 1)} /></View> : null}
  </Screen>;
}
