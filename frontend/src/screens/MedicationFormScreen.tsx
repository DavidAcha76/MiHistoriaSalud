import { useFeedback } from '../context/FeedbackContext';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { DateField } from '../components/DateField';
import { TimeField } from '../components/TimeField';
import { AppTitle, Card, Chip, Field, FormError, Muted, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import { colors, fonts } from '../theme/colors';

const days = [
  { value: 0, label: 'Dom' }, { value: 1, label: 'Lun' }, { value: 2, label: 'Mar' }, { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' }, { value: 5, label: 'Vie' }, { value: 6, label: 'Sáb' }
];
const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function MedicationFormScreen({ navigation }: any) {
  const notify = useFeedback();
  const { selectedProfile } = useProfiles();
  const [medicationName, setMedicationName] = useState('');
  const [dose, setDose] = useState('');
  const [scheduleDays, setScheduleDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [scheduleTimes, setScheduleTimes] = useState<string[]>(['']);
  const [startDate, setStartDate] = useState(localToday());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function toggleDay(day: number) {
    setError('');
    setScheduleDays((current) => current.includes(day) ? current.length === 1 ? current : current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b));
  }

  function addTime() {
    if (scheduleTimes.length === 4) return setError('Puedes añadir hasta cuatro horarios por día.');
    setScheduleTimes((current) => [...current, '']);
    setError('');
  }

  async function save() {
    if (loading) return;
    if (!selectedProfile) return setError('Selecciona el perfil al que corresponde este medicamento.');
    if (medicationName.trim().length < 2) return setError('Escribe el nombre de la pastilla o medicamento.');
    if (!scheduleDays.length) return setError('Selecciona por lo menos un día.');
    if (!scheduleTimes.length || scheduleTimes.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return setError('Elige una hora válida para cada toma.');
    if (new Set(scheduleTimes).size !== scheduleTimes.length) return setError('Hay dos tomas con la misma hora. Revisa los horarios.');
    if (!startDate) return setError('Elige cuándo empiezan los recordatorios.');
    setLoading(true); setError('');
    try {
      await apiRequest(`/profiles/${selectedProfile.id}/medication-regimens`, {
        method: 'POST',
        body: JSON.stringify({ medicationName: medicationName.trim(), dose: dose.trim() || null, scheduleDays, scheduleTimes, startDate, notes: notes.trim() || null })
      });
      notify('Horario guardado. Ya puedes consultarlo en Medicinas.');
      navigation.goBack();
    } catch (saveError: any) {
      setError(saveError.message || 'No se pudo guardar el medicamento.');
    } finally { setLoading(false); }
  }

  return <Screen form>
    <AppTitle title="Registrar medicamento" subtitle="Crea un horario para recordarte y confirmar tus tomas." />
    <ProfileSelector locked />
    <Card style={styles.notice}>
      <MaterialCommunityIcons name="information-outline" size={22} color={colors.warning} />
      <View style={{ flex: 1 }}><Text style={styles.noticeTitle}>Registra la pauta indicada</Text><Muted>Esta herramienta organiza el horario; no cambia la dosis ni sustituye las indicaciones de tu profesional.</Muted></View>
    </Card>
    <Field label="Medicamento o pastilla" value={medicationName} onChangeText={setMedicationName} placeholder="Ej.: Paracetamol" autoCapitalize="words" />
    <Field label="Dosis o presentación (opcional)" value={dose} onChangeText={setDose} placeholder="Ej.: 500 mg · 1 tableta" />
    <SectionTitle>¿Qué días lo tomas?</SectionTitle>
    <Muted>Por defecto está marcado todos los días. Toca un día para quitarlo o volverlo a incluir.</Muted>
    <View style={styles.dayWrap}>{days.map((day) => <Chip key={day.value} label={day.label} selected={scheduleDays.includes(day.value)} onPress={() => toggleDay(day.value)} />)}</View>
    <SectionTitle>¿A qué hora?</SectionTitle>
    <Card style={{ paddingBottom: 10 }}>
      <SectionTitle>Horarios de las tomas</SectionTitle>
<View>{scheduleTimes.map((time, index) => <View key={index} style={{ marginBottom: 16 }}><TimeField label={`Hora de la toma ${index + 1}`} value={time} onChange={(value) => setScheduleTimes((current) => current.map((item, position) => position === index ? value : item))} />{scheduleTimes.length > 1 ? <SecondaryButton title={`Quitar toma ${index + 1}`} onPress={() => setScheduleTimes((current) => current.filter((_, position) => position !== index))} /> : null}</View>)}</View><SecondaryButton title="+ Añadir otra hora" onPress={addTime} disabled={scheduleTimes.length >= 4} />
      <Muted>Elige las horas de tu receta. Puedes guardar hasta cuatro tomas al día.</Muted>
    </Card>
    <DateField label="Empezar recordatorios el" value={startDate} onChange={setStartDate} />
    <Field label="Nota (opcional)" value={notes} onChangeText={setNotes} placeholder="Ej.: tomar con alimentos" multiline />
    <FormError message={error} />
    <PrimaryButton title="Guardar horario de medicamento" onPress={save} loading={loading} disabled={!selectedProfile} />
  </Screen>;
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', gap: 10, backgroundColor: colors.warningSoft, borderColor: colors.warning },
  noticeTitle: { color: colors.text, fontFamily: fonts.bold, marginBottom: 3 },
  dayWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 11, marginBottom: 4 },
  timeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 7, marginBottom: 9 },
  timePill: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, borderRadius: 999, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  timeText: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 }
});
