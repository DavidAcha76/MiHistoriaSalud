import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { EmptyState, FormError, IconBadge, LoadingState, type PressState } from './ui';
import type { ClinicalDocument } from '../types/domain';
import { colors, fonts, shadows } from '../theme/colors';
import { shadow } from '../theme/effects';

/** RF-18: elige un documento ya guardado del perfil para vincularlo con un registro. */
export function DocumentPickerModal({ visible, profileId, eventId, onClose, onSelect }: { visible: boolean; profileId: string; eventId: string; onClose: () => void; onSelect: (document: ClinicalDocument) => void }) {
  const [documents, setDocuments] = useState<ClinicalDocument[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setDocuments(null); setError('');
    apiRequest<ClinicalDocument[]>(`/profiles/${profileId}/documents`)
      .then((value) => { if (active) setDocuments(value.filter((item) => (item.eventId || item.event_id) !== eventId)); })
      .catch(() => { if (active) { setDocuments([]); setError('No pudimos cargar los documentos.'); } });
    return () => { active = false; };
  }, [visible, profileId, eventId]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar selector de documentos" style={StyleSheet.absoluteFill} onPress={onClose} />
      <View accessibilityViewIsModal style={styles.sheet}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.title}>Vincular un documento</Text><Text style={styles.hint}>Elige una receta, resultado u otro archivo ya guardado. Si estaba vinculado a otro registro, se moverá a este.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={styles.close}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <FormError message={error} />
          {documents === null ? <LoadingState label="Buscando documentos…" /> : documents.map((document) => {
            const mime = document.mimeType || document.mime_type || '';
            return <Pressable key={document.id} accessibilityRole="button" accessibilityLabel={`Vincular ${document.originalName || document.original_name}`} onPress={() => onSelect(document)} style={(state) => [styles.option, (state as PressState).hovered && styles.optionHovered]}>
              <IconBadge icon={mime.includes('pdf') ? 'file-pdf-box' : 'file-image-outline'} tone={mime.includes('pdf') ? 'warning' : 'accent'} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.optionTitle}>{document.originalName || document.original_name}</Text><Text style={styles.optionMeta}>{document.eventTitle ? `Vinculado a: ${document.eventTitle}` : 'Sin registro vinculado'}</Text></View>
              <MaterialCommunityIcons name="link-variant-plus" size={22} color={colors.primary} />
            </Pressable>;
          })}
          {documents && !documents.length && !error ? <EmptyState icon="file-document-outline" text="No hay otros documentos guardados en este perfil." /> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(4, 10, 14, 0.78)' },
  sheet: { width: '100%', maxWidth: 640, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: 26, overflow: 'hidden', ...shadow(shadows.raised) },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, paddingBottom: 8 },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 21, lineHeight: 28 },
  hint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, marginTop: 4 },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  body: { padding: 20, paddingTop: 8 },
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 10, borderRadius: 18, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface },
  optionHovered: { borderColor: colors.primary, backgroundColor: colors.surfaceHover },
  optionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, lineHeight: 25 },
  optionMeta: { color: colors.muted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 }
});
