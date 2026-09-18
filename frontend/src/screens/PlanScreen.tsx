import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { AppTitle, Card, FormError, Muted, PrimaryButton, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfileResource } from '../hooks/useProfileResource';
import type { PlanCode, PlanStatus } from '../types/domain';
import { colors } from '../theme/colors';

const plans: Array<{ code: PlanCode; title: string; monthlyPrice: number; icon: keyof typeof MaterialCommunityIcons.glyphMap; benefits: string[] }> = [
  { code: 'FREE', title: 'Gratis', monthlyPrice: 0, icon: 'leaf-circle-outline', benefits: ['1 análisis informativo y 10 mensajes por semana por cuenta', 'Renovación los lunes a las 00:00 de Bolivia; no acumulables'] },
  { code: 'SILVER', title: 'Plata', monthlyPrice: 19, icon: 'medal-outline', benefits: ['Una revisión informativa cada 7 días', '10 mensajes con el asistente por semana'] },
  { code: 'GOLD', title: 'Oro', monthlyPrice: 39, icon: 'crown-outline', benefits: ['Una revisión informativa cada 3 días', 'Chat sin cuota funcional, con uso razonable y seguro'] }
];

const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const price = (amount: number) => amount ? `Bs ${amount}/mes` : 'Sin costo';

const fetchStatus = (id: string) => apiRequest<PlanStatus>(`/profiles/${id}/ai/status`);

