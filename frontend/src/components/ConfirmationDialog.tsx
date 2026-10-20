import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconBadge, PrimaryButton, SecondaryButton } from './ui';
import { useLayout } from '../hooks/useLayout';
import { colors, fonts, shadows } from '../theme/colors';
import { shadow } from '../theme/effects';

export function ConfirmationDialog({ visible, title, message, confirmTitle, onConfirm, onCancel }: { visible: boolean; title: string; message: string; confirmTitle: string; onConfirm: () => void; onCancel: () => void }) {
  const { width, largeText } = useLayout();
  const sideBySide = width >= 600 && !largeText;
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <View accessibilityViewIsModal style={styles.dialog}>
        <ScrollView>
          <IconBadge icon="help-circle-outline" size={52} />
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={sideBySide ? styles.actionsRow : undefined}>
            <View style={sideBySide ? styles.action : undefined}><PrimaryButton title={confirmTitle} onPress={onConfirm} /></View>
            <View style={sideBySide ? styles.action : undefined}><SecondaryButton title="Cancelar y volver" onPress={onCancel} /></View>
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(4, 10, 14, 0.78)' },
  dialog: { width: '100%', maxWidth: 560, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 26, padding: 24, ...shadow(shadows.raised) },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 24, lineHeight: 33, letterSpacing: -0.4, marginTop: 18, marginBottom: 12 },
  message: { color: colors.text, fontFamily: fonts.regular, fontSize: 18, lineHeight: 28, marginBottom: 18 },
  actionsRow: { flexDirection: 'row-reverse', gap: 12 },
  action: { flex: 1 }
});
