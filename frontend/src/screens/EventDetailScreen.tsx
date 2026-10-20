import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Disclosure, FormError, Grid, IconBadge, LoadingState, Muted, Pill, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { RecordPickerModal } from '../components/RecordPickerModal';
import { DocumentPickerModal } from '../components/DocumentPickerModal';
import { useFeedback } from '../context/FeedbackContext';
import { useProfiles } from '../context/ProfileContext';
import type { HealthEvent } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { detailLabels, detailValue, eventIcon, eventTone, eventTypeLabel, readableDate } from '../utils/presentation';

type Version = { versionNumber: number; action: string; createdAt: string };

export function EventDetailScreen({ route, navigation }: any) {
  const { selectedProfile, canEdit } = useProfiles();
  const notify = useFeedback();
  const [picking, setPicking] = useState<'record' | 'document' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [event, setEvent] = useState<HealthEvent | null>(null);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState<Version[]>([]);
  const { eventId } = route.params;
  const load = useCallback(() => {
    if (!selectedProfile) return;
    setError('');
    Promise.all([
      apiRequest<HealthEvent>(`/profiles/${selectedProfile.id}/events/${eventId}`),
      apiRequest<Version[]>(`/profiles/${selectedProfile.id}/events/${eventId}/versions`)
    ]).then(([current, history]) => { setEvent(current); setVersions(history); }).catch(() => setError('No pudimos abrir el registro. Revisa tu conexión e inténtalo de nuevo.'));
  }, [selectedProfile?.id, eventId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function remove() {
    if (!selectedProfile) return;
    Alert.alert('Eliminar evento', 'Esta acción elimina el evento estructurado. Los documentos asociados se conservarán sin vínculo al evento.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await apiRequest(`/profiles/${selectedProfile.id}/events/${eventId}`, { method: 'DELETE' }); navigation.goBack(); } catch (error: any) { Alert.alert('Error', error.message); } } }
    ]);
  }
  // RF-18: vínculos entre registros y con documentos ya guardados del mismo perfil.
  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true); setActionError('');
    try { await action(); notify(success); load(); }
    catch (e: any) { setActionError(e.message || 'No pudimos guardar el cambio.'); }
    finally { setBusy(false); }
  }
  const base = selectedProfile ? `/profiles/${selectedProfile.id}` : '';
  const linkRecord = (linkedEventId: string) => run(() => apiRequest(`${base}/events/${eventId}/links`, { method: 'POST', body: JSON.stringify({ linkedEventId }) }), 'Registros vinculados.');
  const unlinkRecord = (linkedEventId: string) => run(() => apiRequest(`${base}/events/${eventId}/links/${linkedEventId}`, { method: 'DELETE' }), 'Vínculo eliminado.');
  const linkDocument = (documentId: string, target: string | null) => run(() => apiRequest(`${base}/documents/${documentId}`, { method: 'PATCH', body: JSON.stringify({ eventId: target }) }), target ? 'Documento vinculado a este registro.' : 'Documento desvinculado.');
  if (error) return <Screen><FormError message={error} /><SecondaryButton title="Volver a intentar" icon="refresh" onPress={load} /></Screen>;
  if (!event) return <Screen><LoadingState label="Cargando evento…" /></Screen>;
  const date = event.eventDate || event.event_date;
  const type = event.eventType || event.event_type;
  const details = event.details || {};
  const linked = event.linkedEvents || [];
  const filledDetails = Object.entries(details).filter(([key, value]) => Boolean(detailLabels[key]) && value != null && value !== '');
  return <Screen>
    <View style={styles.typeRow}><Pill label={eventTypeLabel(type)} icon={eventIcon(type)} tone={eventTone(type)} /></View>
    <AppTitle title={event.title} subtitle={`${readableDate(date)} · ${eventTypeLabel(type)}`} />
    <Card>
      {event.description ? <Text style={{ color: colors.text, lineHeight: 27 }}>{event.description}</Text> : <Muted>Sin descripción.</Muted>}
      {event.source ? <View style={styles.meta}><MaterialCommunityIcons name="hospital-building" size={20} color={colors.muted} /><Text style={styles.metaText}>Fuente: {event.source}</Text></View> : null}
      {event.notes ? <View style={styles.meta}><MaterialCommunityIcons name="note-text-outline" size={20} color={colors.muted} /><Text style={styles.metaText}>Notas: {event.notes}</Text></View> : null}
    </Card>
    <SectionTitle>Detalles del registro</SectionTitle>
    <Card>
      {filledDetails.length ? <Grid min={240} gap={12}>{filledDetails.map(([key, value]) => <View key={key} style={styles.detail}><Text style={styles.detailLabel}>{detailLabels[key]}</Text><Text style={{ color: colors.text }}>{detailValue(key, value)}</Text></View>)}</Grid> : null}
      {!Object.keys(details).length ? <Muted>Este tipo no tiene campos adicionales.</Muted> : null}
    </Card>
    <Disclosure title="Ver historial de cambios">
    <Card>{versions.length ? versions.map((version) => <View key={`${version.versionNumber}-${version.createdAt}`} style={styles.version}><View style={styles.versionDot} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>Versión {version.versionNumber} · {({ CREATE: 'Creado', UPDATE: 'Actualizado', DELETE: 'Eliminado' } as Record<string, string>)[version.action] || 'Cambio guardado'}</Text><Muted>{new Date(version.createdAt).toLocaleString()}</Muted></View></View>) : <Muted>No hay historial disponible.</Muted>}</Card>
    </Disclosure>
    <SectionTitle>Registros vinculados</SectionTitle>
    <Card>
      {linked.length ? linked.map((item) => <View key={item.id} style={styles.linkRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${item.title}`} onPress={() => navigation.push('EventDetail', { eventId: item.id })} style={styles.linkOpen}>
          <IconBadge icon={eventIcon(item.eventType)} tone={eventTone(item.eventType)} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontFamily: fonts.bold }}>{item.title}</Text><Muted>{readableDate(item.eventDate)} · {eventTypeLabel(item.eventType)}</Muted></View>
        </Pressable>
        {canEdit ? <Pressable accessibilityRole="button" accessibilityLabel={`Quitar el vínculo con ${item.title}`} onPress={() => { void unlinkRecord(item.id); }} disabled={busy} style={styles.unlink}><MaterialCommunityIcons name="link-variant-off" size={22} color={colors.danger} /></Pressable> : null}
      </View>) : <Muted>Puedes relacionar este registro con otros, por ejemplo un resultado de laboratorio con la consulta en la que se pidió.</Muted>}
      {canEdit ? <SecondaryButton title="Vincular un registro" icon="link-variant-plus" onPress={() => setPicking('record')} disabled={busy} /> : null}
    </Card>
    <SectionTitle>Documentos vinculados</SectionTitle>
    <Card>
      {event.documents?.length ? event.documents.map((document) => <View key={document.id} style={styles.linkRow}>
        <View style={styles.document}><MaterialCommunityIcons name="file-document-outline" size={22} color={colors.accent} /><Text style={{ color: colors.text, flex: 1 }}>{document.originalName || document.original_name}</Text></View>
        {canEdit ? <Pressable accessibilityRole="button" accessibilityLabel={`Desvincular ${document.originalName || document.original_name}`} onPress={() => { void linkDocument(document.id, null); }} disabled={busy} style={styles.unlink}><MaterialCommunityIcons name="link-variant-off" size={22} color={colors.danger} /></Pressable> : null}
      </View>) : <Muted>No hay documentos vinculados.</Muted>}
      {canEdit ? <SecondaryButton title="Vincular un documento guardado" icon="paperclip" onPress={() => setPicking('document')} disabled={busy} /> : null}
    </Card>
    <FormError message={actionError} />
    {canEdit ? <Grid min={260} gap={12}>
      <SecondaryButton title="Editar registro" icon="pencil-outline" onPress={() => navigation.navigate('EventForm', { eventId })} />
      <SecondaryButton title="Añadir documento a este registro" icon="file-upload-outline" onPress={() => navigation.navigate('DocumentUpload', { eventId })} />
      <SecondaryButton title="Eliminar registro" icon="trash-can-outline" danger onPress={remove} />
    </Grid> : <Muted>Tu permiso sobre este perfil es solo de consulta.</Muted>}
    {selectedProfile ? <>
      <RecordPickerModal visible={picking === 'record'} profileId={selectedProfile.id} title="Vincular un registro" hint={`Elige el registro que quieres relacionar con «${event.title}».`} excludeIds={[eventId, ...linked.map((item) => item.id)]} onClose={() => setPicking(null)} onSelect={(record) => { setPicking(null); void linkRecord(record.id); }} />
      <DocumentPickerModal visible={picking === 'document'} profileId={selectedProfile.id} eventId={eventId} onClose={() => setPicking(null)} onSelect={(document) => { setPicking(null); void linkDocument(document.id, eventId); }} />
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  typeRow: { marginBottom: 14 },
  meta: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  metaText: { flex: 1, color: colors.muted },
  detail: { padding: 14, marginBottom: 12, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderSoft },
  detailLabel: { fontSize: 15, lineHeight: 22, fontFamily: fonts.bold, color: colors.muted, marginBottom: 2 },
  version: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  versionDot: { width: 10, height: 10, borderRadius: 5, marginTop: 9, backgroundColor: colors.primary },
  document: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  linkOpen: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  unlink: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.borderSoft }
});
