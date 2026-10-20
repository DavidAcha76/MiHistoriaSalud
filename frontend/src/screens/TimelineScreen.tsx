import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Chip, Disclosure, EmptyState, Field, FormError, Grid, LoadingState, Muted, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle, type PressState } from '../components/ui';
import { DateField } from '../components/DateField';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import { useLayout } from '../hooks/useLayout';
import type { EventType, PagedEvents } from '../types/domain';
import { colors, fonts, shadows } from '../theme/colors';
import { shadow } from '../theme/effects';
import { dateParts, eventIcon, eventLabels, eventTone, eventTypeLabel, readableDate } from '../utils/presentation';

type Filters = { q: string; from: string; to: string; type: '' | EventType };
const emptyFilters: Filters = { q: '', from: '', to: '', type: '' };
export function TimelineScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles();
  const { compact } = useLayout();
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
  const items = !loading && !error ? data?.items || [] : [];
  return <Screen>
    <AppTitle eyebrow="Tu historia de salud" title="Mi historial" subtitle="Encuentra tus registros de salud, del más reciente al más antiguo." />
    <ProfileSelector />
    <Field label="¿Qué quieres encontrar?" icon="magnify" value={draft.q} onChangeText={(q) => setDraft((value) => ({ ...value, q }))} placeholder="Ej.: consulta, dolor de cabeza…" returnKeyType="search" onSubmitEditing={search} />
    <Disclosure title="Filtrar por fecha o tipo de registro">
      <Grid min={260}>
        <DateField label="Desde la fecha" value={draft.from} onChange={(from) => setDraft((value) => ({ ...value, from }))} clearable />
        <DateField label="Hasta la fecha" value={draft.to} onChange={(to) => setDraft((value) => ({ ...value, to }))} clearable />
      </Grid>
      <SectionTitle>Tipo de registro</SectionTitle>
      <View style={styles.chips}><Chip label="Todos" selected={!draft.type} onPress={() => setDraft((value) => ({ ...value, type: '' }))} />{(Object.entries(eventLabels) as [EventType, string][]).map(([value, label]) => <Chip key={value} label={label} selected={draft.type === value} onPress={() => setDraft((current) => ({ ...current, type: value }))} />)}</View>
    </Disclosure>
    <Grid min={240} gap={12}>
      <PrimaryButton title="Buscar en mi historial" icon="magnify" onPress={search} loading={loading} disabled={!selectedProfile} />
      {filtered ? <SecondaryButton title="Quitar filtros y ver todo" icon="filter-remove-outline" onPress={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(1); }} /> : null}
      <SecondaryButton title="+ Añadir un registro" onPress={() => navigation.navigate('EventForm')} disabled={!selectedProfile} />
    </Grid>
    <SectionTitle right={data && !loading && !error ? <Pill label={`${data.total} ${data.total === 1 ? 'registro' : 'registros'}`} tone="accent" icon="timeline-text-outline" /> : null}>{filtered ? 'Resultados de tu búsqueda' : 'Tus registros'}</SectionTitle>
    {loading ? <LoadingState /> : error ? <><FormError message={error} /><SecondaryButton title="Volver a intentar" icon="refresh" onPress={() => setReload((value) => value + 1)} /></> : null}
    {items.map((event, index) => {
      const parts = dateParts(event.eventDate);
      const type = event.eventType;
      return <View key={event.id} style={styles.row}>
        <View style={[styles.rail, compact && styles.railCompact]}>
          <View style={[styles.dateBox, compact && styles.dateBoxCompact]}><Text style={styles.day}>{parts.day}</Text><Text style={styles.month}>{parts.month}</Text></View>
          {index < items.length - 1 ? <View style={styles.line} /> : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${event.title}`} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} style={(state) => {
          const { pressed, hovered } = state as PressState;
          return [styles.card, hovered && styles.cardHovered, pressed && { opacity: .85 }];
        }}>
          <Pill label={eventTypeLabel(type)} icon={eventIcon(type)} tone={eventTone(type)} />
          <Text style={styles.title}>{event.title}</Text>
          <Muted>{readableDate(event.eventDate)}{event.source ? ` · ${event.source}` : ''}</Muted>
          {event.description ? <Text numberOfLines={3} style={styles.description}>{event.description}</Text> : null}
          <View style={styles.open}><Text style={styles.openText}>Ver registro</Text><MaterialCommunityIcons name="arrow-right" size={18} color={colors.primary} /></View>
        </Pressable>
      </View>;
    })}
    {!loading && !error && data && !data.items.length ? <EmptyState icon={filtered ? 'file-search-outline' : 'notebook-plus-outline'} title={filtered ? 'No encontramos coincidencias' : 'Tu historial está listo para empezar'} text={filtered ? 'Prueba con otra palabra o quita los filtros para ver todos los registros.' : 'Añade una consulta, una molestia o un resultado. Lo encontrarás aquí por fecha.'} /> : null}
    {data && data.totalPages > 1 ? <View style={styles.pagination}>
      <Muted>Página {data.page} de {data.totalPages} · {data.total} registros</Muted>
      <Grid min={220} gap={12}>
        <SecondaryButton title="Página anterior" icon="chevron-left" disabled={page <= 1 || loading} onPress={() => setPage((value) => value - 1)} />
        <SecondaryButton title="Ver siguientes registros" icon="chevron-right" disabled={page >= data.totalPages || loading} onPress={() => setPage((value) => value + 1)} />
      </Grid>
    </View> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row', gap: 14 },
  rail: { width: 64, alignItems: 'center' },
  railCompact: { width: 54 },
  dateBox: { width: 64, paddingVertical: 10, alignItems: 'center', borderRadius: 18, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderSoft },
  dateBoxCompact: { width: 54 },
  day: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: colors.text },
  month: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.primary, letterSpacing: 0.6 },
  line: { flex: 1, width: 2, marginVertical: 6, borderRadius: 2, backgroundColor: colors.borderSoft },
  card: { flex: 1, minWidth: 0, gap: 6, padding: 18, marginBottom: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface, ...shadow(shadows.card) },
  cardHovered: { borderColor: colors.border, backgroundColor: colors.surfaceHover },
  title: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 29, color: colors.text, marginTop: 6 },
  description: { marginTop: 4, fontSize: 17, lineHeight: 27, color: colors.text },
  open: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  openText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 16 },
  pagination: { marginTop: 8, gap: 4 }
});
