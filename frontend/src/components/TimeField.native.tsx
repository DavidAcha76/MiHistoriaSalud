import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';

type TimeFieldProps = { label: string; value: string; onChange: (value: string) => void; disabled?: boolean };

function timeToDate(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const date = new Date();
  date.setSeconds(0, 0);
  date.setHours(match ? Number(match[1]) : 8, match ? Number(match[2]) : 0);
  return date;
}

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function TimeField({ label, value, onChange, disabled }: TimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const onTimeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShowPicker(false);
    if (event.type === 'set' && date) onChange(formatTime(date));
  };
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => setShowPicker(true)} style={({ pressed }) => [styles.input, (pressed || disabled) && styles.inactive]}>
      <Text style={styles.value}>{value || 'Seleccionar hora'}</Text>
      <MaterialCommunityIcons name="clock-outline" size={22} color={colors.primary} />
    </Pressable>
    {showPicker ? <DateTimePicker value={timeToDate(value)} mode="time" display="default" themeVariant="dark" onChange={onTimeChange} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  field: { marginBottom: 12 },
  label: { fontSize: 17, fontFamily: fonts.semibold, color: colors.text, marginBottom: 6 },
  input: { minHeight: 56, backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { flexShrink: 1, paddingVertical: 12, color: colors.text, fontFamily: fonts.regular, fontSize: 18 },
  inactive: { opacity: .65 }
});
