import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar, Chip, FormError, LoadingState, Muted, SecondaryButton } from './ui';
import { nameOf, useProfiles } from '../context/ProfileContext';
import { useLayout } from '../hooks/useLayout';
import { colors, fonts, shadows } from '../theme/colors';
import { shadow } from '../theme/effects';

export function ProfileSelector({ locked = false }: { locked?: boolean }) {
  const { profiles, selectedProfile, selectProfile, loading, error, refreshProfiles } = useProfiles();
  const { twoColumns } = useLayout();
  const [open, setOpen] = useState(false);
  if (loading && !selectedProfile) return <LoadingState label="Buscando tus perfiles…" />;
  if (error) return <View><FormError message={error} /><SecondaryButton title="Volver a cargar perfiles" onPress={() => { void refreshProfiles(); }} /></View>;
  if (!selectedProfile) return <Muted>No hay un perfil seleccionado. Abre Más → Perfiles para añadir uno.</Muted>;
  const canChange = !locked && profiles.length > 1;
  const toggle = canChange ? <SecondaryButton title={open ? 'Cerrar selección de persona' : 'Cambiar de persona'} icon={open ? 'close' : 'account-switch-outline'} onPress={() => setOpen(!open)} /> : null;
  return <View style={styles.box}>
    <View style={[styles.row, twoColumns && styles.rowWide]}>
      <View style={styles.identity}>
        <Avatar name={nameOf(selectedProfile)} size={48} />
        <View style={styles.copy}>
          <Text style={styles.caption}>Información de salud de</Text>
          <Text style={styles.name}>{nameOf(selectedProfile)}</Text>
        </View>
        {locked ? <MaterialCommunityIcons name="lock-outline" size={22} color={colors.muted} accessibilityLabel="Persona fija en este formulario" /> : null}
      </View>
      {twoColumns ? toggle : null}
    </View>
    {!twoColumns ? toggle : null}
    {canChange && open ? <View style={styles.options}>{profiles.map((profile) => <Chip key={profile.id} label={nameOf(profile)} selected={profile.id === selectedProfile.id} onPress={() => { void selectProfile(profile.id); setOpen(false); }} />)}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  box: { padding: 16, marginBottom: 20, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft, ...shadow(shadows.card) },
  row: { gap: 12 },
  rowWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  copy: { flex: 1, minWidth: 0 },
  caption: { color: colors.muted, fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, lineHeight: 27 },
  options: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }
});
