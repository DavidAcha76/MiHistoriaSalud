import React, { createContext, useContext, useId, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type PressableStateCallbackType, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts, gradients, shadows } from '../theme/colors';
import { gradient, shadow } from '../theme/effects';
import { useLayout } from '../hooks/useLayout';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export type Tone = 'primary' | 'accent' | 'ai' | 'warning' | 'danger' | 'neutral';
/** react-native-web añade `hovered` al estado de Pressable; en móvil siempre es falso. */
export type PressState = PressableStateCallbackType & { hovered?: boolean };

export const tones: Record<Tone, { color: string; soft: string; tile?: ViewStyle }> = {
  primary: { color: colors.primary, soft: colors.primarySoft, tile: gradient(gradients.primaryTile) },
  accent: { color: colors.accent, soft: colors.accentSoft, tile: gradient(gradients.accentTile) },
  ai: { color: colors.ai, soft: colors.aiSoft, tile: gradient(gradients.aiTile) },
  warning: { color: colors.warning, soft: colors.warningSoft, tile: gradient(gradients.warningTile) },
  danger: { color: colors.danger, soft: colors.dangerSoft },
  neutral: { color: colors.muted, soft: colors.surfaceRaised }
};

/** Los títulos con «+ » muestran un icono, pero conservan el texto completo como nombre accesible. */
function buttonContent(title: string, icon?: IconName): [string, IconName | undefined] {
  return title.startsWith('+ ') ? [title.slice(2), icon || 'plus'] : [title, icon];
}

export function Screen({ children, scroll = true, form = false }: { children: React.ReactNode; scroll?: boolean; form?: boolean }) {
  const { width } = useLayout(form);
  const contentStyle = [styles.screen, width >= 768 && styles.screenWide, form && styles.formScreen];
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <View aria-hidden style={styles.ambient} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      {scroll ? <ScrollView style={styles.flex} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">{children}</ScrollView> : <View style={[...contentStyle, styles.screenFlex]}>{children}</View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function AppTitle({ title, subtitle, eyebrow, children }: { title: string; subtitle?: string; eyebrow?: string; children?: React.ReactNode }) {
  const { width } = useLayout();
  return <View style={styles.titleBlock}>
    {children ? <View style={styles.titleContent}>{children}</View> : null}
    {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
    <Text accessibilityRole="header" style={[styles.title, width >= 768 && styles.titleWide, width < 400 && styles.titleCompact]}>{title}</Text>
    {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
  </View>;
}

/** Marca los campos para que en web el foco se muestre en el marco y no como un segundo contorno. */
const fieldDataSet = { dataSet: { cliniaField: 'true' } } as object;

export function Field({ label, error, hint, icon, multiline, style, secureTextEntry, ...props }: TextInputProps & { label: string; error?: string; hint?: string; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const id = useId();
  return <View style={styles.field}>
    <Text nativeID={`${id}-label`} style={styles.label}>{label}</Text>
    {hint ? <Text nativeID={`${id}-hint`} style={styles.fieldHint}>{hint}</Text> : null}
    <View style={[styles.inputFrame, multiline && styles.inputFrameMultiline, props.editable === false && styles.inputReadOnly, focused && styles.inputFocused, Boolean(error) && styles.inputError]}>
      {icon ? <MaterialCommunityIcons name={icon} size={22} color={focused ? colors.primary : colors.muted} style={[styles.inputIcon, multiline && styles.inputIconMultiline]} /> : null}
      <TextInput {...props} {...fieldDataSet} accessibilityLabel={props.accessibilityLabel || label} accessibilityHint={error || hint || props.accessibilityHint} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined} secureTextEntry={secureTextEntry && !showPassword} multiline={multiline} placeholderTextColor={colors.muted} selectionColor={colors.primary} onFocus={(event) => { setFocused(true); props.onFocus?.(event); }} onBlur={(event) => { setFocused(false); props.onBlur?.(event); }} style={[styles.input, Boolean(icon) && styles.inputWithIcon, multiline && styles.multilineInput, style]} />
    </View>
    {secureTextEntry ? <Pressable accessibilityRole="button" accessibilityLabel={`${showPassword ? 'Ocultar' : 'Mostrar'} ${label.toLowerCase()}`} accessibilityState={{ expanded: showPassword }} onPress={() => setShowPassword(!showPassword)} style={styles.passwordToggle}><MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.primary} /><Text style={styles.linkText}>{showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}</Text></Pressable> : null}
    {error ? <View style={styles.errorRow}><MaterialCommunityIcons name="alert-circle-outline" size={20} color={colors.danger} /><Text nativeID={`${id}-error`} accessibilityRole="alert" style={styles.error}>{error}</Text></View> : null}
  </View>;
}

type ButtonProps = { title: string; onPress: () => void; disabled?: boolean; loading?: boolean; danger?: boolean; icon?: IconName };
export function PrimaryButton({ title, onPress, disabled, loading, danger = false, icon }: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  const [text, glyph] = buttonContent(title, icon);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: inactive, busy: Boolean(loading) }} onPress={onPress} disabled={inactive} style={(state) => {
    const { pressed, hovered } = state as PressState;
    return [styles.button, danger && styles.dangerButton, !inactive && !danger && styles.buttonShadow, !inactive && hovered && styles.buttonHovered, pressed && styles.buttonPressed, inactive && styles.buttonInactive];
  }}>
    {loading ? <ActivityIndicator color={colors.background} /> : null}
    <Text style={styles.buttonText}>{!loading && glyph ? <InlineIcon name={glyph} color={colors.background} /> : null}{loading ? 'Un momento…' : text}</Text>
  </Pressable>;
}
/** Icono dentro del texto: si el título ocupa dos líneas, sigue centrado junto a la primera palabra. */
function InlineIcon({ name, color }: { name: IconName; color: string }) {
  return <><MaterialCommunityIcons name={name} size={21} color={color} style={styles.inlineIcon} />{'  '}</>;
}
export function SecondaryButton({ title, onPress, disabled, loading, danger = false, icon }: ButtonProps) {
  const inactive = Boolean(disabled || loading);
  const [text, glyph] = buttonContent(title, icon);
  const color = danger ? colors.danger : colors.primary;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: inactive, busy: Boolean(loading) }} onPress={onPress} disabled={inactive} style={(state) => {
    const { pressed, hovered } = state as PressState;
    return [styles.secondaryButton, danger && styles.secondaryDanger, !inactive && hovered && (danger ? styles.secondaryDangerHovered : styles.secondaryHovered), pressed && styles.buttonPressed, inactive && styles.buttonInactive];
  }}>
    {loading ? <ActivityIndicator color={color} /> : null}
    <Text style={[styles.secondaryText, danger && { color: colors.danger }]}>{!loading && glyph ? <InlineIcon name={glyph} color={color} /> : null}{loading ? 'Un momento…' : text}</Text>
  </Pressable>;
}
export function FormError({ message }: { message: string }) {
  if (!message) return null;
  return <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={styles.formError}><MaterialCommunityIcons name="alert-circle-outline" size={24} color={colors.danger} /><Text style={styles.formErrorText}>{message}</Text></View>;
}
export function LoadingState({ label = 'Cargando tu información…' }: { label?: string }) {
  return <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.loading}><View style={styles.loadingSpinner}><ActivityIndicator color={colors.primary} /></View><Muted>{label}</Muted></View>;
}

