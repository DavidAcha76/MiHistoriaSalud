import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';

export function passwordRules(password: string, confirmPassword: string): Array<[string, boolean]> {
  return [
    ['Al menos 8 caracteres', password.length >= 8],
    ['Una letra mayúscula', /[A-Z]/.test(password)],
    ['Una letra minúscula', /[a-z]/.test(password)],
    ['Un número', /\d/.test(password)],
    ['Las dos contraseñas coinciden', Boolean(password) && password === confirmPassword]
  ];
}

export function PasswordRules({ password, confirmPassword }: { password: string; confirmPassword: string }) {
  return <View accessibilityLabel="Requisitos de la contraseña" style={styles.rules}>
    {passwordRules(password, confirmPassword).map(([label, met]) => <View key={label} accessibilityLabel={`${label}: ${met ? 'cumplido' : 'pendiente'}`} style={styles.rule}>
      <MaterialCommunityIcons name={met ? 'check-circle' : 'circle-outline'} size={20} color={met ? colors.success : colors.muted} />
      <Text style={[styles.ruleText, met && { color: colors.text }]}>{label}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  rules: { gap: 8, padding: 14, marginTop: -6, marginBottom: 18, borderRadius: 16, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.borderSoft },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ruleText: { flex: 1, color: colors.muted, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 }
});
