import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { apiRequest } from '../api/client';
import { AppTitle, Card, FormError, Grid, IconBadge, Muted, Pill, PrimaryButton, Screen, SectionTitle, SecondaryButton, useGridColumns } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfileResource } from '../hooks/useProfileResource';
import type { PlanCode, PlanStatus } from '../types/domain';
import { colors, fonts } from '../theme/colors';

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
      Alert.alert('Plan actualizado', response.message);
      await load();
    } catch (error: any) { Alert.alert('No se pudo activar', error.message); } finally { setBusy(null); }
  }

  function confirmActivation(plan: typeof plans[number]) {
    if (plan.code === 'FREE') return;
    const upgrade = plan.monthlyPrice > (status?.plan.monthlyPrice || 0);
    const benefits = upgrade
      ? 'Tendrás un análisis disponible de inmediato y el cupo completo de chat del nuevo plan. Los cupos semanales siguen renovándose los lunes a las 00:00 de Bolivia, sin acumularse.'
      : 'Al bajar de plan se conserva el consumo de IA; el cambio no entrega un cupo nuevo.';
    Alert.alert(`Activar ${plan.title}`, `Simularás un ciclo mensual de ${price(plan.monthlyPrice)}. No se pedirá tarjeta ni se realizará cobro alguno. El ciclo comienza hoy y podrás cancelarlo para que termine al finalizar el mes. ${benefits}`, [
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

  const infoColumns = useGridColumns(300) > 1;
  const planColumns = useGridColumns(280) > 1;
  const activePlan = status?.plan;
  const hasPaidPlan = activePlan?.code === 'SILVER' || activePlan?.code === 'GOLD';

  return <Screen>
    <AppTitle eyebrow="Suscripción simulada" title="Plan de Clinia" subtitle="Elige un plan visible y simple. Los montos, ciclos y renovaciones que ves aquí son una simulación mensual." />
    <ProfileSelector />
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar el plan" icon="refresh" onPress={load} /></> : null}
    {activePlan ? <Card tone="hero">
      <View style={styles.currentHeading}>
        <IconBadge icon={activePlan.code === 'GOLD' ? 'crown-outline' : activePlan.code === 'SILVER' ? 'medal-outline' : 'leaf-circle-outline'} tone={activePlan.code === 'GOLD' ? 'warning' : 'primary'} size={52} />
        <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.currentName}>Plan {activePlan.name}</Text><Muted>{price(activePlan.monthlyPrice)} · Simulación sin cobro</Muted></View>
      </View>
      {hasPaidPlan ? <>
        <Muted>Período actual: {formatDate(activePlan.subscription.currentPeriodStart)} — {formatDate(activePlan.subscription.currentPeriodEnd)}</Muted>
        <Muted>{activePlan.subscription.cancelAtPeriodEnd ? `Cancelación programada para el ${formatDate(activePlan.subscription.currentPeriodEnd)}.` : `Renovación mensual simulada el ${formatDate(activePlan.subscription.currentPeriodEnd)}.`}</Muted>
      </> : <Muted>Estás usando el plan gratuito. Puedes activar un mes simulado de Plata u Oro cuando quieras.</Muted>}
    </Card> : !error ? <Card><Muted>{profileId ? 'Cargando el plan…' : 'Selecciona un perfil para consultar tu plan.'}</Muted></Card> : null}

    <SectionTitle>Planes mensuales simulados</SectionTitle>
    <Grid min={300}>
      <Card tone="ai" style={infoColumns && styles.stretch}><View style={styles.infoHeading}><MaterialCommunityIcons name="credit-card-off-outline" size={22} color={colors.ai} /><Text style={{ color: colors.ai, fontWeight: '900', flex: 1 }}>Sin tarjeta ni pasarela de pago</Text></View><Muted>Al activar un plan se crea un mes simulado. La fecha de renovación y la cancelación se comportan como una suscripción, pero no hay cobro real.</Muted></Card>
      <Card style={infoColumns && styles.stretch}><View style={styles.infoHeading}><MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={22} color={colors.primary} /><Text style={{ fontWeight: '900', flex: 1 }}>Beneficios al subir de plan</Text></View><Muted>Pasar de Gratis a Plata u Oro, o de Plata a Oro, habilita un análisis inmediato y el cupo completo de chat de ese plan para cada perfil. Seleccionar el mismo plan, bajar de plan o cancelar y reanudar no repone el consumo. Volver a Gratis conserva los usos de la semana.</Muted></Card>
    </Grid>
    <Grid min={280}>{plans.map((plan) => {
      const current = activePlan?.code === plan.code;
      const tone = plan.code === 'GOLD' ? 'warning' : plan.code === 'SILVER' ? 'accent' : 'primary';
      return <Card key={plan.code} style={[styles.planCard, planColumns && styles.stretch, current && styles.planCurrent]}>
        <View style={styles.planHeading}><IconBadge icon={plan.icon} tone={tone} size={50} />{current ? <Pill label="ACTUAL" icon="check" /> : null}</View>
        <Text style={styles.planTitle}>{plan.title}</Text>
        <Text style={styles.planPrice}>{price(plan.monthlyPrice)}</Text>
        <View style={styles.benefits}>{plan.benefits.map((benefit) => <View key={benefit} style={styles.benefit}><MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.primary} /><Muted style={{ flex: 1 }}>{benefit}</Muted></View>)}</View>
        {plan.code === 'FREE' ? <SecondaryButton title={activePlan?.code === 'FREE' ? 'Plan actual' : 'Incluido sin costo'} onPress={() => {}} disabled /> : <PrimaryButton title={busy === plan.code ? 'Activando…' : current ? 'Plan actual' : `Simular ${plan.title} por ${price(plan.monthlyPrice)}`} disabled={!activePlan || Boolean(busy) || activePlan.code === plan.code} loading={busy === plan.code} onPress={() => confirmActivation(plan)} />}
      </Card>;
    })}</Grid>

    <SectionTitle>Administrar suscripción</SectionTitle>
    {hasPaidPlan ? <Card tone={activePlan?.subscription.cancelAtPeriodEnd ? 'warning' : undefined}>
      <Text style={{ color: colors.text, fontWeight: '900' }}>{activePlan?.subscription.cancelAtPeriodEnd ? 'Tu cancelación está programada' : '¿Quieres cancelar este plan?'}</Text>
      <Muted>{activePlan?.subscription.cancelAtPeriodEnd ? `Mantendrás ${activePlan?.name} hasta el ${formatDate(activePlan?.subscription.currentPeriodEnd || null)}. Puedes reanudar antes de esa fecha.` : 'Cancelar no reduce tus beneficios inmediatamente: el cambio a Gratis ocurre al cerrar el período mensual simulado.'}</Muted>
      {activePlan?.subscription.cancelAtPeriodEnd ? <PrimaryButton title={busy === 'resume' ? 'Reanudando…' : 'Reanudar renovación simulada'} onPress={resumePlan} loading={busy === 'resume'} disabled={Boolean(busy)} /> : <PrimaryButton title={busy === 'cancel' ? 'Programando…' : 'Cancelar plan al finalizar el período'} onPress={confirmCancellation} loading={busy === 'cancel'} disabled={Boolean(busy)} danger />}
    </Card> : <Card><Text style={{ color: colors.text, fontWeight: '900' }}>No tienes un plan de pago activo</Text><Muted>El plan Gratis no se cobra y no requiere cancelación.</Muted></Card>}

    <SecondaryButton title="Ir al centro de IA: uso y permisos" icon="creation-outline" onPress={() => navigation.navigate('Main', { screen: 'IA', params: { screen: 'AICenter' } })} />
  </Screen>;
}

const styles = StyleSheet.create({
  currentHeading: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 6 },
  currentName: { color: colors.primary, fontFamily: fonts.bold, fontSize: 20, lineHeight: 28 },
  stretch: { flex: 1 },
  infoHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  planCard: { gap: 4 },
  planCurrent: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  planHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 },
  planTitle: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 29, color: colors.text },
  planPrice: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, letterSpacing: -0.4, color: colors.primary },
  benefits: { gap: 8, marginTop: 10, marginBottom: 8, flexGrow: 1 },
  benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 }
});
