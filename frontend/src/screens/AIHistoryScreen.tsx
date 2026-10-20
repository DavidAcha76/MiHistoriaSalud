import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppTitle, Card, Disclosure, EmptyState, FormError, IconBadge, LoadingState, Muted, Pill, Screen, SecondaryButton, type IconName, type Tone } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { AiResultCard } from '../components/AiResultCard';
import { apiRequest } from '../api/client';
import { useProfileResource } from '../hooks/useProfileResource';
import type { AnalysisHistory } from '../types/domain';
import { aiDate } from '../utils/ai-access';
import { focusLabels, readableDate } from '../utils/presentation';
import { colors, fonts } from '../theme/colors';

const fetchHistory = (id: string) => apiRequest<AnalysisHistory[]>(`/profiles/${id}/ai/analyses`);
const labels = { COMPLETED: 'Completada', PROCESSING: 'En curso', REJECTED: 'No completada' };
const looks: Record<AnalysisHistory['status'], [IconName, Tone]> = { COMPLETED: ['check-decagram-outline', 'primary'], PROCESSING: ['progress-clock', 'ai'], REJECTED: ['close-octagon-outline', 'danger'] };

export function AIHistoryScreen({ navigation }: any) {
  const { profileId, data: history, loading, error, refresh } = useProfileResource(fetchHistory);
  return <Screen>
    <AppTitle eyebrow="Historial de IA" title="Mis revisiones" subtitle="Tus últimas 20 revisiones guardadas. Abrir un resultado no consume tu cupo." />
    <ProfileSelector />
    {loading ? <LoadingState /> : null}
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar" icon="refresh" onPress={refresh} /></> : null}
    {!profileId ? <Card><Muted>Selecciona un perfil para consultar sus revisiones.</Muted></Card> : null}
    {history?.map((analysis) => {
      const [icon, tone] = looks[analysis.status] || looks.PROCESSING;
      return <Card key={analysis.id}>
        <View style={styles.heading}>
          <IconBadge icon={icon} tone={tone} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.purpose}>{analysis.purpose}</Text>
            <Muted>{aiDate(analysis.createdAt)}</Muted>
          </View>
        </View>
        <View style={styles.pills}>
          <Pill label={labels[analysis.status]} tone={tone} />
          <Pill label={analysis.mode === 'SCHEDULED' ? 'Revisión automática antigua' : 'Revisión solicitada'} tone="neutral" />
          {analysis.focus ? <Pill label={focusLabels[analysis.focus] || analysis.focus} tone="ai" /> : null}
        </View>
        {analysis.selectedEvents?.length ? <Disclosure title={`Registros incluidos (${analysis.selectedEvents.length})`}>
          {analysis.selectedEvents.map((event) => <View key={event.id} style={styles.included}><View style={styles.dot} /><View style={{ flex: 1 }}><Text style={{ fontFamily: fonts.semibold }}>{event.title}</Text>{event.eventDate ? <Muted>{readableDate(event.eventDate)}</Muted> : null}</View></View>)}
          <Muted>Solo estos registros se enviaron al servicio de IA para esta revisión.</Muted>
        </Disclosure> : null}
        {analysis.output ? <Disclosure title="Ver revisión completa"><AiResultCard result={{ ...analysis.output, createdAt: analysis.createdAt, purpose: analysis.purpose, focus: analysis.focus || undefined, selectedCount: analysis.selectedCount }} /></Disclosure> : <Muted>{analysis.status === 'PROCESSING' ? 'La revisión está en curso.' : 'No hay un resultado disponible para este intento.'}</Muted>}
      </Card>;
    })}
    {history && !history.length ? <EmptyState icon="creation-outline" tone="ai" text="Aún no tienes revisiones guardadas." /> : null}
    <SecondaryButton title="Revisar mis registros" icon="text-box-search-outline" onPress={() => navigation.navigate('AIAnalysis')} />
  </Screen>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  purpose: { fontFamily: fonts.bold },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  included: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 11, backgroundColor: colors.ai }
});