type CardTone = 'primary' | 'hero' | 'ai' | 'warning' | 'danger';
export function Card({ children, style, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; tone?: CardTone }) {
  return <View style={[styles.card, tone && cardTones[tone], style]}>{children}</View>;
}
export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  if (!right) return <Text accessibilityRole="header" style={styles.sectionTitle}>{children}</Text>;
  return <View style={styles.sectionRow}><Text accessibilityRole="header" style={[styles.sectionTitle, styles.sectionTitleInline]}>{children}</Text>{right}</View>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) { return <Text style={[styles.muted, style]}>{children}</Text>; }
export function Disclosure({ title, children, initialOpen = false }: { title: string; children: React.ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const { compact } = useLayout();
  return <View style={[styles.disclosure, open && styles.disclosureOpen]}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }} aria-expanded={open} onPress={() => setOpen(!open)} style={(state) => [styles.disclosureButton, open && styles.disclosureButtonOpen, (state as PressState).hovered && styles.disclosureHovered]}>
      <Text style={styles.disclosureText}>{title}</Text>
      <View style={styles.disclosureChevron}><MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={colors.primary} /></View>
    </Pressable>
    {open ? <View style={[styles.disclosureBody, compact && styles.disclosureBodyCompact]}>{children}</View> : null}
  </View>;
}
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return <Pressable accessibilityLabel={label} accessibilityRole={onPress ? 'button' : 'text'} accessibilityState={onPress ? { selected: Boolean(selected) } : undefined} onPress={onPress} disabled={!onPress} style={(state) => {
    const { pressed, hovered } = state as PressState;
    return [styles.chip, hovered && !selected && styles.chipHovered, selected && styles.chipSelected, pressed && styles.buttonPressed];
  }}>{selected ? <MaterialCommunityIcons name="check" size={19} color={colors.background} /> : null}<Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}

