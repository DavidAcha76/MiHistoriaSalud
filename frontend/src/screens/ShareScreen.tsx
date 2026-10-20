import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, EmptyState, Field, Grid, IconBadge, Muted, Pill, PrimaryButton, Screen, SectionTitle, SecondaryButton, type PressState } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { ClinicalDocument, HealthEvent, PagedEvents } from '../types/domain';
import { openAuthorizedDocument } from '../utils/documentDownload';
import { colors } from '../theme/colors';
import { eventTypeLabel, readableDate } from '../utils/presentation';

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
    <AppTitle eyebrow="Tú decides qué compartir" title="Compartir para consulta" subtitle="Elige exactamente qué información compartir. El enlace vence y puede revocarse en cualquier momento." />
    <ProfileSelector />
    <SectionTitle>1. Datos del enlace</SectionTitle>
    <Grid min={300}>
      <Field label="Título del paquete" icon="format-title" value={title} onChangeText={setTitle} />
      <Field label="Vigencia en días (1 a 30)" icon="calendar-clock-outline" value={days} onChangeText={setDays} keyboardType="number-pad" />
    </Grid>
    <SectionTitle>2. Qué incluir</SectionTitle>
    <CheckCard checked={includeSummary} title="Incluir resumen estructurado para consulta" subtitle="Incluye alergias, medicamentos, diagnósticos declarados, antecedentes, vacunas y laboratorios registrados." onPress={() => setIncludeSummary((value) => !value)} />
    <SectionTitle right={<Pill label={`${eventIds.length} de ${events.length}`} tone="accent" />}>Eventos seleccionados</SectionTitle>
    <Grid min={340} gap={12}>{events.map((event) => <CheckCard key={event.id} checked={eventIds.includes(event.id)} title={event.title} subtitle={`${readableDate(event.eventDate || event.event_date)} · ${eventTypeLabel(event.eventType || event.event_type)}`} onPress={() => toggle(event.id, eventIds, setEventIds)} />)}</Grid>
    {!events.length ? <EmptyState icon="clipboard-text-outline" text="No hay eventos aún." /> : null}
    <SectionTitle right={<Pill label={`${documentIds.length} de ${documents.length}`} tone="accent" />}>Documentos seleccionados</SectionTitle>
    <Grid min={340} gap={12}>{documents.map((document) => <CheckCard key={document.id} checked={documentIds.includes(document.id)} title={document.originalName || document.original_name || 'Documento'} subtitle={document.mimeType || document.mime_type || ''} onPress={() => toggle(document.id, documentIds, setDocumentIds)} />)}</Grid>
    {!documents.length ? <EmptyState icon="file-document-outline" text="No hay documentos aún." /> : null}
    <SectionTitle>3. Crear y compartir</SectionTitle>
    <PrimaryButton title="Crear enlace temporal" icon="link-variant-plus" onPress={createPackage} loading={busy} />
    {shareUrl ? <Card tone="hero"><View style={styles.linkHeading}><MaterialCommunityIcons name="link-variant" size={22} color={colors.primary} /><Text style={{ color: colors.primary, fontWeight: '900', flex: 1 }}>Enlace para el consultor</Text></View><Field label="Comparte este enlace" value={shareUrl} editable={false} selectTextOnFocus /></Card> : null}
    <SecondaryButton title="Descargar una copia de mis datos" icon="download-outline" onPress={exportData} />
    <SectionTitle>Enlaces creados</SectionTitle>
    <Grid min={340}>{packages.map((item) => <Card key={item.id}>
      <View style={styles.packageHeading}><IconBadge icon={item.revokedAt ? 'link-variant-off' : 'link-variant'} tone={item.revokedAt ? 'neutral' : 'primary'} size={44} /><View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{item.title}</Text><Muted>{item.revokedAt ? 'Revocado' : `Vence: ${new Date(item.expiresAt).toLocaleString()}`}{item.lastAccessedAt ? ` · abierto: ${new Date(item.lastAccessedAt).toLocaleString()}` : ''}</Muted></View></View>
      {!item.revokedAt ? <SecondaryButton title="Revocar enlace" icon="link-variant-off" danger onPress={() => revoke(item.id)} /> : null}
    </Card>)}</Grid>
    {!packages.length ? <EmptyState icon="link-variant" text="No hay enlaces creados." /> : null}
  </Screen>;
}

function CheckCard({ checked, title, subtitle, onPress }: { checked: boolean; title: string; subtitle: string; onPress: () => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={title} accessibilityState={{ checked }} aria-checked={checked} onPress={onPress} style={(state) => [styles.check, checked && styles.checked, (state as PressState).hovered && !checked && styles.checkHovered]}>
    <MaterialCommunityIcons name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'} size={28} color={checked ? colors.primary : colors.muted} />
    <View style={{ flex: 1, minWidth: 0 }}><Text style={{ color: colors.text, fontWeight: '800' }}>{title}</Text>{subtitle ? <Muted>{subtitle}</Muted> : null}</View>
  </Pressable>;
}

const styles = StyleSheet.create({
  check: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface },
  checked: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  checkHovered: { borderColor: colors.border, backgroundColor: colors.surfaceHover },
  linkHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  packageHeading: { flexDirection: 'row', alignItems: 'center', gap: 14 }
});
