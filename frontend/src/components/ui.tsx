import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  return <SafeAreaView style={styles.safe}>{scroll ? <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">{children}</ScrollView> : <View style={styles.screenFlex}>{children}</View>}</SafeAreaView>;
}

export function AppTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return <View style={{ marginBottom: 18 }}><Text style={styles.title}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}

export function Field({ label, error, multiline, ...props }: TextInputProps & { label: string; error?: string }) {
  return <View style={{ marginBottom: 12 }}><Text style={styles.label}>{label}</Text><TextInput {...props} multiline={multiline} placeholderTextColor="#94A3B8" style={[styles.input, multiline && { minHeight: 92, textAlignVertical: 'top' }]} />{error ? <Text style={styles.error}>{error}</Text> : null}</View>;
}

export function PrimaryButton({ title, onPress, disabled, loading, danger = false }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, danger && styles.dangerButton, (pressed || disabled) && { opacity: .7 }]}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}</Pressable>;
}

export function SecondaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: .7 }]}><Text style={styles.secondaryText}>{title}</Text></Pressable>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) { return <View style={[styles.card, style]}>{children}</View>; }
export function SectionTitle({ children }: { children: React.ReactNode }) { return <Text style={styles.sectionTitle}>{children}</Text>; }
export function Muted({ children }: { children: React.ReactNode }) { return <Text style={styles.muted}>{children}</Text>; }

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable onPress={onPress} disabled={!onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { padding: 18, paddingBottom: 40, width: '100%', maxWidth: 980, alignSelf: 'center' },
  screenFlex: { flex: 1, padding: 18, width: '100%', maxWidth: 980, alignSelf: 'center' },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -.5 },
  subtitle: { marginTop: 5, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.text },
  error: { marginTop: 5, color: colors.danger, fontSize: 12 },
  button: { backgroundColor: colors.primary, minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginVertical: 6 },
  dangerButton: { backgroundColor: colors.danger },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: { borderWidth: 1, borderColor: colors.primary, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, marginVertical: 6 },
  secondaryText: { color: colors.primary, fontWeight: '800' },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 15, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 8, marginBottom: 10 },
  muted: { color: colors.muted, lineHeight: 20 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EDF2F5', borderRadius: 999, marginRight: 8, marginBottom: 8 },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  chipTextSelected: { color: '#fff' }
});
