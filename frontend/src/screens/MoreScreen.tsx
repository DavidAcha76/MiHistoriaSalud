import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, MenuGrid, MenuTile, Muted, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useAuth } from '../context/AuthContext';
import type { SubscriptionPlan } from '../types/domain';
import { colors } from '../theme/colors';

const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('es-BO', { day: 'numeric', month: 'short' }) : '—';

export function MoreScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [plan, setPlan] = useState<SubscriptionPlan | null>(null);
  const loadPlan = useCallback(() => { apiRequest<SubscriptionPlan>('/billing/plan').then(setPlan).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { loadPlan(); }, [loadPlan]));
  const confirmLogout = () => Alert.alert('Cerrar sesión', 'Tendrás que iniciar sesión para volver a acceder a tus datos.', [
    { text: 'Cancelar', style: 'cancel' }, { text: 'Cerrar sesión', style: 'destructive', onPress: logout }
  ]);
  const hasPaidPlan = plan?.code === 'SILVER' || plan?.code === 'GOLD';
  const planDetail = !plan ? 'Consulta tu plan mensual' : plan.subscription.cancelAtPeriodEnd ? `Termina el ${formatDate(plan.subscription.currentPeriodEnd)}` : hasPaidPlan ? `Renueva el ${formatDate(plan.subscription.currentPeriodEnd)}` : 'Plan sin costo mensual';

  return <Screen>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="account-heart-outline" size={26} color={colors.primary} /></View>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{user?.fullName || 'Tu cuenta'}</Text><Muted>{user?.email}</Muted></View>
    </View>
    <ProfileSelector />
    <Pressable accessibilityRole="button" accessibilityLabel="Abrir plan y facturación" onPress={() => navigation.navigate('Plan')} style={({ pressed }) => ({ backgroundColor: '#F6F2FF', borderColor: '#E3DBFF', borderWidth: 1, borderRadius: 18, padding: 15, marginBottom: 12, opacity: pressed ? .8 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><View style={{ width: 46, height: 46, borderRadius: 15, backgroundColor: '#E8DEFF', alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="crown-outline" size={25} color={colors.ai} /></View><View style={{ flex: 1 }}><Text style={{ color: colors.ai, fontWeight: '900', fontSize: 16 }}>Plan {plan?.name || 'Clinicsoft'}</Text><Muted>{planDetail} · simulación mensual</Muted></View><MaterialCommunityIcons name="chevron-right" size={24} color={colors.ai} /></View>
    </Pressable>
    <AppTitle title="Más opciones" subtitle="Gestiona tus datos, perfiles, plan y herramientas de consulta." />
    <SectionTitle>Tu información</SectionTitle>
    <MenuGrid>
      <MenuTile icon="file-document-multiple-outline" label="Documentos" hint="PDF e imágenes privadas" onPress={() => navigation.navigate('Documents')} tone="primary" />
      <MenuTile icon="account-multiple-outline" label="Perfiles" hint="Tú y tus dependientes" onPress={() => navigation.navigate('Profiles')} tone="accent" />
      <MenuTile icon="share-variant-outline" label="Compartir" hint="Paquete temporal para consulta" onPress={() => navigation.navigate('Share')} tone="warning" />
      <MenuTile icon="download-box-outline" label="Exportar datos" hint="Descarga una copia personal" onPress={() => navigation.navigate('Share')} tone="primary" />
    </MenuGrid>
    <SectionTitle>IA y seguimiento</SectionTitle>
    <MenuGrid>
      <MenuTile icon="crown-outline" label="Plan" hint={plan ? `${plan.name} · ${hasPaidPlan ? `Bs ${plan.monthlyPrice}/mes` : 'sin costo'}` : 'Planes mensuales simulados'} onPress={() => navigation.navigate('Plan')} tone="warning" />
      <MenuTile icon="message-text-outline" label="Asistente" hint="Organiza tu información" onPress={() => navigation.navigate('Chat')} tone="ai" />
      <MenuTile icon="bell-outline" label="Avisos" hint="Revisiones automáticas" onPress={() => navigation.navigate('Notifications')} tone="accent" />
      <MenuTile icon="clipboard-text-outline" label="Para consulta" hint="Resumen estructurado" onPress={() => navigation.navigate('Summary')} tone="primary" />
    </MenuGrid>
    <SectionTitle>Configuración</SectionTitle>
    <Card><View style={{ flexDirection: 'row', gap: 10 }}><MaterialCommunityIcons name="credit-card-sync-outline" size={24} color={colors.primary} /><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: '900' }}>Plan y facturación</Text><Muted>{hasPaidPlan ? `Tu ciclo simulado ${plan?.subscription.cancelAtPeriodEnd ? 'termina' : 'se renueva'} el ${formatDate(plan?.subscription.currentPeriodEnd || null)}.` : 'Explora los planes mensuales simulados sin tarjeta.'}</Muted></View></View><SecondaryButton title="Administrar plan" onPress={() => navigation.navigate('Plan')} />{hasPaidPlan && !plan?.subscription.cancelAtPeriodEnd ? <SecondaryButton title="Cancelar plan" onPress={() => navigation.navigate('Plan')} /> : null}</Card>
    <Card style={{ backgroundColor: '#F6F2FF', borderColor: '#E3DBFF' }}><Text style={{ color: colors.ai, fontWeight: '900' }}>Tu información sigue bajo tu control</Text><Muted>La IA solo procesa un perfil con consentimiento y sus resultados no sustituyen a un profesional de salud.</Muted></Card>
    <SecondaryButton title="Cerrar sesión" onPress={confirmLogout} />
  </Screen>;
}
