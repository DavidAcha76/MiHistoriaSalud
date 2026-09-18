import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, FormError, LoadingState, Muted, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import { readableDate } from '../utils/presentation';
import { colors, fonts } from '../theme/colors';

type Summary = { generatedAt: string; profile: { displayName: string }; allergies: any[]; medications: any[]; diagnoses: any[]; antecedents: any[]; surgeries: any[]; vaccines: any[]; recentLabs: any[]; notice: string };
function Block({ title, items, render }: { title: string; items: any[]; render: (item: any) => string }) {
  return <><SectionTitle>{title}</SectionTitle><Card>{items.length ? items.map((item, index) => <View key={item.id || index} style={{ marginBottom: 12 }}><Text style={{ fontFamily: fonts.bold }}>{render(item)}</Text><Muted>{readableDate(item.eventDate)}</Muted></View>) : <Muted>No hay información registrada en esta sección.</Muted>}</Card></>;
}
export function SummaryScreen() {
  const { selectedProfile } = useProfiles();
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null); setError('');
    if (!selectedProfile) { setLoading(false); return; }
    setLoading(true);
    apiRequest<Summary>(`/profiles/${selectedProfile.id}/consultation-summary`).then((response) => { if (active) setData(response); }).catch(() => { if (active) setError('No pudimos preparar tu resumen. Revisa tu conexión y vuelve a intentar.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedProfile?.id, retry]));
  return <Screen>
    <AppTitle title="Preparar mi consulta" subtitle="Muestra este resumen a tu profesional. Reúne la información que has guardado en tu historial." />
    <ProfileSelector />
    {loading ? <LoadingState label="Preparando tu resumen…" /> : null}
    <FormError message={error} />
    {error ? <SecondaryButton title="Volver a intentar" onPress={() => setRetry((value) => value + 1)} /> : null}
    {data ? <>
      <Card style={{ backgroundColor: colors.primarySoft }}><Text style={{ fontFamily: fonts.bold, fontSize: 22 }}>{data.profile.displayName}</Text><Muted>Actualizado: {new Date(data.generatedAt).toLocaleString('es-BO')}</Muted><Text style={{ marginTop: 12 }}>{data.notice}</Text></Card>
      <Block title="Alergias" items={data.allergies} render={item => `${item.allergen || item.title}${item.reaction ? ` · ${item.reaction}` : ''}`} />
      <Block title="Medicamentos" items={data.medications} render={item => `${item.medicationName || item.title}${item.dose ? ` · ${item.dose}` : ''}${item.frequency ? ` · ${item.frequency}` : ''}`} />
      <Block title="Diagnósticos informados" items={data.diagnoses} render={item => item.diagnosisName || item.title} />
      <Block title="Antecedentes" items={data.antecedents} render={item => item.conditionName || item.title} />
      <Block title="Cirugías" items={data.surgeries} render={item => item.procedureName || item.title} />
      <Block title="Vacunas" items={data.vaccines} render={item => `${item.vaccineName || item.title}${item.doseNumber ? ` · dosis ${item.doseNumber}` : ''}`} />
      <Block title="Resultados recientes" items={data.recentLabs} render={item => `${item.testName || item.title}: ${item.valueText ?? item.valueNumeric ?? 'sin valor'} ${item.unit || ''}`} />
    </> : null}
  </Screen>;
}
