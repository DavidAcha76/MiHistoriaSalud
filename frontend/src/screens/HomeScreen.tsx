import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, FormError, LoadingState, MenuGrid, MenuTile, Muted, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import type { HealthEvent, PagedEvents } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { BrandLogo } from '../components/BrandLogo';
import { eventTypeLabel, readableDate } from '../utils/presentation';

export function HomeScreen({ navigation }: any) {
  const { selectedProfile, loading: profilesLoading } = useProfiles();
  const { user } = useAuth();
  const [recent, setRecent] = useState<HealthEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setRecent([]); setError('');
    if (!selectedProfile) { setLoading(false); return; }
    setLoading(true);
    apiRequest<PagedEvents>(`/profiles/${selectedProfile.id}/events?pageSize=3`).then((data) => {
      if (active) setRecent(data.items);
    }).catch(() => { if (active) setError('No pudimos cargar tus últimos registros. Revisa tu conexión e inténtalo de nuevo.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedProfile?.id, reload]));

  return <Screen>
    <View style={styles.topRow}><BrandLogo withName size={38} /><Pressable accessibilityRole="button" accessibilityLabel="Ver avisos y recordatorios" onPress={() => navigation.navigate('Notifications')} style={styles.notice}><MaterialCommunityIcons name="bell-outline" size={24} color={colors.primary} /><Text style={styles.noticeText}>Avisos</Text></Pressable></View>
    <AppTitle title={`Hola, ${user?.fullName?.split(' ')[0] || 'bienvenido'}`} subtitle="Tu información de salud, a mano. ¿Qué necesitas hacer hoy?" />
    <ProfileSelector />
    <View style={styles.welcome}><View style={styles.welcomeHeading}><MaterialCommunityIcons name="heart-pulse" size={28} color={colors.primary} /><Text accessibilityRole="header" style={styles.welcomeTitle}>Lleva tu salud al día</Text></View><Text style={styles.welcomeText}>Guarda una molestia, una consulta o un resultado para recordarlo después.</Text><PrimaryButton title="+ Añadir un registro de salud" onPress={() => navigation.navigate('EventForm')} disabled={!selectedProfile} /></View>
    <SectionTitle>Lo que necesitas, en un toque</SectionTitle>
    <MenuGrid>
      <MenuTile icon="pill" label="Mis medicamentos" hint="Ver horarios y marcar las tomas" onPress={() => navigation.navigate('Medicinas')} />
      <MenuTile icon="clipboard-text-outline" label="Mi historial" hint="Encontrar mis registros de salud" onPress={() => navigation.navigate('Historial')} tone="accent" />
      <MenuTile icon="file-document-outline" label="Mis documentos" hint="Guardar y abrir recetas o exámenes" onPress={() => navigation.navigate('Documents')} tone="accent" />
      <MenuTile icon="stethoscope" label="Preparar mi consulta" hint="Ver un resumen para mi médico" onPress={() => navigation.navigate('Summary')} />
    </MenuGrid>
    <SectionTitle>Últimos registros</SectionTitle>
    {loading || profilesLoading ? <LoadingState /> : error ? <><FormError message={error} /><SecondaryButton title="Volver a intentar" onPress={() => setReload((value) => value + 1)} /></> : recent.length ? <>
      {recent.map((event) => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Ver ${event.title}, ${readableDate(event.eventDate)}`} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} style={({ pressed }) => ({ opacity: pressed ? .8 : 1 })}><Card><View style={styles.eventRow}><View style={{ flex: 1 }}><Text style={styles.eventTitle}>{event.title}</Text><Muted>{readableDate(event.eventDate)} · {eventTypeLabel(event.eventType)}</Muted></View><MaterialCommunityIcons name="chevron-right" size={26} color={colors.primary} /></View></Card></Pressable>)}
      <SecondaryButton title="Ver todo mi historial" onPress={() => navigation.navigate('Historial')} />
    </> : selectedProfile ? <Card><Text style={styles.eventTitle}>Aquí comienza tu historia</Text><Muted>Cuando añadas tu primer registro, podrás encontrarlo aquí. Puedes empezar con una consulta reciente.</Muted></Card> : null}
  </Screen>;
}
const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 28 },
  notice: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  noticeText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  welcome: { padding: 22, backgroundColor: colors.primarySoft, borderRadius: 22, borderWidth: 1, borderColor: colors.primaryDark, marginTop: 8, marginBottom: 8 },
  welcomeHeading: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  welcomeTitle: { fontFamily: fonts.bold, fontSize: 23, lineHeight: 32, color: colors.text, flex: 1 },
  welcomeText: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 27, color: colors.text, marginBottom: 12, maxWidth: 650 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eventTitle: { color: colors.text, fontSize: 18, lineHeight: 28, fontFamily: fonts.bold, marginBottom: 6 }
});
