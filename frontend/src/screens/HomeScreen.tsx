import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Muted, PrimaryButton, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { nameOf, useProfiles } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import type { PagedEvents } from '../types/domain';
import { colors } from '../theme/colors';

export function HomeScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles(); const { user, logout } = useAuth();
  const [stats, setStats] = useState({ events: 0, docs: 0 }); const [recent, setRecent] = useState<any[]>([]);
  const load = useCallback(() => { if (!selectedProfile) return; Promise.all([apiRequest<PagedEvents>(`/profiles/${selectedProfile.id}/events?pageSize=5`), apiRequest<any[]>(`/profiles/${selectedProfile.id}/documents`)]).then(([events, docs]) => { setStats({ events: events.total, docs: docs.length }); setRecent(events.items); }).catch(() => {}); }, [selectedProfile?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <Screen><AppTitle title={`Hola, ${user?.fullName?.split(' ')[0] || 'usuario'}`} subtitle="Revisa y organiza tu historial personal." /><ProfileSelector />
    <View style={{ flexDirection: 'row', gap: 10 }}><Card style={{ flex: 1 }}><Text style={{ fontSize: 28, fontWeight: '900', color: colors.primary }}>{stats.events}</Text><Muted>eventos</Muted></Card><Card style={{ flex: 1 }}><Text style={{ fontSize: 28, fontWeight: '900', color: colors.primary }}>{stats.docs}</Text><Muted>documentos</Muted></Card></View>
    <PrimaryButton title="+ Registrar evento de salud" onPress={() => navigation.navigate('EventForm')} /><SecondaryButton title="Preparar información para consulta" onPress={() => navigation.navigate('Summary')} /><SecondaryButton title="Subir documento clínico" onPress={() => navigation.navigate('DocumentUpload')} />
    <SectionTitle>Actividad reciente</SectionTitle>{recent.length ? recent.map((e) => <Pressable key={e.id} onPress={() => navigation.navigate('EventDetail', { eventId: e.id })}><Card><Text style={{ fontWeight: '800', color: colors.text }}>{e.title}</Text><Muted>{e.eventDate} · {e.eventType}</Muted></Card></Pressable>) : <Card><Muted>Aún no hay eventos para {selectedProfile ? nameOf(selectedProfile) : 'este perfil'}.</Muted></Card>}
    <SecondaryButton title="Cerrar sesión" onPress={logout} />
  </Screen>;
}
