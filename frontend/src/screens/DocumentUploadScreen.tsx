import { useFeedback } from '../context/FeedbackContext';
import React, { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import * as DocumentPicker from 'expo-document-picker';
import { apiRequest } from '../api/client';
import { AppTitle, Card, IconBadge, Muted, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { useProfiles } from '../context/ProfileContext';
import { colors, fonts } from '../theme/colors';
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
    <View style={styles.drop}>
      <IconBadge icon={file ? 'file-check-outline' : 'cloud-upload-outline'} tone={file ? 'primary' : 'accent'} size={60} />
      {file ? <View style={styles.fileCopy}>
        <Text style={styles.fileName}>{file.name}</Text>
        <Muted>{file.mimeType || 'Tipo desconocido'} · {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Tamaño no informado'}</Muted>
      </View> : <View style={styles.fileCopy}><Text style={styles.fileName}>PDF, JPG, PNG o WEBP</Text><Muted>Aún no seleccionaste un archivo.</Muted></View>}
      <View style={{ width: '100%' }}>{file ? <SecondaryButton title="1. Seleccionar archivo" icon="paperclip" onPress={pick} /> : <PrimaryButton title="1. Seleccionar archivo" icon="paperclip" onPress={pick} />}</View>
    </View>
    {eventId ? <Card tone="primary" style={styles.linked}><MaterialCommunityIcons name="link-variant" size={22} color={colors.primary} /><Muted style={{ flex: 1 }}>Este documento quedará vinculado al evento desde el que abriste esta pantalla.</Muted></Card> : null}
    <PrimaryButton title="2. Guardar documento" icon="content-save-outline" onPress={upload} loading={loading} disabled={!file || !selectedProfile} />
    <View style={styles.privacy}><MaterialCommunityIcons name="shield-lock-outline" size={20} color={colors.muted} /><Muted style={{ flex: 1 }}>Tus archivos se guardan en almacenamiento privado. Solo tú decides si los compartes.</Muted></View>
  </Screen>;
}

const styles = StyleSheet.create({
  drop: { alignItems: 'center', gap: 14, padding: 24, marginBottom: 16, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'rgba(20, 42, 53, 0.6)' },
  fileCopy: { alignItems: 'center', gap: 2, maxWidth: '100%' },
  fileName: { fontFamily: fonts.bold, color: colors.text, textAlign: 'center' },
  linked: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  privacy: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8 }
});
