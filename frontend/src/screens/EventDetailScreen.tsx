import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Muted, PrimaryButton, Screen, SectionTitle, SecondaryButton, Disclosure, FormError } from '../components/ui';
import { useProfiles } from '../context/ProfileContext';
import type { HealthEvent } from '../types/domain';
import { colors } from '../theme/colors';
import { detailLabels, detailValue, eventTypeLabel, readableDate } from '../utils/presentation';

type Version = { versionNumber: number; action: string; createdAt: string };

export function EventDetailScreen({ route, navigation }: any) {
  const { selectedProfile } = useProfiles();
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
  if (error) return <Screen><FormError message={error} /><SecondaryButton title="Volver a intentar" onPress={load} /></Screen>;
  if (!event) return <Screen><Muted>Cargando evento…</Muted></Screen>;
  const date = event.eventDate || event.event_date;
  const type = event.eventType || event.event_type;
  const details = event.details || {};
  return <Screen>
    <AppTitle title={event.title} subtitle={`${readableDate(date)} · ${eventTypeLabel(type)}`} />
    <Card>{event.description ? <Text style={{ color: colors.text, lineHeight: 25 }}>{event.description}</Text> : <Muted>Sin descripción.</Muted>}{event.source ? <Text style={{ marginTop: 10, color: colors.muted }}>Fuente: {event.source}</Text> : null}{event.notes ? <Text style={{ marginTop: 10, color: colors.muted }}>Notas: {event.notes}</Text> : null}</Card>
    <SectionTitle>Detalles del registro</SectionTitle>
    <Card>{Object.entries(details).filter(([key, value]) => Boolean(detailLabels[key]) && value != null && value !== '').map(([key, value]) => <View key={key} style={{ marginBottom: 9 }}><Text style={{ fontSize: 16, fontWeight: '800', color: colors.muted }}>{detailLabels[key]}</Text><Text style={{ color: colors.text }}>{detailValue(key, value)}</Text></View>)}{!Object.keys(details).length ? <Muted>Este tipo no tiene campos adicionales.</Muted> : null}</Card>
    <Disclosure title="Ver historial de cambios">
    <Card>{versions.length ? versions.map((version) => <View key={`${version.versionNumber}-${version.createdAt}`} style={{ marginBottom: 8 }}><Text style={{ fontWeight: '800', color: colors.text }}>Versión {version.versionNumber} · {({ CREATE: 'Creado', UPDATE: 'Actualizado', DELETE: 'Eliminado' } as Record<string, string>)[version.action] || 'Cambio guardado'}</Text><Muted>{new Date(version.createdAt).toLocaleString()}</Muted></View>) : <Muted>No hay historial disponible.</Muted>}</Card>
    </Disclosure>
    <SectionTitle>Documentos vinculados</SectionTitle>
    <Card>{event.documents?.length ? event.documents.map((document) => <Text key={document.id} style={{ color: colors.text, marginBottom: 5 }}>• {document.originalName || document.original_name}</Text>) : <Muted>No hay documentos vinculados.</Muted>}</Card>
    <SecondaryButton title="Editar registro" onPress={() => navigation.navigate('EventForm', { eventId })} />
    <SecondaryButton title="Añadir documento a este registro" onPress={() => navigation.navigate('DocumentUpload', { eventId })} />
    <SecondaryButton title="Eliminar registro" danger onPress={remove} />
  </Screen>;
}
