import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, EmptyState, Grid, IconBadge, LoadingState, Muted, Screen, SecondaryButton, type IconName, type Tone } from '../components/ui';
import { colors, fonts } from '../theme/colors';
import { useProfiles } from '../context/ProfileContext';

type Notification = { id: string; profileId?: string; title: string; body: string; createdAt: string; readAt?: string | null; notificationType?: string };

function noticeStyle(type?: string): [IconName, Tone] {
  if (type === 'MEDICATION_REMINDER') return ['pill', 'primary'];
  if (type === 'AI_ANALYSIS_READY') return ['creation', 'ai'];
  return ['bell-outline', 'accent'];
}

export function NotificationsScreen({ navigation }: any) {
  const { selectProfile } = useProfiles();
  const [items, setItems] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(() => {
    apiRequest<Notification[]>('/notifications').then(setItems).catch((error: any) => Alert.alert('Avisos', error.message)).finally(() => setLoaded(true));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function markRead(id: string) {
    try { await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }); load(); }
    catch (error: any) { Alert.alert('Avisos', error.message); }
  }
  return <Screen>
    <AppTitle title="Avisos" subtitle="Aquí aparecen revisiones y recordatorios de medicamentos cuando llega su horario." />
    {!loaded ? <LoadingState label="Buscando tus avisos…" /> : null}
    {items.map((item) => {
      const [icon, tone] = noticeStyle(item.notificationType);
      return <Card key={item.id} style={item.readAt ? styles.read : undefined}>
        <View style={styles.row}>
          <IconBadge icon={icon} tone={tone} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.titleRow}><Text style={styles.title}>{item.title}</Text>{!item.readAt ? <View accessibilityLabel="Sin leer" style={styles.unread} /> : null}</View>
            <Text style={styles.body}>{item.body}</Text>
            <Muted>{new Date(item.createdAt).toLocaleString()}</Muted>
          </View>
        </View>
        <Grid min={240} gap={12}>
          {item.notificationType === 'MEDICATION_REMINDER' ? <SecondaryButton title="Ver y confirmar toma" icon="pill" onPress={() => navigation.navigate('MedicationSchedule')} /> : null}
          {item.notificationType === 'AI_ANALYSIS_READY' ? <SecondaryButton title="Ver mis revisiones de IA" icon="creation-outline" onPress={() => {
            void (async () => {
              if (item.profileId) await selectProfile(item.profileId);
              navigation.navigate('Main', { screen: 'IA', params: { screen: 'AIHistory' } });
            })().catch((error: any) => Alert.alert('IA', error.message));
          }} /> : null}
          {!item.readAt ? <SecondaryButton title="Marcar como leído" icon="check-all" onPress={() => markRead(item.id)} /> : null}
        </Grid>
      </Card>;
    })}
    {loaded && !items.length ? <EmptyState icon="bell-check-outline" text="Aún no hay avisos." /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  read: { backgroundColor: colors.background },
  row: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { flex: 1, fontFamily: fonts.bold, color: colors.text },
  unread: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  body: { marginTop: 4, color: colors.text, lineHeight: 25 }
});
