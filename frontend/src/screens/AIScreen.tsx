import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppAlert as Alert } from '../utils/alerts';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Chip, Field, FormError, LoadingState, Muted, PrimaryButton, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { AiUsageCard } from '../components/AiUsageCard';
import { AiResultCard } from '../components/AiResultCard';
import { AiRecordSelector } from '../components/AiRecordSelector';
import { useProfiles } from '../context/ProfileContext';
import { useProfileResource } from '../hooks/useProfileResource';
import type { AiResult, PlanStatus, ReviewFocus } from '../types/domain';
import { aiBlockedReason } from '../utils/ai-access';

const fetchAnalysisData = (id: string) => apiRequest<PlanStatus>(`/profiles/${id}/ai/status`).then((status) => ({ status }));

/** RF-27 resumen informativo, RF-28 revisión de consistencia, o ambas finalidades. */
export const focusOptions: Array<{ value: ReviewFocus; label: string; hint: string; purpose: string }> = [
  { value: 'COMPLETE', label: 'Resumen y revisión', hint: 'Un resumen, los datos que faltan, posibles contradicciones y preguntas para tu consulta.', purpose: 'Preparar una revisión informativa de los registros seleccionados' },
  { value: 'SUMMARY', label: 'Solo un resumen', hint: 'Un resumen ordenado por fecha de lo que seleccionaste, sin interpretaciones clínicas.', purpose: 'Obtener un resumen informativo de los registros seleccionados' },
  { value: 'CONSISTENCY', label: 'Revisar consistencia', hint: 'Señala campos incompletos, duplicados o datos que no coinciden entre registros.', purpose: 'Revisar si los registros seleccionados tienen datos incompletos o contradictorios' }
];

export function AIScreen(props: any) {
  const { selectedProfile } = useProfiles();
  return <AnalysisForProfile key={selectedProfile?.id || 'none'} {...props} />;
}

function AnalysisForProfile({ navigation }: any) {
  const { profileId, data, error, loading: fetching, refresh } = useProfileResource(fetchAnalysisData);
  const [selected, setSelected] = useState<string[]>([]);
  const { canEdit } = useProfiles();
  const [focus, setFocus] = useState<ReviewFocus>('COMPLETE');
  const [purpose, setPurpose] = useState(focusOptions[0].purpose);
  const [result, setResult] = useState<AiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef(false);
  const reason = aiBlockedReason(data?.status || null, 'analysis');
  const canAnalyze = Boolean(profileId && data && !reason && !loading && canEdit);
  function chooseFocus(option: typeof focusOptions[number]) {
    // Solo se reemplaza la finalidad si la persona no la había escrito a mano.
    if (focusOptions.some((item) => item.purpose === purpose)) setPurpose(option.purpose);
    setFocus(option.value);
  }
  async function analyze() {
    if (!profileId || !canAnalyze || !selected.length || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      setResult(await apiRequest<AiResult>(`/profiles/${profileId}/ai/review`, { method: 'POST', body: JSON.stringify({ eventIds: selected, purpose: purpose.trim(), focus }) }));
      setSelected([]);
    } catch (error: any) { Alert.alert('Revisión no disponible', error.message); }
    finally { await refresh(); setLoading(false); inFlight.current = false; }
  }
  return <Screen>
    <AppTitle eyebrow="Revisión informativa" title="Revisar mis registros" subtitle="Elige la información que quieres resumir y las preguntas que quieres preparar para tu consulta." />
    <ProfileSelector />
    {fetching ? <LoadingState /> : null}
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar" onPress={refresh} /></> : null}
    {data ? <AiUsageCard status={data.status} onRenew={refresh} /> : null}
    {!profileId ? <Card><Muted>Selecciona un perfil para revisar sus registros.</Muted></Card> : null}
    {data && reason ? <Card><Muted>{reason}</Muted><SecondaryButton title="Ir al centro de IA" onPress={() => navigation.navigate('AICenter')} /></Card> : null}
    {result ? <><SectionTitle>Tu revisión</SectionTitle><AiResultCard result={result} /></> : null}
    {!canEdit ? <Card><Muted>Tu permiso sobre este perfil es solo de consulta. Puedes ver las revisiones guardadas, pero no solicitar nuevas.</Muted></Card> : null}
    <SectionTitle>¿Qué quieres obtener?</SectionTitle>
    <View style={styles.focus}>{focusOptions.map((option) => <Chip key={option.value} label={option.label} selected={focus === option.value} onPress={() => chooseFocus(option)} />)}</View>
    <Muted style={{ marginBottom: 16 }}>{focusOptions.find((option) => option.value === focus)?.hint}</Muted>
    <Field label="Finalidad de la revisión" value={purpose} onChangeText={setPurpose} maxLength={300} hint="Entre 3 y 300 caracteres." editable={canAnalyze} />
    <SectionTitle>Selecciona registros</SectionTitle>
    {profileId ? <AiRecordSelector profileId={profileId} selected={selected} onChange={setSelected} disabled={loading} /> : null}
    <PrimaryButton title={`Revisar ${selected.length} registro(s)`} icon="text-box-search-outline" onPress={analyze} disabled={!canAnalyze || !selected.length || purpose.trim().length < 3} loading={loading} />
    <SecondaryButton title="Ver mis revisiones guardadas" icon="history" onPress={() => navigation.navigate('AIHistory')} />
  </Screen>;
}

const styles = StyleSheet.create({
  focus: { flexDirection: 'row', flexWrap: 'wrap' }
});
