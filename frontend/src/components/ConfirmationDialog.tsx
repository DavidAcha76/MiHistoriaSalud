import React from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { PrimaryButton, SecondaryButton } from './ui';
import { colors, fonts } from '../theme/colors';

export function ConfirmationDialog({ visible, title, message, confirmTitle, onConfirm, onCancel }: { visible: boolean; title: string; message: string; confirmTitle: string; onConfirm: () => void; onCancel: () => void }) {
  return <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
    <View style={{ flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0, 0, 0, .72)' }}>
      <View accessibilityViewIsModal style={{ width: '100%', maxWidth: 520, maxHeight: '90%', alignSelf: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 22, padding: 24 }}>
        <ScrollView><Text accessibilityRole="header" style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 24, lineHeight: 34, marginBottom: 14 }}>{title}</Text><Text style={{ color: colors.text, fontFamily: fonts.regular, fontSize: 18, lineHeight: 28, marginBottom: 20 }}>{message}</Text><PrimaryButton title={confirmTitle} onPress={onConfirm} /><SecondaryButton title="Cancelar y volver" onPress={onCancel} /></ScrollView>
      </View>
    </View>
  </Modal>;
}
