import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getAccessToken, getApiUrl } from '../api/client';

export async function openAuthorizedDocument(path: string, name: string, mimeType?: string): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error('Sesión no disponible. Vuelve a iniciar sesión.');
  if (!FileSystem.cacheDirectory) throw new Error('No se encontró un directorio temporal disponible.');
  const destination = `${FileSystem.cacheDirectory}${Date.now()}-${name}`;
  const result = await FileSystem.downloadAsync(
    `${getApiUrl()}${path}`,
    destination,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`No se pudo descargar el documento (HTTP ${result.status}).`);
  }
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('No hay una aplicación disponible para abrir o compartir este archivo.');
  }
  await Sharing.shareAsync(result.uri, { mimeType, dialogTitle: 'Abrir documento clínico' });
}
