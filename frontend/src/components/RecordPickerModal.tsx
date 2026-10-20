import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { EmptyState, Field, FormError, IconBadge, LoadingState, SecondaryButton, type PressState } from './ui';
import type { PagedEvents } from '../types/domain';
import { colors, fonts, shadows } from '../theme/colors';
import { shadow } from '../theme/effects';
import { eventIcon, eventTone, eventTypeLabel, readableDate } from '../utils/presentation';

type Props = {
  visible: boolean;
  profileId: string;
  title: string;
  hint: string;
  excludeIds?: string[];
  onClose: () => void;
  onSelect: (event: { id: string; title: string }) => void;
};

/** RF-18: elige un registro del mismo perfil para vincularlo, con búsqueda y paginación del servidor. */
export function RecordPickerModal({ visible, profileId, title, hint, excludeIds = [], onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedEvents | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true); setError('');
    apiRequest<PagedEvents>(`/profiles/${profileId}/events?${new URLSearchParams({ page: String(page), pageSize: '15', q: search })}`)
      .then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setError('No pudimos cargar los registros. Inténtalo de nuevo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [visible, profileId, page, search]);
  useEffect(() => { if (!visible) { setQuery(''); setSearch(''); setPage(1); } }, [visible]);
  const items = (data?.items || []).filter((event) => !excludeIds.includes(event.id));
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar selector de registros" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityViewIsModal style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.title}>{title}</Text><Text style={styles.hint}>{hint}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={styles.close}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Field label="Buscar un registro" icon="magnify" value={query} onChangeText={setQuery} returnKeyType="search" onSubmitEditing={() => { setSearch(query.trim()); setPage(1); }} placeholder="Ej.: hemograma, consulta…" />
          <SecondaryButton title="Buscar" icon="magnify" onPress={() => { setSearch(query.trim()); setPage(1); }} disabled={loading} />
          <FormError message={error} />
          {loading ? <LoadingState label="Buscando registros…" /> : items.map((event) => {
            const type = event.eventType || event.event_type;
            return <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Vincular ${event.title}`} onPress={() => onSelect({ id: event.id, title: event.title })} style={(state) => [styles.option, (state as PressState).hovered && styles.optionHovered]}>
              <IconBadge icon={eventIcon(type)} tone={eventTone(type)} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.optionTitle}>{event.title}</Text><Text style={styles.optionMeta}>{readableDate(event.eventDate || event.event_date)} · {eventTypeLabel(type)}</Text></View>
              <MaterialCommunityIcons name="link-variant-plus" size={22} color={colors.primary} />
            </Pressable>;
          })}
          {!loading && !error && !items.length ? <EmptyState icon="file-search-outline" text="No hay otros registros que coincidan." /> : null}
          {data && data.totalPages > 1 ? <View style={styles.pages}>
            <SecondaryButton title="Anteriores" icon="chevron-left" disabled={page <= 1 || loading} onPress={() => setPage(page - 1)} />
            <SecondaryButton title="Siguientes" icon="chevron-right" disabled={page >= data.totalPages || loading} onPress={() => setPage(page + 1)} />
          </View> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(4, 10, 14, 0.78)' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 26, overflow: 'hidden', ...shadow(shadows.raised) },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, paddingBottom: 8 },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 21, lineHeight: 28 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 4 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  body: { padding: 20, paddingTop: 8 },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface },
  optionHovered: { borderColor: colors.primary, backgroundColor: colors.surfaceHover },
  optionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, lineHeight: 25 },
  optionMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  pages: { gap: 4 }
});
