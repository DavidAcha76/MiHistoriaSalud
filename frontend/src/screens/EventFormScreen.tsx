import { useFeedback } from '../context/FeedbackContext';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { AppTitle, Chip, Disclosure, Field, FormError, LoadingState, PrimaryButton, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { localDate } from '../utils/presentation';
import { DateField } from '../components/DateField';
import { useProfiles } from '../context/ProfileContext';
import type { EventType } from '../types/domain';
import { colors, fonts } from '../theme/colors';

type EventTypeOption = {
  value: EventType;
  label: string;
  hint: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const typeOptions: EventTypeOption[] = [
  { value: 'SYMPTOM', label: 'Molestia o síntoma', hint: 'Algo que sentiste o notas en tu cuerpo.', icon: 'heart-pulse' },
  { value: 'CONSULTATION', label: 'Consulta médica', hint: 'Una cita, control o visita médica.', icon: 'stethoscope' },
  { value: 'MEDICATION', label: 'Medicamento', hint: 'Algo que tomas o usaste.', icon: 'pill' },
  { value: 'LAB_RESULT', label: 'Resultado de examen', hint: 'Un laboratorio, análisis o estudio.', icon: 'flask-outline' },
  { value: 'DIAGNOSIS', label: 'Diagnóstico informado', hint: 'Algo indicado por un profesional.', icon: 'clipboard-check-outline' },
  { value: 'TREATMENT', label: 'Tratamiento', hint: 'Una terapia, indicación o cuidado.', icon: 'medical-bag' },
  { value: 'ALLERGY', label: 'Alergia', hint: 'Una alergia o reacción registrada.', icon: 'alert-circle-outline' },
  { value: 'VACCINE', label: 'Vacuna', hint: 'Una dosis o inmunización.', icon: 'needle' },
  { value: 'SURGERY', label: 'Cirugía o procedimiento', hint: 'Una operación o procedimiento.', icon: 'hospital-box-outline' },
  { value: 'ANTECEDENT', label: 'Antecedente', hint: 'Un dato de salud previo o familiar.', icon: 'history' },
  { value: 'OTHER', label: 'Otro dato de salud', hint: 'Algo importante que no encaja arriba.', icon: 'plus-circle-outline' }
];

const detailFields: Record<EventType, Array<[string, string]>> = {
  ANTECEDENT: [['category', 'Categoría (PERSONAL / FAMILY / OTHER)'], ['condition_name', 'Antecedente o condición'], ['relationship_person', 'Parentesco, si es familiar'], ['onset_date', 'Fecha de inicio'], ['status', 'Estado']],
  CONSULTATION: [['professional_name', 'Profesional'], ['specialty', 'Especialidad'], ['facility', 'Centro o institución'], ['reason', 'Motivo']],
  DIAGNOSIS: [['diagnosis_name', 'Diagnóstico declarado'], ['status', 'Estado'], ['diagnosed_by', 'Profesional / fuente']],
  TREATMENT: [['treatment_name', 'Nombre del tratamiento'], ['instructions', 'Indicaciones registradas'], ['start_date', 'Fecha de inicio'], ['end_date', 'Fecha de fin']],
  MEDICATION: [['medication_name', 'Medicamento'], ['dose', 'Dosis registrada'], ['frequency', 'Frecuencia'], ['route', 'Vía'], ['start_date', 'Fecha de inicio'], ['end_date', 'Fecha de fin'], ['status', 'Estado']],
  ALLERGY: [['allergen', 'Alérgeno'], ['reaction', 'Reacción registrada'], ['severity', 'Severidad registrada'], ['status', 'Estado']],
  VACCINE: [['vaccine_name', 'Vacuna'], ['dose_number', 'Número de dosis'], ['lot_number', 'Lote'], ['provider', 'Proveedor / centro']],
  SURGERY: [['procedure_name', 'Procedimiento'], ['facility', 'Centro o institución'], ['professional_name', 'Profesional']],
  LAB_RESULT: [['test_name', 'Prueba'], ['value_text', 'Valor textual'], ['value_numeric', 'Valor numérico'], ['unit', 'Unidad'], ['reference_range', 'Rango de referencia'], ['flag', 'Marca / observación del laboratorio'], ['laboratory', 'Laboratorio']],
  SYMPTOM: [['symptom_name', 'Molestia o síntoma'], ['body_area', 'Zona del cuerpo'], ['intensity', 'Intensidad (0 a 10)'], ['onset_date', 'Inicio'], ['resolved_date', 'Fin, si se resolvió'], ['status', 'Estado'], ['triggers_text', 'Qué parecía empeorarlo'], ['relief_text', 'Qué parecía aliviarlo'], ['associated_symptoms', 'Otras molestias registradas'], ['impact_text', 'Impacto en actividades o descanso']],
  OTHER: []
};

type StatusOption = { value: string; label: string };
type StatusConfig = { label: string; hint: string; options: StatusOption[] };

const statusConfigs: Partial<Record<EventType, StatusConfig>> = {
  ANTECEDENT: {
    label: 'Estado actual',
    hint: 'Elige la opción que mejor describa este antecedente.',
    options: [{ value: 'ACTIVE', label: 'Sigue presente' }, { value: 'RESOLVED', label: 'Ya no aplica' }, { value: 'UNKNOWN', label: 'No estoy seguro' }]
  },
  DIAGNOSIS: {
    label: 'Estado actual',
    hint: 'Esto solo organiza lo que ya fue registrado.',
    options: [{ value: 'ACTIVE', label: 'Está vigente' }, { value: 'UNDER_OBSERVATION', label: 'En seguimiento' }, { value: 'RESOLVED', label: 'Ya se resolvió' }, { value: 'UNKNOWN', label: 'No estoy seguro' }]
  },
  MEDICATION: {
    label: '¿Cómo está este medicamento?',
    hint: 'No cambia ninguna indicación médica.',
    options: [{ value: 'ACTIVE', label: 'Lo estoy tomando' }, { value: 'PAUSED', label: 'Lo pausé' }, { value: 'FINISHED', label: 'Ya terminé' }, { value: 'UNKNOWN', label: 'No estoy seguro' }]
  },
  ALLERGY: {
    label: 'Estado registrado',
    hint: 'Indica cómo está anotada esta alergia en tus datos.',
    options: [{ value: 'ACTIVE', label: 'Sigue vigente' }, { value: 'SUSPECTED', label: 'Es una sospecha' }, { value: 'RESOLVED', label: 'Ya no aplica' }, { value: 'UNKNOWN', label: 'No estoy seguro' }]
  },
  SYMPTOM: {
    label: '¿Cómo está la molestia ahora?',
    hint: 'Selecciona lo que mejor la describa hoy.',
    options: [{ value: 'ACTIVE', label: 'Sigue presente' }, { value: 'RESOLVED', label: 'Ya se resolvió' }, { value: 'RECURRENT', label: 'Ha vuelto' }, { value: 'UNKNOWN', label: 'No estoy seguro' }]
  }
};

const today = localDate;
const defaultDetails = (eventType: EventType): Record<string, string> => eventType === 'SYMPTOM' ? { status: 'UNKNOWN' } : {};

function StatusSelector({ eventType, value, onChange }: { eventType: EventType; value: string; onChange: (value: string) => void }) {
  const config = statusConfigs[eventType];
  if (!config) return null;
  return <View style={styles.statusField}>
    <Text style={styles.statusLabel}>{config.label}</Text>
    <Text style={styles.statusHint}>{config.hint}</Text>
    <View style={styles.statusOptions}>{config.options.map((option) => <Chip key={option.value} label={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />)}</View>
  </View>;
}

function EventTypePicker({ value, disabled, onChange }: { value: EventType; disabled?: boolean; onChange: (value: EventType) => void }) {
  const [visible, setVisible] = useState(false);
  const selected = typeOptions.find((option) => option.value === value) || typeOptions[0];
  const selectType = (next: EventType) => {
    onChange(next);
    setVisible(false);
  };

  return <View style={styles.typeField}>
    <Text style={styles.typeFieldLabel}>¿Qué quieres registrar?</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`Tipo de registro: ${selected.label}`} disabled={disabled} onPress={() => setVisible(true)} style={({ pressed }) => [styles.typeSummary, (pressed || disabled) && styles.typeSummaryInactive]}>
      <View style={styles.typeSummaryIcon}><MaterialCommunityIcons name={selected.icon} size={25} color={colors.primary} /></View>
      <View style={styles.typeSummaryCopy}><Text style={styles.typeSummaryTitle}>{selected.label}</Text><Text style={styles.typeSummaryHint} numberOfLines={1}>{selected.hint}</Text></View>
      {!disabled ? <View style={styles.changeType}><Text style={styles.changeTypeText}>Cambiar</Text><MaterialCommunityIcons name="chevron-right" size={19} color={colors.primary} /></View> : null}
    </Pressable>
    {disabled ? <Text style={styles.typeLockedHint}>El tipo no se puede cambiar al editar un registro.</Text> : null}

    <Modal visible={visible} transparent animationType="none" onRequestClose={() => setVisible(false)}>
      <View style={styles.typeModal}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar selector de tipo" style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} />
        <View style={styles.typeSheet}>
          <View style={styles.typeSheetHeader}><View style={styles.typeSheetHeaderCopy}><Text style={styles.typeSheetTitle}>¿Qué quieres registrar?</Text><Text style={styles.typeSheetSubtitle}>Elige la opción más parecida a lo que deseas guardar.</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setVisible(false)} style={styles.closeButton}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></Pressable></View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.typeGrid}>
            {typeOptions.map((option) => {
              const isSelected = option.value === value;
              return <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: isSelected }} accessibilityLabel={`${option.label}. ${option.hint}`} onPress={() => selectType(option.value)} style={({ pressed }) => [styles.typeCard, isSelected && styles.typeCardSelected, pressed && styles.typeCardPressed]}>
                <View style={[styles.typeCardIcon, isSelected && styles.typeCardIconSelected]}><MaterialCommunityIcons name={option.icon} size={23} color={isSelected ? colors.background : colors.primary} /></View>
                <Text style={styles.typeCardTitle}>{option.label}</Text>
                <Text style={styles.typeCardHint}>{option.hint}</Text>
              </Pressable>;
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </View>;
}

export function EventFormScreen({ navigation, route }: any) {
  const notify = useFeedback();
  const { selectedProfile } = useProfiles();
  const editId = route.params?.eventId as string | undefined;
  const [eventType, setEventType] = useState<EventType>('SYMPTOM');
  const [title, setTitle] = useState('');
  const [eventDate, setEventDate] = useState(today());
  const [description, setDescription] = useState('');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [details, setDetails] = useState<Record<string, string>>(() => defaultDetails('SYMPTOM'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingEvent, setLoadingEvent] = useState(Boolean(editId));
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const fields = useMemo(() => detailFields[eventType], [eventType]);

  useEffect(() => {
    if (!editId || !selectedProfile) return;
    let active = true;
    setLoadingEvent(true); setError(''); setLoadFailed(false);
    apiRequest<any>(`/profiles/${selectedProfile.id}/events/${editId}`).then((event) => {
      if (!active) return;
      setEventType(event.event_type || event.eventType);
      setTitle(event.title || '');
      setEventDate(event.event_date || event.eventDate || today());
      setDescription(event.description || '');
      setSource(event.source || '');
      setNotes(event.notes || '');
      const values = { ...(event.details || {}) };
      delete values.event_id;
      setDetails(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value == null ? '' : String(value)])));
    }).catch(() => { if (active) { setError('No pudimos cargar el registro. Vuelve a intentar.'); setLoadFailed(true); } }).finally(() => { if (active) setLoadingEvent(false); });
    return () => { active = false; };
  }, [editId, selectedProfile?.id, retry]);

  async function save() {
    if (loading || loadingEvent || loadFailed) return;
    if (!selectedProfile) return setError('Selecciona la persona a la que corresponde este registro.');
    if (title.trim().length < 2) return setError('Escribe qué quieres recordar. Por ejemplo: Dolor de cabeza.');
    if (!eventDate) return setError('Elige la fecha del registro.');
    const detailsToSave = eventType === 'SYMPTOM' ? { ...details, symptom_name: details.symptom_name?.trim() || title.trim(), status: details.status || 'UNKNOWN' } : details;
    setError('');
    setLoading(true);
    try {
      await apiRequest(`/profiles/${selectedProfile.id}/events${editId ? `/${editId}` : ''}`, {
        method: editId ? 'PATCH' : 'POST',
        body: JSON.stringify({ eventType, title: title.trim(), eventDate, description: description.trim() || null, source: source.trim() || null, notes: notes.trim() || null, details: detailsToSave })
      });
      notify('Registro guardado. Ya puedes verlo en tu historial.');
      navigation.goBack();
    } catch (error: any) {
      setError(error.message || 'No pudimos guardar el registro. Tus datos siguen aquí; vuelve a intentar.');
    } finally {
      setLoading(false);
    }
  }

  if (loadingEvent && selectedProfile) return <Screen form><LoadingState label="Abriendo tu registro…" /></Screen>;
  if (loadFailed) return <Screen form><FormError message={error} /><SecondaryButton title="Volver a intentar" onPress={() => setRetry((value) => value + 1)} /></Screen>;
  return <Screen form>
    <AppTitle title={editId ? 'Editar registro' : 'Añadir un registro'} subtitle="Elige el tipo, escribe qué pasó y guarda. Puedes completar más detalles después." />
    <ProfileSelector locked />
    <SectionTitle>1. ¿Qué deseas guardar?</SectionTitle>
    <EventTypePicker value={eventType} disabled={Boolean(editId)} onChange={(nextType) => { setEventType(nextType); setDetails(defaultDetails(nextType)); }} />
    <SectionTitle>2. Cuéntanos lo principal</SectionTitle>
    <Field label={eventType === 'SYMPTOM' ? '¿Qué molestia sentiste?' : '¿Qué quieres recordar?'} value={title} onChangeText={setTitle} placeholder={eventType === 'SYMPTOM' ? 'Ej.: Dolor de cabeza' : 'Ej.: Consulta de control'} />
    <DateField label="¿En qué fecha?" value={eventDate} onChange={setEventDate} />
    <Field label="Descripción (opcional)" value={description} onChangeText={setDescription} placeholder="Puedes contar lo que pasó con tus propias palabras" multiline />
    <Disclosure title="Añadir más detalles (opcional)" initialOpen={Boolean(editId)}>
    <Field label="Centro médico o fuente (opcional)" value={source} onChangeText={setSource} />
    {fields.filter(([key]) => key !== 'symptom_name' || Boolean(editId)).map(([key, label]) => key === 'status'
      ? <StatusSelector key={key} eventType={eventType} value={details[key] || ''} onChange={(value) => setDetails((current) => ({ ...current, [key]: value }))} />
      : key.endsWith('_date')
        ? <DateField key={key} label={label} value={details[key] || ''} onChange={(value) => setDetails((current) => ({ ...current, [key]: value }))} clearable />
        : key === 'category' ? <View key={key}><SectionTitle>¿De quién es el antecedente?</SectionTitle><View style={styles.statusOptions}>{[{ value: 'PERSONAL', label: 'Personal' }, { value: 'FAMILY', label: 'Familiar' }, { value: 'OTHER', label: 'Otro' }].map((item) => <Chip key={item.value} label={item.label} selected={details.category === item.value} onPress={() => setDetails((current) => ({ ...current, category: item.value }))} />)}</View></View>
        : <Field key={key} label={`${label} (opcional)`} keyboardType={key === 'intensity' || key === 'dose_number' ? 'numeric' : 'default'} value={details[key] || ''} onChangeText={(value) => setDetails((current) => ({ ...current, [key]: value }))} />)}
    <Field label="Otras notas (opcional)" value={notes} onChangeText={setNotes} multiline />
    </Disclosure>
    <FormError message={error} />
    <PrimaryButton title={editId ? 'Guardar cambios' : 'Guardar mi registro'} onPress={save} loading={loading} disabled={!selectedProfile} />
  </Screen>;
}

