import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Disclosure, EmptyState, FormError, Grid, IconBadge, LoadingState, Muted, Pill, PrimaryButton, ProgressBar, Screen, SecondaryButton, Stat } from '../components/ui';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import { useLayout } from '../hooks/useLayout';
import type { MedicationRegimen, MedicationDoseSlot } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { localDate, readableDate } from '../utils/presentation';

const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
type Confirmation = { regimen: MedicationRegimen; slot?: MedicationDoseSlot };
export function MedicationScheduleScreen({ navigation }: any) {
  const { selectedProfile, canEdit } = useProfiles();
  const { twoColumns } = useLayout();
  const [items, setItems] = useState<MedicationRegimen[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const requestId = useRef(0);
  const currentProfile = useRef(selectedProfile?.id);
  currentProfile.current = selectedProfile?.id;
  const submitting = useRef(false);
  const load = useCallback(async () => {
    const request = ++requestId.current;
    if (!selectedProfile) { setItems([]); setLoading(false); return; }
    try {
      const response = await apiRequest<MedicationRegimen[]>(`/profiles/${selectedProfile.id}/medication-regimens`);
      if (request !== requestId.current || currentProfile.current !== selectedProfile.id) return;
      setItems(response); setError('');
    } catch { if (request === requestId.current) setError('No pudimos actualizar tus medicamentos. Revisa tu conexión y vuelve a intentar antes de confirmar una toma.'); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [selectedProfile?.id]);
  useFocusEffect(useCallback(() => {
    setItems([]); setLoading(true); setMessage(''); setError(''); setConfirmation(null);
    void load();
    const refresh = setInterval(() => { void load(); }, 60 * 1000);
    return () => { clearInterval(refresh); requestId.current++; };
  }, [load]));

  async function performAction() {
    if (!selectedProfile || !confirmation || submitting.current) return;
    const { regimen, slot } = confirmation;
    submitting.current = true; setConfirmation(null); setBusyKey(regimen.id); setError(''); setMessage('');
    try {
      const path = `/profiles/${selectedProfile.id}/medication-regimens/${regimen.id}`;
      if (slot) await apiRequest(`${path}/confirm`, { method: 'POST', body: JSON.stringify(slot) });
      else await apiRequest(path, { method: 'PATCH', body: JSON.stringify({ isActive: !regimen.isActive }) });
      if (currentProfile.current !== selectedProfile.id) return;
      setMessage(slot ? `Toma de ${regimen.medicationName} de las ${slot.scheduledTime} guardada.` : `Recordatorios ${regimen.isActive ? 'pausados' : 'reanudados'} para ${regimen.medicationName}.`);
      await load();
    } catch { if (currentProfile.current === selectedProfile.id) setError('No pudimos guardar el cambio. Vuelve a cargar la lista para comprobar su estado antes de intentarlo otra vez.'); }
    finally { submitting.current = false; setBusyKey(null); }
  }

  const activeCount = items.filter((regimen) => regimen.isActive).length;
  const pendingCount = items.reduce((total, regimen) => total + (regimen.isActive ? regimen.adherence.pending.length : 0), 0);
  return <Screen>
    <AppTitle eyebrow={`Hoy · ${readableDate(localDate())}`} title="Mis medicamentos" subtitle="Consulta tus horarios y marca una toma solo después de haberla tomado." />
    <ProfileSelector />
    {!loading && items.length ? twoColumns ? <Grid min={240} gap={12}>
      <Stat icon="pill" value={String(activeCount)} label={activeCount === 1 ? 'medicamento con recordatorio' : 'medicamentos con recordatorio'} />
      <Stat icon="clock-alert-outline" value={String(pendingCount)} label={pendingCount === 1 ? 'toma por confirmar hoy' : 'tomas por confirmar hoy'} tone={pendingCount ? 'warning' : 'primary'} />
    </Grid> : <View style={styles.summaryPills}>
      <Pill icon="pill" label={`${activeCount} con recordatorio`} />
      <Pill icon="clock-alert-outline" label={`${pendingCount} por confirmar hoy`} tone={pendingCount ? 'warning' : 'primary'} />
    </View> : null}
    {message ? <Card tone="primary" style={styles.message}><MaterialCommunityIcons name="check-circle" size={24} color={colors.success} /><Text accessibilityLiveRegion="polite" style={{ flex: 1, color: colors.success }}>{message}</Text></Card> : null}
    <FormError message={error} />
    {error ? <SecondaryButton title="Volver a cargar medicamentos" icon="refresh" onPress={() => { setLoading(true); void load(); }} /> : null}
    {loading ? <LoadingState label="Buscando tus horarios…" /> : <Grid min={420}>{items.map((regimen) => <Card key={regimen.id}>
      <View style={styles.cardHeader}>
        <IconBadge icon="pill" tone={regimen.isActive ? 'primary' : 'neutral'} size={50} />
        <View style={styles.cardCopy}><Text style={styles.name}>{regimen.medicationName}</Text>{regimen.dose ? <Text style={styles.dose}>{regimen.dose}</Text> : null}</View>
        <Pill label={regimen.isActive ? 'Activo' : 'Pausado'} tone={regimen.isActive ? 'primary' : 'warning'} icon={regimen.isActive ? 'bell-ring-outline' : 'pause'} />
      </View>
      <View style={styles.schedule}><MaterialCommunityIcons name="calendar-month-outline" size={20} color={colors.muted} /><Muted style={{ flex: 1 }}>{regimen.scheduleDays.length === 7 ? 'Todos los días' : regimen.scheduleDays.map((day) => dayLabels[day]).join(' · ')}</Muted></View>
      <View style={styles.times}>{regimen.scheduleTimes.map((time) => <View key={time} style={styles.time}><MaterialCommunityIcons name="clock-outline" size={17} color={colors.accent} /><Text style={styles.timeText}>{time}</Text></View>)}</View>
      {regimen.notes ? <Text style={styles.notes}>{regimen.notes}</Text> : null}
      {!regimen.isActive ? <View style={[styles.state, styles.paused]}><MaterialCommunityIcons name="bell-off-outline" size={22} color={colors.warning} /><Text style={{ flex: 1, color: colors.warning }}>Recordatorios pausados</Text></View> : regimen.adherence.pending.length ? <View style={styles.pending}>
        <View style={styles.pendingHeading}><MaterialCommunityIcons name="clock-alert-outline" size={22} color={colors.warning} /><Text style={{ fontFamily: fonts.bold, flex: 1 }}>Tomas de hoy sin confirmar</Text></View>
        {regimen.adherence.pending.map((slot) => <PrimaryButton key={`${slot.scheduledDate}-${slot.scheduledTime}`} title={`Ya tomé la de las ${slot.scheduledTime}`} icon="check" disabled={Boolean(busyKey) || Boolean(error) || !canEdit} loading={busyKey === regimen.id} onPress={() => setConfirmation({ regimen, slot })} />)}
      </View> : <View style={[styles.state, styles.done]}><MaterialCommunityIcons name="check-circle-outline" size={24} color={colors.success} /><Text style={{ flex: 1 }}>Por ahora no hay tomas pendientes de confirmar.</Text></View>}
      <Disclosure title="Ver seguimiento y recordatorios">
        <View style={styles.followHeading}><Text style={{ fontFamily: fonts.bold, flex: 1 }}>Últimos 30 días</Text><Text style={styles.followValue}>{regimen.adherence.confirmed}/{regimen.adherence.total}</Text></View>
        <ProgressBar value={regimen.adherence.total ? regimen.adherence.confirmed / regimen.adherence.total : 0} label={`${regimen.adherence.confirmed} tomas confirmadas de ${regimen.adherence.total}`} />
        <Muted style={{ marginTop: 10 }}>{regimen.adherence.confirmed} tomas confirmadas de {regimen.adherence.total} esperadas. Este conteo no evalúa tu salud.</Muted>
        <SecondaryButton title={regimen.isActive ? 'Pausar recordatorios' : 'Reanudar recordatorios'} icon={regimen.isActive ? 'bell-off-outline' : 'bell-ring-outline'} onPress={() => setConfirmation({ regimen })} disabled={Boolean(busyKey) || Boolean(error) || !canEdit} />
      </Disclosure>
    </Card>)}</Grid>}
    {!loading && !error && selectedProfile && !items.length ? <EmptyState icon="pill" title="Añade tu primer medicamento" text="Guarda el nombre y el horario indicado por tu profesional. Luego podrás anotar cada toma aquí." /> : null}
    {canEdit ? <PrimaryButton title="+ Añadir un medicamento" onPress={() => navigation.navigate('MedicationForm')} disabled={!selectedProfile || Boolean(busyKey)} /> : <Muted>Tu permiso sobre este perfil es solo de consulta: puedes ver los horarios, pero no confirmar tomas ni modificarlos.</Muted>}
    <View style={styles.footnote}><MaterialCommunityIcons name="information-outline" size={20} color={colors.muted} /><Muted style={{ flex: 1 }}>Los recordatorios se consultan dentro de la app. Sigue siempre la pauta indicada por tu profesional.</Muted></View>
    <ConfirmationDialog visible={Boolean(confirmation)} title={confirmation?.slot ? '¿Ya tomaste este medicamento?' : confirmation?.regimen.isActive ? '¿Pausar los recordatorios?' : '¿Reanudar los recordatorios?'} message={confirmation ? `${confirmation.regimen.medicationName}${confirmation.regimen.dose ? ` · ${confirmation.regimen.dose}` : ''}\n${confirmation.slot ? `Toma de las ${confirmation.slot.scheduledTime}, ${readableDate(confirmation.slot.scheduledDate)}. Confirma solo si ya la tomaste.` : 'Esto cambia los avisos de la app. No cambia tu tratamiento.'}` : ''} confirmTitle={confirmation?.slot ? 'Sí, ya la tomé' : 'Sí, cambiar recordatorios'} onConfirm={() => { void performAction(); }} onCancel={() => setConfirmation(null)} />
  </Screen>;
}
const styles = StyleSheet.create({
  summaryPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  message: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center', marginBottom: 14 },
  cardCopy: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30, letterSpacing: -0.3 },
  dose: { color: colors.accent, marginTop: 2 },
  schedule: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  time: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: '#3A5F7A' },
  timeText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  notes: { marginTop: 12 },
  state: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18, padding: 14, borderRadius: 16 },
  paused: { backgroundColor: colors.warningSoft },
  done: { backgroundColor: colors.primarySoft },
  pending: { marginTop: 18, padding: 16, paddingBottom: 8, backgroundColor: colors.warningSoft, borderRadius: 16, borderWidth: 1, borderColor: '#6A5B39' },
  pendingHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  followHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  followValue: { fontFamily: fonts.bold, color: colors.primary },
  footnote: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8 }
});