export function PlanScreen({ navigation }: any) {
  const { profileId, data: status, error, refresh: load } = useProfileResource(fetchStatus);
  const [busy, setBusy] = useState<string | null>(null);

  async function activate(planCode: Exclude<PlanCode, 'FREE'>) {
    setBusy(planCode);
    try {
      const response = await apiRequest<{ message: string }>('/billing/simulate-checkout', { method: 'POST', body: JSON.stringify({ planCode }) });
      Alert.alert('Mes simulado activado', response.message);
      load();
    } catch (error: any) { Alert.alert('No se pudo activar', error.message); } finally { setBusy(null); }
  }

  function confirmActivation(plan: typeof plans[number]) {
    if (plan.code === 'FREE') return;
    Alert.alert(`Activar ${plan.title}`, `Simularás un ciclo mensual de ${price(plan.monthlyPrice)}. No se pedirá tarjeta ni se realizará cobro alguno. El ciclo comienza hoy y podrás cancelarlo para que termine al finalizar el mes.`, [
      { text: 'Volver', style: 'cancel' },
      { text: 'Activar sin cobro', onPress: () => activate(plan.code as Exclude<PlanCode, 'FREE'>) }
    ]);
  }

  function confirmCancellation() {
    const end = formatDate(status?.plan.subscription.currentPeriodEnd || null);
    Alert.alert('¿Cancelar el plan?', `No perderás tus beneficios hoy. Tu plan seguirá activo hasta el ${end} y luego pasará a Gratis. Esta simulación no genera reembolsos ni cobros.`, [
      { text: 'Mantener plan', style: 'cancel' },
      { text: 'Cancelar al finalizar', style: 'destructive', onPress: () => cancelPlan() }
    ]);
  }

  async function cancelPlan() {
    setBusy('cancel');
    try {
      const response = await apiRequest<{ message: string }>('/billing/cancel', { method: 'POST' });
      Alert.alert('Cancelación programada', response.message);
      load();
    } catch (error: any) { Alert.alert('No se pudo cancelar', error.message); } finally { setBusy(null); }
  }

  async function resumePlan() {
    setBusy('resume');
    try {
      const response = await apiRequest<{ message: string }>('/billing/resume', { method: 'POST' });
      Alert.alert('Plan reanudado', response.message);
      load();
    } catch (error: any) { Alert.alert('No se pudo reanudar', error.message); } finally { setBusy(null); }
  }

  const activePlan = status?.plan;
  const hasPaidPlan = activePlan?.code === 'SILVER' || activePlan?.code === 'GOLD';

  return <Screen>
    <AppTitle title="Plan de Clinia" subtitle="Elige un plan visible y simple. Los montos, ciclos y renovaciones que ves aquí son una simulación mensual." />
    <ProfileSelector />
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar el plan" onPress={load} /></> : null}
    {activePlan ? <Card style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name={activePlan.code === 'GOLD' ? 'crown-outline' : activePlan.code === 'SILVER' ? 'medal-outline' : 'leaf-circle-outline'} size={26} color={colors.primary} /></View>
        <View style={{ flex: 1 }}><Text style={{ color: colors.primary, fontWeight: '900', fontSize: 18 }}>Plan {activePlan.name}</Text><Muted>{price(activePlan.monthlyPrice)} · Simulación sin cobro</Muted></View>
      </View>
      {hasPaidPlan ? <>
        <Muted>Período actual: {formatDate(activePlan.subscription.currentPeriodStart)} — {formatDate(activePlan.subscription.currentPeriodEnd)}</Muted>
        <Muted>{activePlan.subscription.cancelAtPeriodEnd ? `Cancelación programada para el ${formatDate(activePlan.subscription.currentPeriodEnd)}.` : `Renovación mensual simulada el ${formatDate(activePlan.subscription.currentPeriodEnd)}.`}</Muted>
      </> : <Muted>Estás usando el plan gratuito. Puedes activar un mes simulado de Plata u Oro cuando quieras.</Muted>}
    </Card> : !error ? <Card><Muted>{profileId ? 'Cargando el plan…' : 'Selecciona un perfil para consultar tu plan.'}</Muted></Card> : null}

    <SectionTitle>Planes mensuales simulados</SectionTitle>
    <Card style={{ backgroundColor: colors.aiSoft, borderColor: colors.ai }}><Text style={{ color: colors.ai, fontWeight: '900' }}>Sin tarjeta ni pasarela de pago</Text><Muted>Al activar un plan se crea un mes simulado. La fecha de renovación y la cancelación se comportan como una suscripción, pero no hay cobro real.</Muted></Card>
    {plans.map((plan) => <Card key={plan.code} style={{ borderColor: activePlan?.code === plan.code ? colors.primary : colors.border, backgroundColor: activePlan?.code === plan.code ? colors.primarySoft : colors.surface }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><MaterialCommunityIcons name={plan.icon} size={26} color={plan.code === 'GOLD' ? colors.warning : colors.primary} /><View style={{ flex: 1 }}><Text style={{ fontSize: 19, fontWeight: '900', color: colors.text }}>{plan.title}</Text><Text style={{ color: colors.primary, fontWeight: '900', marginTop: 1 }}>{price(plan.monthlyPrice)}</Text></View>{activePlan?.code === plan.code ? <Text style={{ color: colors.primary, fontWeight: '900' }}>ACTUAL</Text> : null}</View>
      {plan.benefits.map((benefit) => <Muted key={benefit}>• {benefit}</Muted>)}
      {plan.code === 'FREE' ? <SecondaryButton title={activePlan?.code === 'FREE' ? 'Plan actual' : 'Incluido sin costo'} onPress={() => {}} disabled /> : <PrimaryButton title={busy === plan.code ? 'Activando…' : activePlan?.code === plan.code ? 'Plan actual' : `Simular ${plan.title} por ${price(plan.monthlyPrice)}`} disabled={activePlan?.code === plan.code} loading={busy === plan.code} onPress={() => confirmActivation(plan)} />}
    </Card>)}

    <SectionTitle>Administrar suscripción</SectionTitle>
    {hasPaidPlan ? <Card style={{ borderColor: activePlan?.subscription.cancelAtPeriodEnd ? colors.warning : colors.border, backgroundColor: activePlan?.subscription.cancelAtPeriodEnd ? colors.warningSoft : colors.surface }}>
      <Text style={{ color: colors.text, fontWeight: '900' }}>{activePlan?.subscription.cancelAtPeriodEnd ? 'Tu cancelación está programada' : '¿Quieres cancelar este plan?'}</Text>
      <Muted>{activePlan?.subscription.cancelAtPeriodEnd ? `Mantendrás ${activePlan?.name} hasta el ${formatDate(activePlan?.subscription.currentPeriodEnd || null)}. Puedes reanudar antes de esa fecha.` : 'Cancelar no reduce tus beneficios inmediatamente: el cambio a Gratis ocurre al cerrar el período mensual simulado.'}</Muted>
      {activePlan?.subscription.cancelAtPeriodEnd ? <PrimaryButton title={busy === 'resume' ? 'Reanudando…' : 'Reanudar renovación simulada'} onPress={resumePlan} loading={busy === 'resume'} /> : <PrimaryButton title={busy === 'cancel' ? 'Programando…' : 'Cancelar plan al finalizar el período'} onPress={confirmCancellation} loading={busy === 'cancel'} danger />}
    </Card> : <Card><Text style={{ color: colors.text, fontWeight: '900' }}>No tienes un plan de pago activo</Text><Muted>El plan Gratis no se cobra y no requiere cancelación.</Muted></Card>}

    <SecondaryButton title="Ir al centro de IA: uso y permisos" onPress={() => navigation.navigate('Main', { screen: 'IA', params: { screen: 'AICenter' } })} />
  </Screen>;
}
