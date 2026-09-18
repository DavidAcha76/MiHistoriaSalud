import React from 'react';
import { AppTitle, Card, Disclosure, FormError, LoadingState, Muted, Screen, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { AiResultCard } from '../components/AiResultCard';
import { apiRequest } from '../api/client';
import { useProfileResource } from '../hooks/useProfileResource';
import type { AnalysisHistory } from '../types/domain';
import { aiDate } from '../utils/ai-access';

const fetchHistory = (id: string) => apiRequest<AnalysisHistory[]>(`/profiles/${id}/ai/analyses`);
const labels = { COMPLETED: 'Completada', PROCESSING: 'En curso', REJECTED: 'No completada' };

export function AIHistoryScreen({ navigation }: any) {
  const { profileId, data: history, loading, error, refresh } = useProfileResource(fetchHistory);
  return <Screen>
    <AppTitle title="Mis revisiones" subtitle="Tus últimas 20 revisiones guardadas. Abrir un resultado no consume tu cupo." />
    <ProfileSelector />
    {loading ? <LoadingState /> : null}
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar" onPress={refresh} /></> : null}
    {!profileId ? <Card><Muted>Selecciona un perfil para consultar sus revisiones.</Muted></Card> : null}
    {history?.map((analysis) => <Card key={analysis.id}>
      <Muted>{analysis.mode === 'SCHEDULED' ? 'Revisión automática antigua' : 'Revisión solicitada'} · {labels[analysis.status]}</Muted>
      <Muted>{aiDate(analysis.createdAt)}</Muted>
      <Muted>{analysis.purpose}</Muted>
      {analysis.output ? <Disclosure title="Ver revisión completa"><AiResultCard result={analysis.output} /></Disclosure> : <Muted>{analysis.status === 'PROCESSING' ? 'La revisión está en curso.' : 'No hay un resultado disponible para este intento.'}</Muted>}
    </Card>)}
    {history && !history.length ? <Card><Muted>Aún no tienes revisiones guardadas.</Muted></Card> : null}
    <SecondaryButton title="Revisar mis registros" onPress={() => navigation.navigate('AIAnalysis')} />
  </Screen>;
}
