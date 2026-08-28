import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Chip } from './ui';
import { nameOf, useProfiles } from '../context/ProfileContext';
import { colors } from '../theme/colors';

export function ProfileSelector() {
  const { profiles, selectedProfile, selectProfile } = useProfiles();
  return <View style={{ marginBottom: 14 }}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: '700', marginBottom: 7 }}>PERFIL ACTIVO</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{profiles.map((p) => <Chip key={p.id} label={nameOf(p)} selected={selectedProfile?.id === p.id} onPress={() => selectProfile(p.id)} />)}</ScrollView></View>;
}