export function IconBadge({ icon, tone = 'primary', size = 52 }: { icon: IconName; tone?: Tone; size?: number }) {
  const palette = tones[tone];
  return <View style={[styles.iconBadge, { width: size, height: size, borderRadius: Math.round(size * 0.32), backgroundColor: palette.soft }, palette.tile]}>
    <MaterialCommunityIcons name={icon} size={Math.round(size * 0.5)} color={palette.color} />
  </View>;
}
export function Pill({ label, tone = 'primary', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const palette = tones[tone];
  return <View style={[styles.pill, { backgroundColor: palette.soft, borderColor: `${palette.color}55` }]}>
    {icon ? <MaterialCommunityIcons name={icon} size={16} color={palette.color} /> : null}
    <Text style={[styles.pillText, { color: palette.color }]}>{label}</Text>
  </View>;
}
export function EmptyState({ icon, title, text, tone = 'primary', children }: { icon: IconName; title?: string; text?: string; tone?: Tone; children?: React.ReactNode }) {
  return <View style={styles.empty}>
    <IconBadge icon={icon} tone={tone} size={56} />
    <View style={styles.emptyCopy}>
      {title ? <Text style={styles.emptyTitle}>{title}</Text> : null}
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
    {children ? <View style={{ width: '100%' }}>{children}</View> : null}
  </View>;
}
export function ProgressBar({ value, tone = 'primary', label }: { value: number; tone?: Tone; label: string }) {
  const ratio = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }} style={styles.progressTrack}>
    <View style={[styles.progressFill, { width: `${ratio * 100}%`, backgroundColor: tones[tone].color }]} />
  </View>;
}
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
  return <View aria-hidden style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
    <Text style={[styles.avatarText, { fontSize: Math.round(size * 0.38) }]}>{initials}</Text>
  </View>;
}
export function Stat({ icon, value, label, tone = 'primary' }: { icon: IconName; value: string; label: string; tone?: Tone }) {
  return <View style={styles.stat}>
    <IconBadge icon={icon} tone={tone} size={46} />
    <View style={styles.statCopy}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>
  </View>;
}

/** Columnas que caben con un ancho mínimo por elemento; con texto grande siempre es una. */
export function useGridColumns(min = 300, gap = 16) {
  const { contentWidth, largeText } = useLayout();
  return largeText ? 1 : Math.max(1, Math.min(4, Math.floor((contentWidth + gap) / (min + gap))));
}
/** Cuadrícula responsive: calcula columnas según el ancho útil y vuelve a una columna con texto grande. */
export function Grid({ children, min = 300, gap = 16, columns }: { children: React.ReactNode; min?: number; gap?: number; columns?: number }) {
  const fitting = useGridColumns(min, gap);
  const items = React.Children.toArray(children);
  const count = Math.min(columns ?? fitting, items.length);
  if (count <= 1) return <>{items}</>;
  return <View style={[styles.grid, { marginHorizontal: -gap / 2 }]}>
    {items.map((child, index) => <View key={(child as React.ReactElement).key ?? index} style={[styles.gridItem, { width: `${100 / count}%`, paddingHorizontal: gap / 2 }]}>{child}</View>)}
  </View>;
}
/** Dos (o más) columnas en escritorio; en pantallas estrechas el contenido se apila en orden. */
export function Columns({ children, weights = [1, 1], gap = 28, minWidth = 900 }: { children: React.ReactNode; weights?: number[]; gap?: number; minWidth?: number }) {
  const { contentWidth, largeText } = useLayout();
  const items = React.Children.toArray(children);
  if (largeText || contentWidth < minWidth) return <>{items}</>;
  return <View style={[styles.columns, { gap }]}>
    {items.map((child, index) => <View key={(child as React.ReactElement).key ?? index} style={{ flex: weights[index] ?? 1, minWidth: 0 }}>{child}</View>)}
  </View>;
}

