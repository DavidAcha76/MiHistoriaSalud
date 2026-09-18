import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';

type TimeFieldProps = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };
type NativeTimeInputProps = {
  type: 'time'; value: string; disabled?: boolean; 'aria-label': string;
  onChange: (event: { currentTarget: { value: string } }) => void;
  style: Record<string, string | number>; ref?: React.Ref<HTMLInputElement>;
};
type TimeInputElement = HTMLInputElement & { showPicker?: () => void };
const NativeTimeInput = 'input' as unknown as React.ComponentType<NativeTimeInputProps>;

export function TimeField({ label, value, onChange, disabled }: TimeFieldProps) {
  const inputRef = React.useRef<TimeInputElement | null>(null);
  const openPicker = () => {
    const input = inputRef.current;
    if (!input || disabled) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); return; } catch { /* El clic es el respaldo para otros navegadores. */ }
    }
    input.click();
  };
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      <NativeTimeInput ref={inputRef} type="time" value={value} disabled={disabled} aria-label={label} onChange={(event) => onChange(event.currentTarget.value)} style={styles.input as unknown as Record<string, string | number>} />
      <button type="button" aria-label={`Abrir selector de hora para ${label.toLowerCase()}`} title="Elegir hora" disabled={disabled} onClick={openPicker} style={styles.openButton as React.CSSProperties}>
        <MaterialCommunityIcons name="clock-outline" size={21} color={colors.primary} />
      </button>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontSize: 17, fontFamily: fonts.semibold, color: colors.text, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 56, backgroundColor: colors.surfaceRaised, color: colors.text, border: `1px solid ${colors.inputBorder}`, borderRadius: 12, padding: '0 12px', fontFamily: fonts.regular, fontSize: 18, colorScheme: 'dark' } as unknown as Record<string, string | number>,
  openButton: { width: 52, minHeight: 56, border: `1px solid ${colors.primary}`, borderRadius: 12, background: colors.primarySoft, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as unknown as Record<string, string | number>
});
