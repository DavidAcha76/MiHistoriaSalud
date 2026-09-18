import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Chip, FormError, LoadingState, Muted, SecondaryButton } from './ui';
import { nameOf, useProfiles } from '../context/ProfileContext';
import { colors, fonts } from '../theme/colors';

export function ProfileSelector({ locked = false }: { locked?: boolean }) {
  const { profiles, selectedProfile, selectProfile, loading, error, refreshProfiles } = useProfiles();
  const [open, setOpen] = useState(false);
  if (loading && !selectedProfile) return <LoadingState label="Buscando tus perfiles…" />;
  if (error) return <View><FormError message={error} /><SecondaryButton title="Volver a cargar perfiles" onPress={() => { void refreshProfiles(); }} /></View>;
  if (!selectedProfile) return <Muted>No hay un perfil seleccionado. Abre Más → Perfiles para añadir uno.</Muted>;
  return <View style={{ padding: 16, marginBottom: 20, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><MaterialCommunityIcons name="account-circle-outline" size={30} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontFamily: fonts.medium, fontSize: 15, lineHeight: 23 }}>Información de salud de</Text><Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18, lineHeight: 28 }}>{nameOf(selectedProfile)}</Text></View></View>
    {!locked && profiles.length > 1 ? <><SecondaryButton title={open ? 'Cerrar selección de persona' : 'Cambiar de persona'} onPress={() => setOpen(!open)} />{open ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>{profiles.map((profile) => <Chip key={profile.id} label={nameOf(profile)} selected={profile.id === selectedProfile.id} onPress={() => { void selectProfile(profile.id); setOpen(false); }} />)}</View> : null}</> : null}
  </View>;
}