const MenuColumns = createContext<1 | 2>(2);
export function MenuTile({ icon, label, hint, onPress, badge, tone = 'primary' }: { icon: IconName; label: string; hint: string; onPress: () => void; badge?: number; tone?: 'primary' | 'accent' | 'ai' | 'warning' }) {
  const { width, largeText } = useLayout();
  const columns = useContext(MenuColumns);
  const palette = tones[tone];
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${hint}${badge ? `. ${badge} avisos` : ''}`} onPress={onPress} style={(state) => {
    const { pressed, hovered } = state as PressState;
    return [styles.menuTile, columns === 2 && width >= 650 && !largeText && styles.menuTileWide, hovered && styles.menuTileHovered, pressed && styles.buttonPressed];
  }}>
    {(state) => {
      const hovered = Boolean((state as PressState).hovered);
      return <>
        <IconBadge icon={icon} tone={tone} size={56} />
        <View style={styles.menuCopy}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuHint}>{hint}</Text></View>
        {badge ? <View style={styles.countBadge}><Text style={styles.countText}>{badge}</Text></View> : null}
        <View style={[styles.menuArrow, hovered && { backgroundColor: palette.soft, borderColor: `${palette.color}66` }]}><MaterialCommunityIcons name="arrow-right" size={20} color={hovered ? palette.color : colors.muted} /></View>
      </>;
    }}
  </Pressable>;
}
export function MenuGrid({ children, columns = 2 }: { children: React.ReactNode; columns?: 1 | 2 }) {
  return <MenuColumns.Provider value={columns}><View style={styles.menuGrid}>{children}</View></MenuColumns.Provider>;
}

const cardTones = StyleSheet.create({
  primary: { backgroundColor: colors.primarySoft, borderColor: '#2E6662' },
  hero: { backgroundColor: colors.primarySoft, borderColor: '#2E6662', ...gradient(gradients.hero) },
  ai: { backgroundColor: colors.aiSoft, borderColor: '#46597D', ...gradient(gradients.ai) },
  warning: { backgroundColor: colors.warningSoft, borderColor: '#6A5B39', ...gradient(gradients.warning) },
  danger: { backgroundColor: colors.dangerSoft, borderColor: '#7A4552' }
});

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 480, pointerEvents: 'none', ...gradient(Platform.OS === 'web' ? gradients.ambient : 'linear-gradient(180deg, rgba(121, 221, 202, 0.08) 0%, rgba(121, 221, 202, 0) 100%)') },
  screen: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 48, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  screenWide: { paddingHorizontal: 36, paddingTop: 40, paddingBottom: 64 },
  formScreen: { maxWidth: 760 },
  screenFlex: { flex: 1 },
  titleBlock: { marginBottom: 24 },
  titleContent: { marginBottom: 20 },
  eyebrow: { color: colors.primary, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  title: { fontSize: 32, lineHeight: 41, fontFamily: fonts.bold, color: colors.text, letterSpacing: -0.6 },
  titleWide: { fontSize: 36, lineHeight: 46, letterSpacing: -0.9 },
  titleCompact: { fontSize: 28, lineHeight: 37 },
  subtitle: { marginTop: 10, maxWidth: 680, color: colors.muted, lineHeight: 27, fontFamily: fonts.regular, fontSize: 17 },
  field: { marginBottom: 22 },
  label: { fontSize: 17, lineHeight: 25, fontFamily: fonts.semibold, color: colors.text, marginBottom: 8 },
  fieldHint: { fontSize: 16, lineHeight: 24, color: colors.muted, fontFamily: fonts.regular, marginBottom: 10 },
  inputFrame: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceRaised, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 16 },
  inputFrameMultiline: { alignItems: 'flex-start' },
  inputReadOnly: { backgroundColor: colors.surface },
  inputFocused: { borderColor: colors.primary, ...shadow(shadows.focus) },
  inputError: { borderColor: colors.danger },
  inputIcon: { marginLeft: 16 },
  inputIconMultiline: { marginTop: 16 },
  input: { flex: 1, minHeight: 56, minWidth: 0, paddingHorizontal: 16, paddingVertical: 14, fontFamily: fonts.regular, fontSize: 18, lineHeight: 26, color: colors.text, borderRadius: 14 },
  inputWithIcon: { paddingLeft: 12 },
  multilineInput: { minHeight: 120, textAlignVertical: 'top' },
  passwordToggle: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 8 },
  linkText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.primary, flexShrink: 1 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 10 },
  error: { flex: 1, color: colors.danger, fontFamily: fonts.medium, fontSize: 16, lineHeight: 24 },
  button: { backgroundColor: colors.primary, ...gradient(gradients.primary), minHeight: 58, borderRadius: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 16, marginVertical: 8 },
  inlineIcon: { verticalAlign: 'middle' },
  buttonShadow: shadow(shadows.primary),
  buttonHovered: { transform: [{ translateY: -1 }] },
  dangerButton: { backgroundColor: colors.danger, ...gradient(gradients.danger) },
  buttonText: { color: colors.background, fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, textAlign: 'center', flexShrink: 1 },
  secondaryButton: { borderWidth: 1, borderColor: colors.inputBorder, minHeight: 56, borderRadius: 16, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 14, marginVertical: 8, backgroundColor: colors.surface },
  secondaryHovered: { borderColor: colors.primary, backgroundColor: colors.surfaceHover },
  secondaryDanger: { borderColor: colors.danger },
  secondaryDangerHovered: { backgroundColor: colors.dangerSoft },
  secondaryText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 17, lineHeight: 25, textAlign: 'center', flexShrink: 1 },
  buttonPressed: { opacity: .82, transform: [{ scale: .99 }] },
  buttonInactive: { opacity: .55 },
  formError: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16, marginBottom: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  formErrorText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 17, lineHeight: 26 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 22, padding: 20, marginBottom: 16, ...shadow(shadows.card) },
  sectionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 28, marginBottom: 14 },
  sectionTitle: { fontSize: 21, lineHeight: 30, fontFamily: fonts.bold, color: colors.text, letterSpacing: -0.3, marginTop: 28, marginBottom: 14 },
  sectionTitleInline: { marginTop: 0, marginBottom: 0, flexShrink: 1 },
  muted: { color: colors.muted, lineHeight: 25, fontFamily: fonts.regular, fontSize: 16 },
  chip: { minHeight: 48, maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 999, marginRight: 8, marginBottom: 8 },
  chipHovered: { borderColor: colors.primary },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 16, lineHeight: 24, fontFamily: fonts.semibold, flexShrink: 1 },
  chipTextSelected: { color: colors.background },
  iconBadge: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(234, 243, 245, 0.07)' },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: 6, minHeight: 30, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 20, flexShrink: 1 },
  empty: { alignItems: 'flex-start', gap: 14, padding: 22, marginBottom: 16, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'rgba(20, 42, 53, 0.6)' },
  emptyCopy: { gap: 6, maxWidth: 620 },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 19, lineHeight: 28 },
  emptyText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 25 },
  progressTrack: { height: 10, borderRadius: 999, backgroundColor: colors.backgroundDeep, overflow: 'hidden', borderWidth: 1, borderColor: colors.borderSoft },
  progressFill: { height: '100%', borderRadius: 999 },
  avatar: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, ...gradient(gradients.avatar) },
  avatarText: { color: colors.background, fontFamily: fonts.bold },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, marginBottom: 16, ...shadow(shadows.card) },
  statCopy: { flex: 1, minWidth: 0 },
  statValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.4 },
  statLabel: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { minWidth: 0 },
  columns: { flexDirection: 'row', alignItems: 'flex-start' },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 8 },
  menuTile: { width: '100%', minHeight: 112, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: 22, padding: 18, ...shadow(shadows.card) },
  menuTileWide: { width: '48.5%', flexGrow: 1, minHeight: 128 },
  menuTileHovered: { borderColor: colors.border, backgroundColor: colors.surfaceHover, transform: [{ translateY: -2 }] },
  menuCopy: { flex: 1, minWidth: 0 },
  menuLabel: { color: colors.text, fontSize: 19, lineHeight: 27, fontFamily: fonts.bold, letterSpacing: -0.2 },
  menuHint: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 3, fontFamily: fonts.regular },
  menuArrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.background },
  countBadge: { minWidth: 28, height: 28, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.danger },
  countText: { color: colors.background, fontFamily: fonts.bold, fontSize: 14 },
  disclosure: { marginVertical: 10, borderRadius: 18, borderWidth: 1, borderColor: 'transparent' },
  disclosureOpen: { borderColor: colors.borderSoft, backgroundColor: 'rgba(20, 42, 53, 0.55)' },
  disclosureButton: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingLeft: 16, paddingRight: 12, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 16, backgroundColor: colors.surface },
  disclosureButtonOpen: { borderColor: colors.primaryDark, backgroundColor: colors.surfaceRaised },
  disclosureHovered: { borderColor: colors.primary },
  disclosureText: { flex: 1, color: colors.primary, fontFamily: fonts.bold, fontSize: 17, lineHeight: 25 },
  disclosureChevron: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  disclosureBody: { paddingTop: 18, paddingHorizontal: 16, paddingBottom: 8 },
  disclosureBodyCompact: { paddingHorizontal: 10 },
  loading: { paddingVertical: 28, alignItems: 'center', gap: 12 },
  loadingSpinner: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft }
});
