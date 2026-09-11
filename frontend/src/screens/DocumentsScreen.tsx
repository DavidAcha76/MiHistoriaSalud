import React, { useCallback, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Muted, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { ClinicalDocument } from '../types/domain';
import { colors } from '../theme/colors';
import { openAuthorizedDocument } from '../utils/documentDownload';

const size = (n = 0) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'documento';

export function DocumentsScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles();
  const [docs, setDocs] = useState<ClinicalDocument[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!selectedProfile) return;
    apiRequest<ClinicalDocument[]>(`/profiles/${selectedProfile.id}/documents`)
      .then(setDocs)
      .catch((e: any) => Alert.alert('Error', e.message));
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
    <AppTitle title="Documentos clínicos" subtitle="PDF e imágenes almacenados de forma privada y asociados al perfil." />
    <ProfileSelector />
    <PrimaryButton title="+ Subir documento" onPress={() => navigation.navigate('DocumentUpload')} />
    {docs.map(d => <Card key={d.id}>
      <Text style={{ fontWeight: '800', color: colors.text }}>{d.originalName || d.original_name}</Text>
      <Muted>{d.mimeType || d.mime_type} · {size(d.sizeBytes || d.size_bytes)}</Muted>
      {d.eventId || d.event_id ? <Muted>Vinculado a un evento del historial.</Muted> : null}
      <View style={{ gap: 8, marginTop: 8 }}>
        <PrimaryButton title={busyId === d.id ? 'Procesando…' : Platform.OS === 'web' ? 'Abrir / descargar' : 'Abrir / compartir'} disabled={busyId === d.id} onPress={() => openDocument(d)} />
        <SecondaryButton title="Eliminar" disabled={busyId === d.id} onPress={() => deleteDocument(d)} />
      </View>
    </Card>)}
    {!docs.length ? <Card><Muted>No hay documentos cargados.</Muted></Card> : null}
  </Screen>;
}
