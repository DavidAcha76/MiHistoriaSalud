import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
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

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateValue(date: Date) {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function displayDate(value: string) {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Seleccionar fecha';
}

export function DateField({ label, value, onChange, minimumDate, maximumDate, clearable = false, disabled }: DateFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedDate = parseDate(value) || new Date();
  const onDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'set' && date) onChange(toDateValue(date));
  };
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => setShowPicker(true)} style={({ pressed }) => [styles.input, (pressed || disabled) && { opacity: 0.7 }]}>
        <Text style={[styles.value, !value && styles.placeholder]}>{displayDate(value)}</Text>
        <MaterialCommunityIcons name="calendar-month-outline" size={22} color={colors.primary} />
      </Pressable>
      {clearable && value ? <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${label.toLowerCase()}`} onPress={() => onChange('')} style={styles.clear}><Text style={styles.clearText}>Quitar</Text></Pressable> : null}
    </View>
    {showPicker ? <DateTimePicker value={selectedDate} mode="date" display="default" themeVariant="dark" minimumDate={parseDate(minimumDate || '') || undefined} maximumDate={parseDate(maximumDate || '') || undefined} onChange={onDateChange} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontSize: 17, fontFamily: fonts.semibold, color: colors.text, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, minHeight: 56, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { flexShrink: 1, paddingVertical: 12, color: colors.text, fontFamily: fonts.regular, fontSize: 18 },
  placeholder: { color: colors.muted },
  clear: { minHeight: 56, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  clearText: { color: colors.primary, fontFamily: fonts.bold }
});
