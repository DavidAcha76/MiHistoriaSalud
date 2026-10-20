import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, EmptyState, FormError, Grid, IconBadge, LoadingState, Muted, Pill, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { useLayout } from '../hooks/useLayout';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { ClinicalDocument } from '../types/domain';
import { colors } from '../theme/colors';
import { openAuthorizedDocument } from '../utils/documentDownload';

const size = (n = 0) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'documento';

export function DocumentsScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles();
  const { twoColumns } = useLayout();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docs, setDocs] = useState<ClinicalDocument[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!selectedProfile) { setDocs([]); setLoading(false); return; }
    setLoading(true); setError(''); setDocs([]);
    apiRequest<ClinicalDocument[]>(`/profiles/${selectedProfile.id}/documents`)
      .then(setDocs)
      .catch(() => setError('No pudimos cargar tus documentos. Revisa tu conexión y vuelve a intentar.')).finally(() => setLoading(false));
  }, [selectedProfile?.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDocument = async (doc: ClinicalDocument) => {
    if (!selectedProfile) return;
    setBusyId(doc.id);
    try {
      const name = safeName(doc.originalName || doc.original_name || `documento-${doc.id}`);
      const path = `/profiles/${selectedProfile.id}/documents/${doc.id}/download`;
      await openAuthorizedDocument(path, name, doc.mimeType || doc.mime_type || undefined);
    } catch (e: any) {
      Alert.alert('Documento', e.message || 'No se pudo abrir el documento.');
    } finally {
      setBusyId(null);
    }
  };

  const deleteDocument = (doc: ClinicalDocument) => {
    if (!selectedProfile) return;
    const performDelete = async () => {
      setBusyId(doc.id);
      try {
        await apiRequest(`/profiles/${selectedProfile.id}/documents/${doc.id}`, { method: 'DELETE' });
        load();
      } catch (e: any) {
        Alert.alert('Error', e.message);
      } finally {
        setBusyId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('El archivo se eliminará del almacenamiento privado y no podrá recuperarse.')) void performDelete();
      return;
    }

    Alert.alert('Eliminar documento', 'El archivo se eliminará del almacenamiento privado y no podrá recuperarse.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: performDelete }
    ]);
  };

  return <Screen>
    <AppTitle eyebrow="Archivos de salud" title="Mis documentos" subtitle="Guarda y encuentra tus recetas, resultados de exámenes y otros archivos de salud." />
    <ProfileSelector />
    <View style={twoColumns ? styles.uploadWide : undefined}><PrimaryButton title="+ Subir documento" onPress={() => navigation.navigate('DocumentUpload')} disabled={!selectedProfile} /></View>
    <FormError message={error} />
    {error ? <SecondaryButton title="Volver a intentar" icon="refresh" onPress={load} /> : null}
    {loading ? <LoadingState label="Buscando tus documentos…" /> : null}
    <Grid min={380}>{docs.map(d => {
      const mime = d.mimeType || d.mime_type || '';
      const pdf = mime.includes('pdf');
      return <Card key={d.id}>
        <View style={styles.heading}>
          <IconBadge icon={pdf ? 'file-pdf-box' : mime.startsWith('image/') ? 'file-image-outline' : 'file-document-outline'} tone={pdf ? 'warning' : 'accent'} size={50} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{d.originalName || d.original_name}</Text>
            <Muted>{mime} · {size(d.sizeBytes || d.size_bytes)}</Muted>
          </View>
        </View>
        {d.eventId || d.event_id ? <Pill label="Vinculado a un evento del historial." icon="link-variant" tone="accent" /> : null}
        <View style={styles.actions}>
          <View style={styles.action}><PrimaryButton title={busyId === d.id ? 'Procesando…' : Platform.OS === 'web' ? 'Abrir / descargar' : 'Abrir / compartir'} icon={Platform.OS === 'web' ? 'download-outline' : 'share-variant-outline'} disabled={busyId === d.id} onPress={() => openDocument(d)} /></View>
          <View style={styles.action}><SecondaryButton title="Eliminar documento" icon="trash-can-outline" danger disabled={busyId === d.id} onPress={() => deleteDocument(d)} /></View>
        </View>
      </Card>;
    })}</Grid>
    {!loading && !error && selectedProfile && !docs.length ? <EmptyState icon="file-upload-outline" tone="accent" text="Aún no guardaste documentos. Usa «Subir documento» para añadir una receta o un resultado." /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  uploadWide: { alignSelf: 'flex-start', minWidth: 280, marginBottom: 8 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  name: { fontWeight: '800', color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, marginTop: 6 },
  action: { flexGrow: 1, flexBasis: 200 }
});
