import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Avatar, Card, Grid, Muted, Pill, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { nameOf, useProfiles } from '../context/ProfileContext';
import { colors, fonts } from '../theme/colors';
import { readableDate } from '../utils/presentation';

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
  return <Screen>
    <AppTitle eyebrow="Tu familia" title="Perfiles" subtitle="Administra tu registro principal y perfiles dependientes bajo tu cuenta." />
    <View style={styles.create}><PrimaryButton title="+ Crear perfil dependiente" onPress={() => navigation.navigate('ProfileForm')} /></View>
    <Grid min={340}>{profiles.map((profile) => {
      const active = selectedProfile?.id === profile.id;
      const birth = profile.birthDate || profile.birth_date;
      return <Card key={profile.id} style={active ? styles.active : undefined}>
        <View style={styles.heading}>
          <Avatar name={nameOf(profile)} size={52} />
          <View style={styles.copy}>
            <Text style={styles.name}>{nameOf(profile)}</Text>
            <Muted>{relation[profile.relationship] || profile.relationship}</Muted>
            {birth ? <Muted>Nacimiento: {readableDate(birth)}</Muted> : null}
          </View>
          {active ? <Pill label="ACTIVO" icon="check" /> : null}
        </View>
        <View style={styles.actions}>
          {!active ? <View style={styles.action}><SecondaryButton title="Usar este perfil" icon="account-check-outline" onPress={() => { void selectProfile(profile.id); }} /></View> : null}
          <View style={styles.action}><SecondaryButton title="Editar" icon="pencil-outline" onPress={() => navigation.navigate('ProfileForm', { profileId: profile.id })} /></View>
          {profile.relationship !== 'SELF' ? <View style={styles.action}><SecondaryButton title="Eliminar perfil" icon="trash-can-outline" danger onPress={() => remove(profile.id)} /></View> : null}
        </View>
      </Card>;
    })}</Grid>
  </Screen>;
}

const styles = StyleSheet.create({
  create: { marginBottom: 12 },
  active: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginBottom: 8 },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  name: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 27, color: colors.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  action: { flexGrow: 1, flexBasis: 200 }
});
