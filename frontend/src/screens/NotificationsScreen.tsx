import React, { useCallback, useState } from 'react';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Muted, Screen, SecondaryButton } from '../components/ui';
import { colors } from '../theme/colors';

type Notification = { id: string; title: string; body: string; createdAt: string; readAt?: string | null; notificationType?: string };

export function NotificationsScreen({ navigation }: any) {
  const [items, setItems] = useState<Notification[]>([]);
  const load = useCallback(() => {
    apiRequest<Notification[]>('/notifications').then(setItems).catch((error: any) => Alert.alert('Avisos', error.message));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function markRead(id: string) {
    try { await apiRequest(`/notifications/${id}/read`, { method: 'PATCH' }); load(); }
    catch (error: any) { Alert.alert('Avisos', error.message); }
  }
  return <Screen>
    <AppTitle title="Avisos" subtitle="Aquí aparecen revisiones y recordatorios de medicamentos cuando llega su horario." />
    {items.map((item) => <Card key={item.id} style={{ opacity: item.readAt ? .7 : 1 }}>
      <Text style={{ fontWeight: '900', color: colors.text }}>{item.title}</Text>
      <Text style={{ marginTop: 5, color: colors.text, lineHeight: 25 }}>{item.body}</Text>
      <Muted>{new Date(item.createdAt).toLocaleString()}</Muted>
      {item.notificationType === 'MEDICATION_REMINDER' ? <SecondaryButton title="Ver y confirmar toma" onPress={() => navigation.navigate('MedicationSchedule')} /> : null}
      {!item.readAt ? <SecondaryButton title="Marcar como leído" onPress={() => markRead(item.id)} /> : null}
    </Card>)}
    {!items.length ? <Card><Muted>Aún no hay avisos.</Muted></Card> : null}
  </Screen>;
}
