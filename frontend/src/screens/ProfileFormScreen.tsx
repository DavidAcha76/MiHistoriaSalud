import { useFeedback } from '../context/FeedbackContext';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { apiRequest } from '../api/client';
import { AppTitle, Chip, Field, PrimaryButton, Screen } from '../components/ui';
import { DateField } from '../components/DateField';
import { nameOf, useProfiles } from '../context/ProfileContext';
import type { HealthProfile } from '../types/domain';

const relations: Array<{ value: HealthProfile['relationship']; label: string }> = [
  { value: 'SELF', label: 'Propio' }, { value: 'CHILD', label: 'Hijo/a' }, { value: 'PARENT', label: 'Padre/madre' }, { value: 'OTHER', label: 'Otro dependiente' }
];
const today = () => new Date().toISOString().slice(0, 10);

export function ProfileFormScreen({ route, navigation }: any) {
  const notify = useFeedback();
  const { profiles, refreshProfiles } = useProfiles();
  const profileId = route.params?.profileId as string | undefined;
  const existing = profiles.find((profile) => profile.id === profileId);
  const [displayName, setDisplayName] = useState(existing ? nameOf(existing) : '');
  const [birthDate, setBirthDate] = useState(existing ? (existing.birthDate || existing.birth_date || '') : '');
  const [relationship, setRelationship] = useState<HealthProfile['relationship']>(existing?.relationship || 'CHILD');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setDisplayName(nameOf(existing));
    setBirthDate(existing.birthDate || existing.birth_date || '');
    setRelationship(existing.relationship);
    setNotes(existing.notes || '');
  }, [profileId]);

  async function save() {
    if (displayName.trim().length < 2) return Alert.alert('Falta el nombre', 'Escribe un nombre para el perfil.');
    setLoading(true);
    try {
      const body = { displayName: displayName.trim(), birthDate: birthDate || null, relationship, notes: notes || null };
      if (profileId) await apiRequest(`/profiles/${profileId}`, { method: 'PATCH', body: JSON.stringify(body) });
      else await apiRequest('/profiles', { method: 'POST', body: JSON.stringify(body) });
      await refreshProfiles();
      notify('Perfil guardado.');
      navigation.goBack();
    } catch (error: any) { Alert.alert('No se pudo guardar', error.message); }
    finally { setLoading(false); }
  }

  return <Screen form>
    <AppTitle title={profileId ? 'Editar perfil' : 'Nuevo perfil'} subtitle="Los perfiles dependientes se administran desde la cuenta del representante." />
    <Field label="Nombre visible" value={displayName} onChangeText={setDisplayName} />
    <DateField label="Fecha de nacimiento" value={birthDate} onChange={setBirthDate} maximumDate={today()} clearable />
    <Text style={{ fontWeight: '800', marginBottom: 8 }}>Relación</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{relations.filter((item) => existing?.relationship === 'SELF' ? item.value === 'SELF' : item.value !== 'SELF').map((item) => <Chip key={item.value} label={item.label} selected={relationship === item.value} onPress={() => setRelationship(item.value)} />)}</View>
    <Field label="Notas del perfil" value={notes} onChangeText={setNotes} multiline />
    <PrimaryButton title="Guardar perfil" onPress={save} loading={loading} />
  </Screen>;
}
