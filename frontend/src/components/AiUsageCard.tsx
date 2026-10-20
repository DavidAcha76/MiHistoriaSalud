import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from './AppText';
import { Card, Grid, IconBadge, Muted, ProgressBar, type IconName } from './ui';
import type { PlanStatus } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { aiDate } from '../utils/ai-access';
import { useAiQuotaRefresh } from '../hooks/useAiQuotaRefresh';

function Meter({ icon, title, value, detail, ratio }: { icon: IconName; title: string; value: string; detail: string; ratio?: number }) {
  return <View style={styles.meter}>
    <View style={styles.meterHeading}><MaterialCommunityIcons name={icon} size={20} color={colors.ai} /><Text style={styles.meterTitle}>{title}</Text></View>
    <Text style={styles.meterValue}>{value}</Text>
    {ratio != null ? <ProgressBar value={ratio} tone="ai" label={`${title}: ${value}`} /> : null}
    <Muted>{detail}</Muted>
  </View>;
}

export function AiUsageCard({ status, onRenew }: { status: PlanStatus; onRenew?: () => Promise<void> }) {
  useAiQuotaRefresh(status, onRenew);
  const analysisLimit = status.analysis.limit;
  const analysisLeft = analysisLimit != null ? Math.max(0, analysisLimit - (status.analysis.usedThisWeek || 0)) : null;
  const chatLeft = status.chat.limit ? Math.max(0, status.chat.limit - status.chat.usedThisWeek) : null;
  return <Card tone="ai">
    <View style={styles.header}>
      <IconBadge icon="creation" tone="ai" size={50} />
      <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.plan}>Plan {status.plan.name}</Text><Muted>{status.quotaScope === 'ACCOUNT' ? 'Cupo de la cuenta, compartido entre perfiles' : 'Uso de IA de este perfil'} · Suscripción simulada</Muted></View>
    </View>
    <Grid min={250} gap={12}>
      <Meter icon="text-box-search-outline" title="Revisiones" value={analysisLimit != null ? `${analysisLeft} de ${analysisLimit} análisis disponibles esta semana` : `Una revisión cada ${status.analysis.everyDays} días`} detail={status.analysis.availableNow ? 'Tienes una revisión disponible.' : `Próxima revisión: ${aiDate(status.analysis.nextAnalysisAt)}`} ratio={analysisLimit ? (analysisLeft || 0) / analysisLimit : undefined} />
      <Meter icon="chat-processing-outline" title="Asistente" value={status.chat.limit === 0 ? 'Chat no incluido' : status.chat.limit == null ? 'Chat sin cuota funcional' : `${chatLeft} de ${status.chat.limit} mensajes disponibles`} detail={status.chat.limit == null ? `${status.chat.usedThisWeek} mensajes esta semana. Se mantienen los límites de uso razonable.` : `Renovación semanal: ${aiDate(status.chat.resetsAt)}`} ratio={status.chat.limit ? (chatLeft || 0) / status.chat.limit : undefined} />
    </Grid>
    <View style={styles.note}><MaterialCommunityIcons name="calendar-refresh-outline" size={20} color={colors.muted} /><Muted style={{ flex: 1 }}>Los cupos semanales se renuevan cada lunes a las 00:00 de Bolivia. Los usos no consumidos no se acumulan.</Muted></View>
    {status.service?.mode === 'demo' ? <Text style={styles.warning}>Modo demostración · Respuestas simuladas</Text> : null}
    {!status.service?.available ? <Text style={styles.warning}>El servicio de IA aún no está disponible. Puedes consultar tus revisiones guardadas.</Text> : null}
  </Card>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
  plan: { color: colors.ai, fontFamily: fonts.bold, fontSize: 21, lineHeight: 29 },
  meter: { gap: 8, padding: 14, marginBottom: 12, borderRadius: 16, backgroundColor: 'rgba(12, 27, 36, 0.45)', borderWidth: 1, borderColor: '#3A4B69' },
  meterHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meterTitle: { color: colors.ai, fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, letterSpacing: 0.4, textTransform: 'uppercase' },
  meterValue: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 25 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 2 },
  warning: { color: colors.warning, marginTop: 12 }
});
