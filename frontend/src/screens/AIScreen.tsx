import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Field, Muted, PrimaryButton, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { AiResult, HealthEvent, PagedEvents, PlanStatus } from '../types/domain';
import { colors } from '../theme/colors';

type AnalysisHistory = { id: string; purpose: string; mode: 'MANUAL' | 'SCHEDULED'; status: string; createdAt: string; output?: AiResult };

export function AIScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles();
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [purpose, setPurpose] = useState('Preparar una revisión informativa de los registros seleccionados');
  const [result, setResult] = useState<AiResult | null>(null);
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(() => {
    if (!selectedProfile) return;
    Promise.all([
      apiRequest<PagedEvents>(`/profiles/${selectedProfile.id}/events?pageSize=50`),
      apiRequest<PlanStatus>(`/profiles/${selectedProfile.id}/ai/status`),
      apiRequest<AnalysisHistory[]>(`/profiles/${selectedProfile.id}/ai/analyses`)
    ]).then(([eventData, planData, analyses]) => { setEvents(eventData.items); setStatus(planData); setHistory(analyses); }).catch((error: any) => Alert.alert('IA', error.message));
  }, [selectedProfile?.id]);
  useFocusEffect(useCallback(() => { load(); setSelected([]); setResult(null); }, [load]));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  async function consent() {
    if (!selectedProfile) return;
    try { await apiRequest(`/profiles/${selectedProfile.id}/ai/consent`, { method: 'PUT', body: JSON.stringify({ granted: true }) }); load(); } catch (error: any) { Alert.alert('IA', error.message); }
  }
  async function analyze() {
    if (!selectedProfile || !selected.length) return Alert.alert('Selecciona información', 'Elige al menos un registro.');
    setLoading(true);
    try {
      setResult(await apiRequest<AiResult>(`/profiles/${selectedProfile.id}/ai/analyze`, { method: 'POST', body: JSON.stringify({ eventIds: selected, purpose }) }));
      load();
    } catch (error: any) { Alert.alert('Análisis no disponible', error.message); } finally { setLoading(false); }
  }
  const canAnalyze = Boolean(status?.consent.granted && status.analysis.availableNow);

  return <Screen>
    <AppTitle title="Revisión con IA" subtitle="Organiza datos, repeticiones registradas y preguntas para consulta. No diagnostica ni recomienda estudios o tratamientos." />
    <ProfileSelector />
    <Card style={{ backgroundColor: colors.aiSoft }}><Text style={{ color: colors.ai, fontWeight: '900' }}>Plan {status?.plan.name || '…'}</Text><Muted>{status?.analysis.availableNow ? 'Hay una revisión disponible.' : `Próxima revisión: ${status?.analysis.nextAnalysisAt ? new Date(status.analysis.nextAnalysisAt).toLocaleDateString() : 'pendiente'}`}</Muted><Muted>{status?.consent.granted ? 'Uso de IA autorizado para este perfil.' : 'Aún no autorizaste el procesamiento de este perfil con IA.'}</Muted>{!status?.consent.granted ? <SecondaryButton title="Autorizar uso de IA" onPress={consent} /> : null}<SecondaryButton title="Plan y límites" onPress={() => navigation.navigate('Plan')} /><SecondaryButton title="Abrir asistente" onPress={() => navigation.navigate('Chat')} /></Card>
    <Field label="Finalidad del análisis" value={purpose} onChangeText={setPurpose} editable={canAnalyze} />
    <SectionTitle>Selecciona registros</SectionTitle>
    {events.map((event) => { const selectedNow = selected.includes(event.id); return <Pressable key={event.id} onPress={() => canAnalyze && toggle(event.id)}><Card style={{ borderColor: selectedNow ? colors.ai : colors.border, opacity: canAnalyze ? 1 : .6 }}><View style={{ flexDirection: 'row', gap: 10 }}><Text style={{ fontSize: 20 }}>{selectedNow ? '☑' : '☐'}</Text><View style={{ flex: 1 }}><Text style={{ fontWeight: '800', color: colors.text }}>{event.title}</Text><Muted>{event.eventDate || event.event_date} · {event.eventType || event.event_type}</Muted></View></View></Card></Pressable>; })}
    <PrimaryButton title={`Analizar ${selected.length} registro(s)`} onPress={analyze} disabled={!canAnalyze || !selected.length} loading={loading} />
    {result ? <><SectionTitle>Resultado</SectionTitle><Card style={{ borderColor: colors.ai }}><Text style={{ fontSize: 16, fontWeight: '800', color: colors.ai }}>IA · {result.provider} / {result.model}</Text><Text style={{ marginTop: 10, color: colors.text, lineHeight: 25 }}>{result.summary}</Text></Card><SectionTitle>Datos incompletos</SectionTitle><Card>{result.incompleteData.length ? result.incompleteData.map((item, index) => <Text key={index} style={{ color: colors.text, marginBottom: 7 }}>• {item}</Text>) : <Muted>No se señalaron datos incompletos.</Muted>}</Card><SectionTitle>Posibles contradicciones</SectionTitle><Card>{result.contradictions.length ? result.contradictions.map((item, index) => <Text key={index} style={{ color: colors.text, marginBottom: 7 }}>• {item}</Text>) : <Muted>No se señalaron contradicciones.</Muted>}</Card><SectionTitle>Preguntas informativas</SectionTitle><Card>{result.questions.map((item, index) => <Text key={index} style={{ color: colors.text, marginBottom: 7 }}>• {item}</Text>)}</Card><Card style={{ backgroundColor: colors.aiSoft }}><Text style={{ color: colors.ai, fontWeight: '800' }}>Importante</Text><Text style={{ color: colors.text, marginTop: 6, lineHeight: 25 }}>{result.disclaimer}</Text></Card></> : null}
    <SectionTitle>Historial de revisiones</SectionTitle>
    {history.map((analysis) => <Card key={analysis.id}><Text style={{ color: colors.text, fontWeight: '800' }}>{analysis.mode === 'SCHEDULED' ? 'Revisión automática' : 'Revisión manual'}</Text><Muted>{new Date(analysis.createdAt).toLocaleString()} · {analysis.status}</Muted>{analysis.output?.summary ? <Text style={{ marginTop: 6, color: colors.text }}>{analysis.output.summary}</Text> : null}</Card>)}
    {!history.length ? <Card><Muted>Aún no hay revisiones guardadas.</Muted></Card> : null}
  </Screen>;
}
