import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { apiRequest } from '../api/client';
import { AppTitle, Chip, Disclosure, EmptyState, FormError, Grid, IconBadge, LoadingState, Muted, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../components/ui';
import { DateField } from '../components/DateField';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { PagedAudit } from '../types/domain';
import { auditFilters, describeAudit } from '../utils/audit';
import { colors, fonts } from '../theme/colors';

type Filters = { type: string; from: string; to: string };
const empty: Filters = { type: '', from: '', to: '' };

/** RF-30 / CU-12: acciones registradas sobre el perfil, sin IP, contraseñas ni secretos. */
export function AuditScreen() {
  const { selectedProfile } = useProfiles();
  const [draft, setDraft] = useState<Filters>(empty);
  const [filters, setFilters] = useState<Filters>(empty);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PagedAudit | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => { setPage(1); setDraft(empty); setFilters(empty); }, [selectedProfile?.id]);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!selectedProfile) { setLoading(false); return; }
    setLoading(true); setError('');
    const query = new URLSearchParams({ page: String(page), pageSize: '25' });
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
    apiRequest<PagedAudit>(`/profiles/${selectedProfile.id}/audit?${query}`)
      .then((value) => { if (active) setData(value); })
      .catch((e: any) => { if (active) { setData(null); setError(e.message || 'No pudimos cargar la trazabilidad.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedProfile?.id, filters, page, reload]));

  function apply(next: Filters) {
    if (next.from && next.to && next.from > next.to) return setError('La fecha inicial debe ser anterior a la final.');
    setPage(1); setFilters(next);
  }
  return <Screen>
    <AppTitle eyebrow="Seguridad" title="Actividad y trazabilidad" subtitle="Consulta quién consultó o modificó la información de este perfil y cuándo lo hizo. Nunca se muestran contraseñas, códigos ni direcciones IP." />
    <ProfileSelector />
    <View style={styles.chips}>{auditFilters.map((item) => <Chip key={item.value || 'all'} label={item.label} selected={draft.type === item.value} onPress={() => { const next = { ...draft, type: item.value }; setDraft(next); apply(next); }} />)}</View>
    <Disclosure title="Filtrar por fecha">
      <Grid min={260}>
        <DateField label="Desde la fecha" value={draft.from} onChange={(from) => setDraft((value) => ({ ...value, from }))} clearable />
        <DateField label="Hasta la fecha" value={draft.to} onChange={(to) => setDraft((value) => ({ ...value, to }))} clearable />
      </Grid>
      <PrimaryButton title="Aplicar fechas" icon="calendar-search" onPress={() => apply(draft)} />
    </Disclosure>
    <SectionTitle right={data ? <Pill label={`${data.total} ${data.total === 1 ? 'acción' : 'acciones'}`} tone="accent" icon="history" /> : null}>Acciones registradas</SectionTitle>
    <FormError message={error} />
    {error ? <SecondaryButton title="Volver a intentar" icon="refresh" onPress={() => setReload((value) => value + 1)} /> : null}
    {loading ? <LoadingState label="Buscando la actividad…" /> : data?.items.map((entry) => {
      const { title, icon, tone } = describeAudit(entry);
      return <View key={entry.id} style={styles.entry}>
        <IconBadge icon={icon} tone={tone} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.entryTitle}>{title}</Text>
          <View style={styles.meta}><MaterialCommunityIcons name="account-outline" size={17} color={colors.muted} /><Muted>{entry.actorIsYou ? 'Tú' : entry.actorName || 'Cuenta eliminada'}</Muted></View>
          <View style={styles.meta}><MaterialCommunityIcons name="clock-outline" size={17} color={colors.muted} /><Muted>{new Date(entry.createdAt).toLocaleString('es-BO')}</Muted></View>
        </View>
      </View>;
    })}
    {!loading && !error && data && !data.items.length ? <EmptyState icon="history" text="No hay acciones registradas con estos filtros." /> : null}
    {data && data.totalPages > 1 ? <View style={{ gap: 4 }}>
      <Muted>Página {data.page} de {data.totalPages}</Muted>
      <Grid min={220} gap={12}>
        <SecondaryButton title="Más recientes" icon="chevron-left" disabled={page <= 1 || loading} onPress={() => setPage(page - 1)} />
        <SecondaryButton title="Más antiguas" icon="chevron-right" disabled={page >= data.totalPages || loading} onPress={() => setPage(page + 1)} />
      </Grid>
    </View> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  entry: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', padding: 16, marginBottom: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface },
  entryTitle: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 25, marginBottom: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 }
});
