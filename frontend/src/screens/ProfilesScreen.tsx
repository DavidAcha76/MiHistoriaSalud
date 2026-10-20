import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Avatar, Card, EmptyState, Grid, Muted, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../components/ui';
import { nameOf, useProfiles } from '../context/ProfileContext';
import type { HealthProfile } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { readableDate } from '../utils/presentation';
import { roleLabels } from '../utils/audit';

const relation: Record<string, string> = { SELF: 'Perfil principal', CHILD: 'Dependiente: hijo/a', PARENT: 'Dependiente: padre/madre', OTHER: 'Dependiente / otro' };

export function ProfilesScreen({ navigation }: any) {
  const { profiles, selectedProfile, selectProfile, refreshProfiles } = useProfiles();
  useFocusEffect(useCallback(() => { refreshProfiles(); }, []));
  async function remove(id: string) {
    Alert.alert('Eliminar perfil dependiente', 'Se eliminarán sus eventos, análisis y documentos. Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { try { await apiRequest(`/profiles/${id}`, { method: 'DELETE' }); await refreshProfiles(); } catch (e: any) { Alert.alert('No se pudo eliminar', e.message); } } }
    ]);
  }
  const own = profiles.filter((profile) => !profile.accessRole || profile.accessRole === 'OWNER');
  const shared = profiles.filter((profile) => profile.accessRole && profile.accessRole !== 'OWNER');

  function card(profile: HealthProfile) {
    const active = selectedProfile?.id === profile.id;
    const birth = profile.birthDate || profile.birth_date;
    const role = profile.accessRole || 'OWNER';
    return <Card key={profile.id} style={active ? styles.active : undefined}>
      <View style={styles.heading}>
        <Avatar name={nameOf(profile)} size={52} />
        <View style={styles.copy}>
          <Text style={styles.name}>{nameOf(profile)}</Text>
          <Muted>{role === 'OWNER' ? relation[profile.relationship] || profile.relationship : `Compartido por ${profile.ownerName || 'otra cuenta'}`}</Muted>
          {birth ? <Muted>Nacimiento: {readableDate(birth)}</Muted> : null}
        </View>
        <View style={styles.pills}>
          {active ? <Pill label="ACTIVO" icon="check" /> : null}
          {role !== 'OWNER' ? <Pill label={roleLabels[role]} tone={role === 'VIEWER' ? 'neutral' : 'accent'} icon={role === 'VIEWER' ? 'eye-outline' : 'account-edit-outline'} /> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {!active ? <View style={styles.action}><SecondaryButton title="Usar este perfil" icon="account-check-outline" onPress={() => { void selectProfile(profile.id); }} /></View> : null}
        {role !== 'VIEWER' ? <View style={styles.action}><SecondaryButton title="Editar" icon="pencil-outline" onPress={() => navigation.navigate('ProfileForm', { profileId: profile.id })} /></View> : null}
        {role === 'OWNER' ? <View style={styles.action}><SecondaryButton title="Personas autorizadas" icon="account-key-outline" onPress={() => navigation.navigate('Authorizations', { profileId: profile.id })} /></View> : null}
        {role === 'OWNER' && profile.relationship !== 'SELF' ? <View style={styles.action}><SecondaryButton title="Eliminar perfil" icon="trash-can-outline" danger onPress={() => remove(profile.id)} /></View> : null}
      </View>
    </Card>;
  }

  return <Screen>
    <AppTitle eyebrow="Tu familia" title="Perfiles" subtitle="Administra tu registro principal, los perfiles dependientes y quién más puede consultarlos." />
    <View style={styles.create}><PrimaryButton title="+ Crear perfil dependiente" onPress={() => navigation.navigate('ProfileForm')} /></View>
    <SectionTitle>Tus perfiles</SectionTitle>
    <Grid min={340}>{own.map(card)}</Grid>
    <SectionTitle>Compartidos contigo</SectionTitle>
    {shared.length ? <Grid min={340}>{shared.map(card)}</Grid> : <EmptyState icon="account-multiple-outline" text="Cuando otra persona te autorice a ver el perfil de un familiar, aparecerá aquí." />}
  </Screen>;
}

const styles = StyleSheet.create({
  create: { marginBottom: 4 },
  active: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 8 },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  pills: { gap: 6 },
  name: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 27, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  action: { flexGrow: 1, flexBasis: 200 }
});
