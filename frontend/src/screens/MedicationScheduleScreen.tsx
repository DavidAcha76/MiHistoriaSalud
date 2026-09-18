import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Disclosure, FormError, LoadingState, Muted, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../components/ui';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { MedicationRegimen, MedicationDoseSlot } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { localDate, readableDate } from '../utils/presentation';

const dayLabels = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
type Confirmation = { regimen: MedicationRegimen; slot?: MedicationDoseSlot };
export function MedicationScheduleScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles();
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

  return <Screen>
    <AppTitle title="Mis medicamentos" subtitle="Consulta tus horarios y marca una toma solo después de haberla tomado." />
    <ProfileSelector />
    <SectionTitle>Hoy · {readableDate(localDate())}</SectionTitle>
    {message ? <Card style={{ backgroundColor: colors.primarySoft }}><Text accessibilityLiveRegion="polite" style={{ color: colors.success }}>✓ {message}</Text></Card> : null}
    <FormError message={error} />
    {error ? <SecondaryButton title="Volver a cargar medicamentos" onPress={() => { setLoading(true); void load(); }} /> : null}
    {loading ? <LoadingState label="Buscando tus horarios…" /> : items.map((regimen) => <Card key={regimen.id}>
      <View style={styles.cardHeader}><MaterialCommunityIcons name="pill" size={28} color={colors.primary} /><View style={{ flex: 1 }}><Text style={styles.name}>{regimen.medicationName}</Text>{regimen.dose ? <Text style={styles.dose}>{regimen.dose}</Text> : null}</View></View>
      <Muted>{regimen.scheduleDays.length === 7 ? 'Todos los días' : regimen.scheduleDays.map((day) => dayLabels[day]).join(' · ')} · {regimen.scheduleTimes.join(' / ')}</Muted>
      {regimen.notes ? <Text style={{ marginTop: 10 }}>{regimen.notes}</Text> : null}
      {!regimen.isActive ? <Text style={{ color: colors.warning, marginTop: 14 }}>Recordatorios pausados</Text> : regimen.adherence.pending.length ? <View style={styles.pending}>
        <Text style={{ fontFamily: fonts.bold, marginBottom: 8 }}>Tomas de hoy sin confirmar</Text>
        {regimen.adherence.pending.map((slot) => <PrimaryButton key={`${slot.scheduledDate}-${slot.scheduledTime}`} title={`Ya tomé la de las ${slot.scheduledTime}`} disabled={Boolean(busyKey) || Boolean(error)} loading={busyKey === regimen.id} onPress={() => setConfirmation({ regimen, slot })} />)}
      </View> : <View style={styles.done}><MaterialCommunityIcons name="check-circle-outline" size={24} color={colors.success} /><Text style={{ flex: 1 }}>Por ahora no hay tomas pendientes de confirmar.</Text></View>}
      <Disclosure title="Ver seguimiento y recordatorios">
        <Text style={{ fontFamily: fonts.bold }}>Últimos 30 días</Text><Muted>{regimen.adherence.confirmed} tomas confirmadas de {regimen.adherence.total} esperadas. Este conteo no evalúa tu salud.</Muted>
        <SecondaryButton title={regimen.isActive ? 'Pausar recordatorios' : 'Reanudar recordatorios'} onPress={() => setConfirmation({ regimen })} disabled={Boolean(busyKey) || Boolean(error)} />
      </Disclosure>
    </Card>)}
    {!loading && !error && selectedProfile && !items.length ? <Card><MaterialCommunityIcons name="pill" size={34} color={colors.primary} /><Text style={styles.emptyTitle}>Añade tu primer medicamento</Text><Muted>Guarda el nombre y el horario indicado por tu profesional. Luego podrás anotar cada toma aquí.</Muted></Card> : null}
    <PrimaryButton title="+ Añadir un medicamento" onPress={() => navigation.navigate('MedicationForm')} disabled={!selectedProfile || Boolean(busyKey)} />
    <Muted>Los recordatorios se consultan dentro de la app. Sigue siempre la pauta indicada por tu profesional.</Muted>
    <ConfirmationDialog visible={Boolean(confirmation)} title={confirmation?.slot ? '¿Ya tomaste este medicamento?' : confirmation?.regimen.isActive ? '¿Pausar los recordatorios?' : '¿Reanudar los recordatorios?'} message={confirmation ? `${confirmation.regimen.medicationName}${confirmation.regimen.dose ? ` · ${confirmation.regimen.dose}` : ''}\n${confirmation.slot ? `Toma de las ${confirmation.slot.scheduledTime}, ${readableDate(confirmation.slot.scheduledDate)}. Confirma solo si ya la tomaste.` : 'Esto cambia los avisos de la app. No cambia tu tratamiento.'}` : ''} confirmTitle={confirmation?.slot ? 'Sí, ya la tomé' : 'Sí, cambiar recordatorios'} onConfirm={() => { void performAction(); }} onCancel={() => setConfirmation(null)} />
  </Screen>;
}
const styles = StyleSheet.create({
  cardHeader: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12 },
  name: { fontFamily: fonts.bold, fontSize: 23, lineHeight: 33 },
  dose: { color: colors.accent, marginTop: 4 },
  pending: { marginTop: 20, padding: 16, backgroundColor: colors.primarySoft, borderRadius: 14 },
  done: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, padding: 14, backgroundColor: colors.primarySoft, borderRadius: 14 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 32, marginVertical: 14 }
});
