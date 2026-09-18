import React from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from './AppText';
import { Card, Muted } from './ui';
import type { PlanStatus } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { aiDate } from '../utils/ai-access';
import { useAiQuotaRefresh } from '../hooks/useAiQuotaRefresh';

export function AiUsageCard({ status, onRenew }: { status: PlanStatus; onRenew?: () => Promise<void> }) {
  useAiQuotaRefresh(status, onRenew);
  return <Card style={{ backgroundColor: colors.aiSoft, borderColor: colors.ai }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <MaterialCommunityIcons name="creation" size={30} color={colors.ai} />
      <View style={{ flex: 1 }}><Text style={{ color: colors.ai, fontFamily: fonts.bold, fontSize: 20 }}>Plan {status.plan.name}</Text><Muted>{status.quotaScope === 'ACCOUNT' ? 'Cupo de la cuenta, compartido entre perfiles' : 'Uso de IA de este perfil'} · Suscripción simulada</Muted></View>
    </View>
    <Text style={{ fontFamily: fonts.bold }}>{status.analysis.limit != null ? `${Math.max(0, status.analysis.limit - (status.analysis.usedThisWeek || 0))} de ${status.analysis.limit} análisis disponibles esta semana` : `Una revisión cada ${status.analysis.everyDays} días`}</Text>
    <Muted>{status.analysis.availableNow ? 'Tienes una revisión disponible.' : `Próxima revisión: ${aiDate(status.analysis.nextAnalysisAt)}`}</Muted>
    <Text style={{ fontFamily: fonts.bold, marginTop: 12 }}>{status.chat.limit === 0 ? 'Chat no incluido' : status.chat.limit == null ? 'Chat sin cuota funcional' : `${Math.max(0, status.chat.limit - status.chat.usedThisWeek)} de ${status.chat.limit} mensajes disponibles`}</Text>
    <Muted>{status.chat.limit == null ? `${status.chat.usedThisWeek} mensajes esta semana. Se mantienen los límites de uso razonable.` : `Renovación semanal: ${aiDate(status.chat.resetsAt)}`}</Muted>
    <Muted>Los cupos semanales se renuevan cada lunes a las 00:00 de Bolivia. Los usos no consumidos no se acumulan.</Muted>
    {status.service?.mode === 'demo' ? <Text style={{ color: colors.warning, marginTop: 12 }}>Modo demostración · Respuestas simuladas</Text> : null}
    {!status.service?.available ? <Text style={{ color: colors.warning, marginTop: 12 }}>El servicio de IA aún no está disponible. Puedes consultar tus revisiones guardadas.</Text> : null}
  </Card>;
}
