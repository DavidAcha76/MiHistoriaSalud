import React, { useRef, useState } from 'react';
import { AppAlert as Alert } from '../utils/alerts';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Field, FormError, LoadingState, Muted, PrimaryButton, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { AiUsageCard } from '../components/AiUsageCard';
import { AiResultCard } from '../components/AiResultCard';
import { AiRecordSelector } from '../components/AiRecordSelector';
import { useProfiles } from '../context/ProfileContext';
import { useProfileResource } from '../hooks/useProfileResource';
import type { AiResult, PlanStatus } from '../types/domain';
import { aiBlockedReason } from '../utils/ai-access';

const fetchAnalysisData = (id: string) => apiRequest<PlanStatus>(`/profiles/${id}/ai/status`).then((status) => ({ status }));

export function AIScreen(props: any) {
  const { selectedProfile } = useProfiles();
  return <AnalysisForProfile key={selectedProfile?.id || 'none'} {...props} />;
}

function AnalysisForProfile({ navigation }: any) {
  const { profileId, data, error, loading: fetching, refresh } = useProfileResource(fetchAnalysisData);
  const [selected, setSelected] = useState<string[]>([]);
  const [purpose, setPurpose] = useState('Preparar una revisión informativa de los registros seleccionados');
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const reason = aiBlockedReason(data?.status || null, 'analysis');
  const canAnalyze = Boolean(profileId && data && !reason && !loading);
  async function analyze() {
    if (!profileId || !canAnalyze || !selected.length || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      setResult(await apiRequest<AiResult>(`/profiles/${profileId}/ai/analyze`, { method: 'POST', body: JSON.stringify({ eventIds: selected, purpose: purpose.trim() }) }));
      setSelected([]);
    } catch (error: any) { Alert.alert('Revisión no disponible', error.message); }
    finally { await refresh(); setLoading(false); inFlight.current = false; }
  }
  return <Screen>
    <AppTitle title="Revisar mis registros" subtitle="Elige la información que quieres resumir y las preguntas que quieres preparar para tu consulta." />
    <ProfileSelector />
    {fetching ? <LoadingState /> : null}
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar" onPress={refresh} /></> : null}
    {data ? <AiUsageCard status={data.status} onRenew={refresh} /> : null}
    {!profileId ? <Card><Muted>Selecciona un perfil para revisar sus registros.</Muted></Card> : null}
    {data && reason ? <Card><Muted>{reason}</Muted><SecondaryButton title="Ir al centro de IA" onPress={() => navigation.navigate('AICenter')} /></Card> : null}
    {result ? <><SectionTitle>Tu revisión</SectionTitle><AiResultCard result={result} /></> : null}
    <Field label="Finalidad de la revisión" value={purpose} onChangeText={setPurpose} maxLength={300} hint="Entre 3 y 300 caracteres." editable={canAnalyze} />
    <SectionTitle>Selecciona registros</SectionTitle>
    {profileId ? <AiRecordSelector profileId={profileId} selected={selected} onChange={setSelected} disabled={loading} /> : null}
    <PrimaryButton title={`Revisar ${selected.length} registro(s)`} onPress={analyze} disabled={!canAnalyze || !selected.length || purpose.trim().length < 3} loading={loading} />
    <SecondaryButton title="Ver mis revisiones guardadas" onPress={() => navigation.navigate('AIHistory')} />
  </Screen>;
}
