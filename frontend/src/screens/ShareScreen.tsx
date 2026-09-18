import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Field, Muted, PrimaryButton, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { ClinicalDocument, HealthEvent, PagedEvents } from '../types/domain';
import { openAuthorizedDocument } from '../utils/documentDownload';
import { colors } from '../theme/colors';

type SharedPackage = { id: string; title: string; expiresAt: string; revokedAt?: string | null; lastAccessedAt?: string | null };

export function ShareScreen() {
  const { selectedProfile } = useProfiles();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [documents, setDocuments] = useState<ClinicalDocument[]>([]);
  const [packages, setPackages] = useState<SharedPackage[]>([]);
  const [eventIds, setEventIds] = useState<string[]>([]);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [title, setTitle] = useState('Información para consulta');
  const [days, setDays] = useState('7');
  const [shareUrl, setShareUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!selectedProfile) return;
    Promise.all([
      apiRequest<PagedEvents>(`/profiles/${selectedProfile.id}/events?pageSize=50`),
      apiRequest<ClinicalDocument[]>(`/profiles/${selectedProfile.id}/documents`),
      apiRequest<SharedPackage[]>(`/profiles/${selectedProfile.id}/share-packages`)
    ]).then(([eventData, documentData, packageData]) => { setEvents(eventData.items); setDocuments(documentData); setPackages(packageData); }).catch((error: any) => Alert.alert('Compartir', error.message));
  }, [selectedProfile?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const toggle = (id: string, selected: string[], setSelected: (next: string[]) => void) => setSelected(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);

  async function createPackage() {
    if (!selectedProfile) return;
    setBusy(true);
    try {
      const response = await apiRequest<{ shareUrl: string }>(`/profiles/${selectedProfile.id}/share-packages`, {
        method: 'POST', body: JSON.stringify({ title, eventIds, documentIds, includeSummary, expiresInDays: Number(days) || 7 })
      });
      setShareUrl(response.shareUrl); load();
      Alert.alert('Enlace creado', 'El enlace es temporal y puedes revocarlo desde esta pantalla.');
    } catch (error: any) { Alert.alert('No se pudo crear el paquete', error.message); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!selectedProfile) return;
    try { await apiRequest(`/profiles/${selectedProfile.id}/share-packages/${id}/revoke`, { method: 'POST' }); load(); } catch (error: any) { Alert.alert('No se pudo revocar', error.message); }
  }
  async function exportData() {
    if (!selectedProfile) return;
    try { await openAuthorizedDocument(`/profiles/${selectedProfile.id}/data-export`, `mihistoria-${selectedProfile.id}.json`, 'application/json'); } catch (error: any) { Alert.alert('Exportación', error.message); }
  }

  return <Screen>
    <AppTitle title="Compartir para consulta" subtitle="Elige exactamente qué información compartir. El enlace vence y puede revocarse en cualquier momento." />
    <ProfileSelector />
    <Field label="Título del paquete" value={title} onChangeText={setTitle} />
    <Field label="Vigencia en días (1 a 30)" value={days} onChangeText={setDays} keyboardType="number-pad" />
    <Pressable onPress={() => setIncludeSummary((value) => !value)}><Card style={{ borderColor: includeSummary ? colors.primary : colors.border }}><Text style={{ color: colors.text, fontWeight: '800' }}>{includeSummary ? '☑' : '☐'} Incluir resumen estructurado para consulta</Text><Muted>Incluye alergias, medicamentos, diagnósticos declarados, antecedentes, vacunas y laboratorios registrados.</Muted></Card></Pressable>
    <SectionTitle>Eventos seleccionados</SectionTitle>
    {events.map((event) => { const selected = eventIds.includes(event.id); return <Pressable key={event.id} onPress={() => toggle(event.id, eventIds, setEventIds)}><Card style={{ borderColor: selected ? colors.primary : colors.border }}><Text style={{ color: colors.text, fontWeight: '800' }}>{selected ? '☑' : '☐'} {event.title}</Text><Muted>{event.eventDate || event.event_date} · {event.eventType || event.event_type}</Muted></Card></Pressable>; })}
    {!events.length ? <Card><Muted>No hay eventos aún.</Muted></Card> : null}
    <SectionTitle>Documentos seleccionados</SectionTitle>
    {documents.map((document) => { const selected = documentIds.includes(document.id); return <Pressable key={document.id} onPress={() => toggle(document.id, documentIds, setDocumentIds)}><Card style={{ borderColor: selected ? colors.primary : colors.border }}><Text style={{ color: colors.text, fontWeight: '800' }}>{selected ? '☑' : '☐'} {document.originalName || document.original_name}</Text><Muted>{document.mimeType || document.mime_type}</Muted></Card></Pressable>; })}
    <PrimaryButton title="Crear enlace temporal" onPress={createPackage} loading={busy} />
    {shareUrl ? <Card style={{ backgroundColor: colors.primarySoft }}><Text style={{ color: colors.primary, fontWeight: '900' }}>Enlace para el consultor</Text><Field label="Comparte este enlace" value={shareUrl} editable={false} selectTextOnFocus /></Card> : null}
    <SecondaryButton title="Descargar una copia de mis datos" onPress={exportData} />
    <SectionTitle>Enlaces creados</SectionTitle>
    {packages.map((item) => <Card key={item.id}><Text style={{ color: colors.text, fontWeight: '800' }}>{item.title}</Text><Muted>{item.revokedAt ? 'Revocado' : `Vence: ${new Date(item.expiresAt).toLocaleString()}`}{item.lastAccessedAt ? ` · abierto: ${new Date(item.lastAccessedAt).toLocaleString()}` : ''}</Muted>{!item.revokedAt ? <SecondaryButton title="Revocar enlace" onPress={() => revoke(item.id)} /> : null}</Card>)}
    {!packages.length ? <Card><Muted>No hay enlaces creados.</Muted></Card> : null}
  </Screen>;
}
