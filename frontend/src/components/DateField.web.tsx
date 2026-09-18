import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: string;
  maximumDate?: string;
  clearable?: boolean;
  disabled?: boolean;
};

type NativeDateInputProps = {
  type: 'date';
  value: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  'aria-label': string;
  onChange: (event: { currentTarget: { value: string } }) => void;
  style: Record<string, string | number>;
  ref?: React.Ref<HTMLInputElement>;
};

const NativeDateInput = 'input' as unknown as React.ComponentType<NativeDateInputProps>;
type DateInputElement = HTMLInputElement & { showPicker?: () => void };

export function DateField({ label, value, onChange, minimumDate, maximumDate, clearable = false, disabled }: DateFieldProps) {
  const inputRef = React.useRef<DateInputElement | null>(null);
  const openCalendar = () => {
    const input = inputRef.current;
    if (!input || disabled) return;
    input.focus();
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker();
        return;
      } catch {
        // Algunos navegadores solo permiten abrirlo mediante un clic directo.
      }
    }
    input.click();
  };

  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      <NativeDateInput
        ref={inputRef}
        type="date"
        value={value}
        min={minimumDate}
        max={maximumDate}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(event.currentTarget.value)}
        style={styles.input as unknown as Record<string, string | number>}
      />
      <button type="button" aria-label={`Abrir calendario para ${label.toLowerCase()}`} title="Abrir calendario" disabled={disabled} onClick={openCalendar} style={styles.calendarButton as React.CSSProperties}>
        <MaterialCommunityIcons name="calendar-month-outline" size={21} color={colors.primary} />
      </button>
      {clearable && value ? <button type="button" aria-label={`Quitar ${label.toLowerCase()}`} onClick={() => onChange('')} style={styles.clear as React.CSSProperties}>Quitar</button> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontSize: 17, fontFamily: fonts.semibold, color: colors.text, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minWidth: 0, minHeight: 56, backgroundColor: colors.surfaceRaised, color: colors.text, border: `1px solid ${colors.inputBorder}`, borderRadius: 12, padding: '0 12px', fontFamily: fonts.regular, fontSize: 18, colorScheme: 'dark' } as unknown as Record<string, string | number>,
  calendarButton: { width: 52, minHeight: 56, border: `1px solid ${colors.primary}`, borderRadius: 12, background: colors.primarySoft, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as unknown as Record<string, string | number>,
  clear: { border: `1px solid ${colors.inputBorder}`, borderRadius: 10, background: colors.surface, color: colors.primary, minHeight: 56, padding: '0 12px', fontFamily: fonts.bold, fontSize: 16, cursor: 'pointer' } as unknown as Record<string, string | number>
});
