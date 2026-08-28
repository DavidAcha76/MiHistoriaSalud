import React, { useState } from 'react';
import { Alert, Platform, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Muted, PrimaryButton, Screen } from '../components/ui';
import { useProfiles } from '../context/ProfileContext';
import { colors } from '../theme/colors';

export function DocumentUploadScreen({ route, navigation }: any) {
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
      Alert.alert('Documento guardado', 'El archivo fue almacenado de forma privada.');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('No se pudo subir', e.message);
    } finally {
      setLoading(false);
    }
  }

  return <Screen>
    <AppTitle title="Subir documento" subtitle="Se aceptan PDF, JPG, PNG y WEBP desde Android, iOS o navegador web." />
    <PrimaryButton title="Seleccionar archivo" onPress={pick} />
    {file ? <Card>
      <Text style={{ fontWeight: '800', color: colors.text }}>{file.name}</Text>
      <Muted>{file.mimeType || 'Tipo desconocido'} · {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Tamaño no informado'}</Muted>
    </Card> : <Card><Muted>Aún no seleccionaste un archivo.</Muted></Card>}
    {eventId ? <Card><Muted>Este documento quedará vinculado al evento desde el que abriste esta pantalla.</Muted></Card> : null}
    <PrimaryButton title="Guardar documento" onPress={upload} loading={loading} disabled={!file} />
  </Screen>;
}
