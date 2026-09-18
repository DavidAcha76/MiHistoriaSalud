import React, { useId, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';

export function Screen({ children, scroll = true, form = false }: { children: React.ReactNode; scroll?: boolean; form?: boolean }) {
  const { width } = useWindowDimensions();
  const contentStyle = [styles.screen, width >= 768 && styles.screenWide, form && styles.formScreen];
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      {scroll ? <ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView> : <View style={[...contentStyle, styles.screenFlex]}>{children}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function AppTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  const { width } = useWindowDimensions();
  return <View style={styles.titleBlock}>{children ? <View style={styles.titleContent}>{children}</View> : null}<Text accessibilityRole="header" style={[styles.title, width < 400 && styles.titleCompact]}>{title}</Text>{subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}</View>;
}

export function Field({ label, error, hint, multiline, style, secureTextEntry, ...props }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const id = useId();
  return <View style={styles.field}>
    <Text nativeID={`${id}-label`} style={styles.label}>{label}</Text>
    {hint ? <Text nativeID={`${id}-hint`} style={styles.fieldHint}>{hint}</Text> : null}
    <View style={[styles.inputFrame, focused && styles.inputFocused, Boolean(error) && styles.inputError]}>
      <TextInput {...props} accessibilityLabel={props.accessibilityLabel || label} accessibilityHint={error || hint || props.accessibilityHint} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} secureTextEntry={secureTextEntry && !showPassword} multiline={multiline} placeholderTextColor={colors.muted} selectionColor={colors.primary} onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, multiline && styles.multilineInput, style]} />
    </View>
    {secureTextEntry ? <Pressable accessibilityRole="button" accessibilityLabel={`${showPassword ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} accessibilityState={{ expanded: showPassword }} onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}><MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.primary} /><Text style={styles.linkText}>{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</Text></Pressable> : null}
    {error ? <Text nativeID={`${id}-error`} accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

type ButtonProps = { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; danger?: boolean };
export function PrimaryButton({ title, onPress, disabled, loading, danger = false }: ButtonProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, danger && styles.dangerButton, pressed && styles.buttonPressed, (disabled || loading) && styles.buttonInactive]}>{loading ? <ActivityIndicator color={colors.background} /> : null}<Text style={styles.buttonText}>{loading ? 'Un momento…' : title}</Text></Pressable>;
}
export function SecondaryButton({ title, onPress, disabled, loading, danger = false }: ButtonProps) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }} onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.secondaryButton, danger && { borderColor: colors.danger }, pressed && styles.buttonPressed, (disabled || loading) && styles.buttonInactive]}>{loading ? <ActivityIndicator color={colors.primary} /> : null}<Text style={[styles.secondaryText, danger && { color: colors.danger }]}>{loading ? 'Un momento…' : title}</Text></Pressable>;
}
export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.formError}><MaterialCommunityIcons name="alert-circle-outline" size={24} color={colors.danger} /><Text style={styles.formErrorText}>{message}</Text></View>;
}
export function LoadingState({ label = 'Cargando tu información…' }: { label?: string }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.loading}><ActivityIndicator color={colors.primary} /><Muted>{label}</Muted></View>;
}
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) { return <View style={[styles.card, style]}>{children}</View>; }
export function SectionTitle({ children }: { children: React.ReactNode }) { return <Text accessibilityRole="header" style={styles.sectionTitle}>{children}</Text>; }
export function Muted({ children }: { children: React.ReactNode }) { return <Text style={styles.muted}>{children}</Text>; }
export function Disclosure({ title, children, initialOpen = false }: { title: string; children: React.ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return <View style={styles.disclosure}><Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.disclosureButton}><Text style={[styles.secondaryText, { flex: 1, textAlign: 'left' }]}>{title}</Text><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={26} color={colors.primary} /></Pressable>{open ? <View style={{ paddingTop: 16 }}>{children}</View> : null}</View>;
}
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole={onPress ? 'button' : 'text'} accessibilityState={onPress ? { selected: Boolean(selected) } : undefined} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.buttonPressed]}>{selected ? <MaterialCommunityIcons name="check" size={19} color={colors.background} /> : null}<Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export function MenuTile({ icon, label, hint, onPress, badge, tone = 'primary' }: { icon: IconName; label: string; hint: string; onPress: () => void; badge?: number; tone?: 'primary' | 'accent' | 'ai' | 'warning' }) {
  const { width, fontScale } = useWindowDimensions();
  const palette = { primary: { background: colors.primarySoft, color: colors.primary }, accent: { background: colors.accentSoft, color: colors.accent }, ai: { background: colors.aiSoft, color: colors.ai }, warning: { background: colors.warningSoft, color: colors.warning }, }[tone];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${hint}${badge ? `. ${badge} avisos` : ''}`} onPress={onPress} style={({ pressed }) => [styles.menuTile, width >= 650 && fontScale < 1.4 && styles.menuTileWide, pressed && styles.buttonPressed]}>
    <View style={[styles.menuIcon, { backgroundColor: palette.background }]}><MaterialCommunityIcons name={icon} size={28} color={palette.color} /></View>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuHint}>{hint}</Text></View>
    <MaterialCommunityIcons name="chevron-right" size={24} color={colors.muted} />
  </Pressable>;
}
export function MenuGrid({ children }: { children: React.ReactNode }) { return <View style={styles.menuGrid}>{children}</View>; }

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  screen: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 40, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  screenWide: { paddingHorizontal: 36, paddingTop: 36, paddingBottom: 56 },
  formScreen: { maxWidth: 760 },
  screenFlex: { flex: 1 },
  titleBlock: { marginBottom: 24 },
  titleContent: { marginBottom: 20 },
  title: { fontSize: 32, lineHeight: 42, fontFamily: fonts.bold, color: colors.text },
  titleCompact: { fontSize: 28, lineHeight: 38 },
  subtitle: { marginTop: 8, maxWidth: 680, color: colors.muted, lineHeight: 27, fontFamily: fonts.regular, fontSize: 17 },
  field: { marginBottom: 22 },
  label: { fontSize: 17, lineHeight: 25, fontFamily: fonts.semibold, color: colors.text, marginBottom: 8 },
  fieldHint: { fontSize: 16, lineHeight: 24, color: colors.muted, fontFamily: fonts.regular, marginBottom: 10 },
  inputFrame: { backgroundColor: colors.surfaceRaised, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 14 },
  inputFocused: { borderColor: colors.primary },
  inputError: { borderColor: colors.danger },
  input: { minHeight: 56, minWidth: 0, width: '100%', paddingHorizontal: 16, paddingVertical: 14, fontFamily: fonts.regular, fontSize: 18, lineHeight: 26, color: colors.text, borderRadius: 12 },
  multilineInput: { minHeight: 120, textAlignVertical: 'top' },
  passwordToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8 },
  linkText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary, flexShrink: 1 },
  error: { marginTop: 8, color: colors.danger, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 },
  button: { backgroundColor: colors.primary, minHeight: 58, borderRadius: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 16, marginVertical: 8 },
  dangerButton: { backgroundColor: colors.danger },
  buttonText: { color: colors.background, fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, textAlign: 'center', flexShrink: 1 },
  secondaryButton: { borderWidth: 1, borderColor: colors.inputBorder, minHeight: 56, borderRadius: 14, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 14, marginVertical: 8, backgroundColor: colors.surface },
  secondaryText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 17, lineHeight: 25, textAlign: 'center', flexShrink: 1 },
  buttonPressed: { opacity: .8 },
  buttonInactive: { opacity: .6 },
  formError: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 16, marginBottom: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  formErrorText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 17, lineHeight: 26 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 22, lineHeight: 31, fontFamily: fonts.bold, color: colors.text, marginTop: 20, marginBottom: 14 },
  muted: { color: colors.muted, lineHeight: 25, fontFamily: fonts.regular, fontSize: 16 },
  chip: { minHeight: 48, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, marginRight: 8, marginBottom: 8 },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 16, lineHeight: 24, fontFamily: fonts.semibold, flexShrink: 1 },
  chipTextSelected: { color: colors.background },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
  menuTile: { width: '100%', minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18 },
  menuTileWide: { width: '48.5%', flexGrow: 1, minHeight: 132 },
  menuIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: colors.text, fontSize: 20, lineHeight: 28, fontFamily: fonts.bold },
  menuHint: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 4, fontFamily: fonts.regular },
  disclosure: { marginVertical: 10 },
  disclosureButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 14, backgroundColor: colors.surface },
  loading: { paddingVertical: 28, alignItems: 'center', gap: 12 }
});
