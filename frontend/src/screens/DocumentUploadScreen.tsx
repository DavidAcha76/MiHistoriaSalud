import { useFeedback } from '../context/FeedbackContext';
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import * as DocumentPicker from 'expo-document-picker';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Muted, PrimaryButton, Screen } from '../components/ui';
import { useProfiles } from '../context/ProfileContext';
import { colors } from '../theme/colors';
import { ProfileSelector } from '../components/ProfileSelector';

export function DocumentUploadScreen({ route, navigation }: any) {
  const notify = useFeedback();
  const { selectedProfile } = useProfiles();
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const eventId = route.params?.eventId as string | undefined;

  async function pick() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
      copyToCacheDirectory: true,
      multiple: false
    });
    if (!result.canceled) setFile(result.assets[0]);
  }

  async function upload() {
    if (!selectedProfile || !file) return;
    setLoading(true);
    try {
      const form = new FormData();
      const webFile = (file as any).file as File | undefined;
      if (Platform.OS === 'web' && webFile) {
        form.append('file', webFile, file.name);
      } else {
        form.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' } as any);
      }
      if (eventId) form.append('eventId', eventId);
      await apiRequest(`/profiles/${selectedProfile.id}/documents`, { method: 'POST', body: form });
      notify('Documento guardado.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('No se pudo subir', e.message);
    } finally {
      setLoading(false);
    }
  }

  return <Screen form>
    <AppTitle title="Subir documento" subtitle="Elige una foto o un archivo PDF de tu receta o resultado. Después toca Guardar documento." />
    <ProfileSelector locked />
    <PrimaryButton title="1. Seleccionar archivo" onPress={pick} />
    {file ? <Card>
      <Text style={{ fontWeight: '800', color: colors.text }}>{file.name}</Text>
      <Muted>{file.mimeType || 'Tipo desconocido'} · {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Tamaño no informado'}</Muted>
    </Card> : <Card><Muted>Aún no seleccionaste un archivo.</Muted></Card>}
    {eventId ? <Card><Muted>Este documento quedará vinculado al evento desde el que abriste esta pantalla.</Muted></Card> : null}
    <PrimaryButton title="2. Guardar documento" onPress={upload} loading={loading} disabled={!file || !selectedProfile} />
  </Screen>;
}
