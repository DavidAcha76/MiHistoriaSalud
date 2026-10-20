import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, EmptyState, FormError, IconBadge, LoadingState, MenuGrid, MenuTile, PrimaryButton, Screen, SecondaryButton, SectionTitle, type PressState } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import type { HealthEvent, PagedEvents } from '../types/domain';
import { colors, fonts, shadows } from '../theme/colors';
import { shadow } from '../theme/effects';
import { BrandLogo } from '../components/BrandLogo';
import { useLayout } from '../hooks/useLayout';
import { eventIcon, eventTone, eventTypeLabel, readableDate, todayLabel } from '../utils/presentation';

export function HomeScreen({ navigation }: any) {
  const { selectedProfile, loading: profilesLoading } = useProfiles();
  const { user } = useAuth();
  const { sidebarMode, contentWidth, largeText, twoColumns } = useLayout();
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

  const split = !largeText && contentWidth >= 900;
  const notices = <Pressable accessibilityRole="button" accessibilityLabel="Ver avisos y recordatorios" onPress={() => navigation.navigate('Notifications')} style={(state) => [styles.notice, (state as PressState).hovered && styles.noticeHovered]}><MaterialCommunityIcons name="bell-outline" size={22} color={colors.primary} /><Text style={styles.noticeText}>Avisos</Text></Pressable>;

  const hero = <Card tone="hero" style={styles.hero}>
    <View aria-hidden style={styles.heroArt}><MaterialCommunityIcons name="heart-pulse" size={180} color="rgba(121, 221, 202, 0.09)" /></View>
    <View style={styles.welcomeHeading}><IconBadge icon="heart-pulse" size={48} /><Text accessibilityRole="header" style={styles.welcomeTitle}>Lleva tu salud al día</Text></View>
    <Text style={styles.welcomeText}>Guarda una molestia, una consulta o un resultado para recordarlo después.</Text>
    <View style={twoColumns ? styles.heroActionWide : undefined}><PrimaryButton title="+ Añadir un registro de salud" onPress={() => navigation.navigate('EventForm')} disabled={!selectedProfile} /></View>
  </Card>;

  const quickActions = <>
    <SectionTitle>Lo que necesitas, en un toque</SectionTitle>
    <MenuGrid columns={split ? 1 : 2}>
      <MenuTile icon="pill" label="Mis medicamentos" hint="Ver horarios y marcar las tomas" onPress={() => navigation.navigate('Medicinas')} />
      <MenuTile icon="clipboard-text-outline" label="Mi historial" hint="Encontrar mis registros de salud" onPress={() => navigation.navigate('Historial')} tone="accent" />
      <MenuTile icon="file-document-outline" label="Mis documentos" hint="Guardar y abrir recetas o exámenes" onPress={() => navigation.navigate('Documents')} tone="accent" />
      <MenuTile icon="stethoscope" label="Preparar mi consulta" hint="Ver un resumen para mi médico" onPress={() => navigation.navigate('Summary')} />
    </MenuGrid>
  </>;

  const recentRecords = <>
    <SectionTitle>Últimos registros</SectionTitle>
    {loading || profilesLoading ? <LoadingState /> : error ? <><FormError message={error} /><SecondaryButton title="Volver a intentar" onPress={() => setReload((value) => value + 1)} /></> : recent.length ? <>
      {recent.map((event) => <Pressable key={event.id} accessibilityRole="button" accessibilityLabel={`Ver ${event.title}, ${readableDate(event.eventDate)}`} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} style={(state) => {
        const { pressed, hovered } = state as PressState;
        return [styles.event, hovered && styles.eventHovered, pressed && { opacity: .82 }];
      }}>
        <IconBadge icon={eventIcon(event.eventType)} tone={eventTone(event.eventType)} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.eventTitle}>{event.title}</Text><Text style={styles.eventMeta}>{readableDate(event.eventDate)} · {eventTypeLabel(event.eventType)}</Text></View>
        <MaterialCommunityIcons name="chevron-right" size={26} color={colors.primary} />
      </Pressable>)}
      <SecondaryButton title="Ver todo mi historial" icon="timeline-text-outline" onPress={() => navigation.navigate('Historial')} />
    </> : selectedProfile ? <EmptyState icon="notebook-plus-outline" title="Aquí comienza tu historia" text="Cuando añadas tu primer registro, podrás encontrarlo aquí. Puedes empezar con una consulta reciente." /> : null}
  </>;

  return <Screen>
    {!sidebarMode ? <View style={styles.topRow}><BrandLogo withName size={40} />{notices}</View> : null}
    <View style={sidebarMode ? styles.titleRow : undefined}>
      <View style={{ flex: 1, minWidth: 0 }}><AppTitle eyebrow={todayLabel()} title={`Hola, ${user?.fullName?.split(' ')[0] || 'bienvenido'}`} subtitle="Tu información de salud, a mano. ¿Qué necesitas hacer hoy?" /></View>
      {sidebarMode ? notices : null}
    </View>
    <ProfileSelector />
    {split ? <View style={styles.split}>
      <View style={styles.main}>{hero}{recentRecords}</View>
      <View style={styles.aside}>{quickActions}</View>
    </View> : <>{hero}{quickActions}{recentRecords}</>}
  </Screen>;
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 28 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 20 },
  notice: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface },
  noticeHovered: { borderColor: colors.primary, backgroundColor: colors.surfaceHover },
  noticeText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  hero: { padding: 24, marginTop: 4, marginBottom: 8, borderRadius: 26, overflow: 'hidden' },
  heroArt: { position: 'absolute', right: -24, top: -30, pointerEvents: 'none' },
  welcomeHeading: { flexDirection: 'row', gap: 14, alignItems: 'center', marginBottom: 12 },
  welcomeTitle: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 32, letterSpacing: -0.4, color: colors.text, flex: 1 },
  welcomeText: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 27, color: colors.text, marginBottom: 12, maxWidth: 560 },
  heroActionWide: { alignSelf: 'flex-start' },
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: 28 },
  main: { flex: 1.45, minWidth: 0 },
  aside: { flex: 1, minWidth: 0, marginTop: -28 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, marginBottom: 12, borderRadius: 20, borderWidth: 1, borderColor: colors.borderSoft, backgroundColor: colors.surface, ...shadow(shadows.card) },
  eventHovered: { borderColor: colors.border, backgroundColor: colors.surfaceHover },
  eventTitle: { color: colors.text, fontSize: 18, lineHeight: 27, fontFamily: fonts.bold },
  eventMeta: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 2 }
});