const styles = StyleSheet.create({
  typeField: { marginBottom: 17 },
  typeFieldLabel: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16, marginBottom: 7 },
  typeSummary: { minHeight: 76, padding: 12, borderWidth: 1, borderColor: colors.primary, borderRadius: 18, backgroundColor: colors.primarySoft, flexDirection: 'row', alignItems: 'center', gap: 11 },
  typeSummaryInactive: { opacity: .7 },
  typeSummaryIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  typeSummaryCopy: { flex: 1 },
  typeSummaryTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  typeSummaryHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, marginTop: 2 },
  changeType: { flexDirection: 'row', alignItems: 'center' },
  changeTypeText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 16 },
  typeLockedHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, marginTop: 6 },
  typeModal: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: 'rgba(0, 0, 0, .72)' },
  typeSheet: { width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '90%', backgroundColor: colors.background, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 24, overflow: 'hidden' },
  typeSheetHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  typeSheetHeaderCopy: { flex: 1 },
  typeSheetTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 21, lineHeight: 27, letterSpacing: -.4 },
  typeSheetSubtitle: { maxWidth: 300, color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, marginTop: 3 },
  closeButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, paddingBottom: 34 },
  typeCard: { width: '100%', minHeight: 100, padding: 13, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface },
  typeCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeCardPressed: { opacity: .86, transform: [{ scale: .985 }] },
  typeCardIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised, marginBottom: 9 },
  typeCardIconSelected: { backgroundColor: colors.primary },
  typeCardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, lineHeight: 25 },
  typeCardHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, marginTop: 4 },
  statusField: { marginBottom: 15 },
  statusLabel: { fontSize: 16, fontFamily: fonts.semibold, color: colors.text, marginBottom: 4 },
  statusHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, marginBottom: 9 },
  statusOptions: { flexDirection: 'row', flexWrap: 'wrap' }
});
