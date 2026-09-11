import React, { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { Card, MenuGrid, MenuTile, Muted, Screen, SectionTitle } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { nameOf, useProfiles } from '../context/ProfileContext';
import { useAuth } from '../context/AuthContext';
import type { PagedEvents, SubscriptionPlan, SymptomRecurrence } from '../types/domain';
import { colors } from '../theme/colors';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
};

export function HomeScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles();
  const { user } = useAuth();
  const [stats, setStats] = useState({ events: 0, docs: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [recurrences, setRecurrences] = useState<SymptomRecurrence[]>([]);
  const [unread, setUnread] = useState(0);
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const load = useCallback(() => {
    if (!selectedProfile) return;
    Promise.all([
      apiRequest<PagedEvents>(`/profiles/${selectedProfile.id}/events?pageSize=4`),
      apiRequest<any[]>(`/profiles/${selectedProfile.id}/documents`),
      apiRequest<SymptomRecurrence[]>(`/profiles/${selectedProfile.id}/symptom-recurrences`),
      apiRequest<any[]>('/notifications'),
      apiRequest<SubscriptionPlan>('/billing/plan')
    ]).then(([events, docs, symptomData, notifications, planData]) => {
      setStats({ events: events.total, docs: docs.length }); setRecent(events.items); setRecurrences(symptomData); setUnread(notifications.filter((item) => !item.readAt).length);
      setPlan(planData);
    }).catch(() => {});
  }, [selectedProfile?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return <Screen>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
      <View style={{ flex: 1 }}><Text style={{ color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.4 }}>CLINICSOFT</Text><Text style={{ color: colors.muted, fontSize: 14, fontWeight: '700', marginTop: 2 }}>{greeting()}</Text><Text style={{ color: colors.text, fontSize: 27, fontWeight: '900', letterSpacing: -.5 }}>{user?.fullName?.split(' ')[0] || 'usuario'}</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Abrir avisos" onPress={() => navigation.navigate('Notifications')} style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, opacity: pressed ? .75 : 1 })}><MaterialCommunityIcons name="bell-outline" size={24} color={colors.primary} />{unread ? <View style={{ position: 'absolute', right: 7, top: 6, backgroundColor: colors.danger, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>{unread > 9 ? '9+' : unread}</Text></View> : null}</Pressable>
    </View>
    <ProfileSelector />
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir plan de Clinicsoft" onPress={() => navigation.navigate('Plan')} style={({ pressed }) => ({ backgroundColor: '#F6F2FF', borderWidth: 1, borderColor: '#E3DBFF', borderRadius: 18, padding: 14, marginBottom: 14, opacity: pressed ? .82 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}><View style={{ width: 43, height: 43, borderRadius: 14, backgroundColor: '#E8DEFF', alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="crown-outline" size={24} color={colors.ai} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.ai, fontWeight: '900' }}>Plan {plan?.name || 'Clinicsoft'}</Text><Muted>{plan?.code === 'FREE' ? 'Planes mensuales simulados, sin tarjeta.' : plan?.subscription.cancelAtPeriodEnd ? `Termina el ${new Date(plan.subscription.currentPeriodEnd || '').toLocaleDateString()}.` : `Bs ${plan?.monthlyPrice}/mes · renueva el ${new Date(plan?.subscription.currentPeriodEnd || '').toLocaleDateString()}.`}</Muted></View><Text style={{ color: colors.ai, fontWeight: '900' }}>Ver</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('EventForm')} style={({ pressed }) => ({ backgroundColor: colors.primary, borderRadius: 22, padding: 18, marginBottom: 18, opacity: pressed ? .92 : 1, shadowColor: colors.primaryDark, shadowOpacity: .18, shadowRadius: 12, elevation: 4 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,.16)', alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="plus-circle-outline" size={31} color="#fff" /></View><View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>Registrar algo nuevo</Text><Text style={{ color: '#DDF4F7', marginTop: 3, lineHeight: 19 }}>Una molestia, consulta, medicamento o documento.</Text></View><MaterialCommunityIcons name="chevron-right" size={28} color="#fff" /></View>
    </Pressable>
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
      <Card style={{ flex: 1, marginBottom: 0, backgroundColor: '#EEF8F8' }}><Text style={{ fontSize: 25, fontWeight: '900', color: colors.primary }}>{stats.events}</Text><Muted>registros guardados</Muted></Card>
      <Card style={{ flex: 1, marginBottom: 0 }}><Text style={{ fontSize: 25, fontWeight: '900', color: colors.primary }}>{stats.docs}</Text><Muted>documentos privados</Muted></Card>
    </View>
    {!stats.events ? <Card style={{ backgroundColor: '#FFF7E8', borderColor: '#FFE2AE' }}><Text style={{ color: colors.text, fontWeight: '900' }}>Empieza en menos de un minuto</Text><Muted>Registra una molestia o adjunta el resultado de una consulta para comenzar tu línea de tiempo.</Muted></Card> : null}
    <SectionTitle>Acciones rápidas</SectionTitle>
    <MenuGrid>
      <MenuTile icon="timeline-text-outline" label="Historial" hint="Busca y revisa tus registros" onPress={() => navigation.navigate('Historial')} tone="primary" />
      <MenuTile icon="clipboard-text-outline" label="Para consulta" hint="Resumen claro para llevar" onPress={() => navigation.navigate('Summary')} tone="accent" />
      <MenuTile icon="file-document-multiple-outline" label="Documentos" hint="Sube y abre tus archivos" onPress={() => navigation.navigate('Documents')} tone="primary" />
      <MenuTile icon="share-variant-outline" label="Compartir" hint="Enlace temporal al consultor" onPress={() => navigation.navigate('Share')} tone="warning" />
    </MenuGrid>
    <SectionTitle>IA y seguimiento</SectionTitle>
    <MenuGrid>
      <MenuTile icon="star-four-points-outline" label="Revisión con IA" hint="Organiza datos y preguntas" onPress={() => navigation.navigate('IA')} tone="ai" />
      <MenuTile icon="message-text-outline" label="Asistente" hint="Ordena lo que quieras registrar" onPress={() => navigation.navigate('Chat')} tone="ai" />
      <MenuTile icon="crown-outline" label="Plan" hint="Uso de IA y simulación" onPress={() => navigation.navigate('Plan')} tone="warning" />
      <MenuTile icon="account-multiple-outline" label="Perfiles" hint="Tú y tus dependientes" onPress={() => navigation.navigate('Profiles')} tone="accent" />
    </MenuGrid>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}><SectionTitle>Seguimiento registrado</SectionTitle><Pressable onPress={() => navigation.navigate('Historial')}><Text style={{ color: colors.primary, fontWeight: '800' }}>Ver todo</Text></Pressable></View>
    {recurrences.length ? recurrences.slice(0, 2).map((item) => <Card key={item.symptomName} style={{ backgroundColor: '#FFF7E8', borderColor: '#FFE2AE' }}><View style={{ flexDirection: 'row', gap: 10 }}><MaterialCommunityIcons name="chart-timeline-variant-shimmer" size={23} color={colors.warning} /><View style={{ flex: 1 }}><Text style={{ fontWeight: '900', color: colors.text }}>{item.symptomName}</Text><Muted>{item.occurrences} registros entre {item.firstRecordedAt} y {item.lastRecordedAt}. Es un conteo, no una evaluación médica.</Muted></View></View></Card>) : <Card><Muted>Cuando registres una misma molestia dos o más veces, verás aquí un conteo cronológico.</Muted></Card>}
    <SectionTitle>Actividad reciente</SectionTitle>
    {recent.length ? recent.map((event) => <Pressable key={event.id} onPress={() => navigation.navigate('EventDetail', { eventId: event.id })} style={({ pressed }) => ({ opacity: pressed ? .75 : 1 })}><Card><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="heart-pulse" size={19} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>{event.title}</Text><Muted>{event.eventDate} · {event.eventType}</Muted></View><MaterialCommunityIcons name="chevron-right" size={22} color={colors.muted} /></View></Card></Pressable>) : <Card><Muted>Aún no hay actividad para {selectedProfile ? nameOf(selectedProfile) : 'este perfil'}.</Muted></Card>}
  </Screen>;
}
