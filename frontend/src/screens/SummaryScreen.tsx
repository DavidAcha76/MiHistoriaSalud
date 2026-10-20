import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Avatar, Card, FormError, Grid, IconBadge, LoadingState, Muted, Pill, Screen, SecondaryButton, useGridColumns, type IconName, type Tone } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import { readableDate } from '../utils/presentation';
import { colors, fonts } from '../theme/colors';

type Summary = { generatedAt: string; profile: { displayName: string }; allergies: any[]; medications: any[]; diagnoses: any[]; antecedents: any[]; surgeries: any[]; vaccines: any[]; recentLabs: any[]; notice: string };
function Block({ title, icon, tone, items, render, stretch }: { title: string; icon: IconName; tone: Tone; items: any[]; render: (item: any) => string; stretch: boolean }) {
  return <Card style={stretch ? styles.stretch : undefined}>
    <View style={styles.blockHeading}>
      <IconBadge icon={icon} tone={tone} size={44} />
      <Text accessibilityRole="header" style={styles.blockTitle}>{title}</Text>
      <Pill label={String(items.length)} tone={items.length ? tone : 'neutral'} />
    </View>
    {items.length ? items.map((item, index) => <View key={item.id || index} style={styles.item}>
      <View style={styles.dot} />
      <View style={{ flex: 1, minWidth: 0 }}><Text style={{ fontFamily: fonts.bold }}>{render(item)}</Text><Muted>{readableDate(item.eventDate)}</Muted></View>
    </View>) : <Muted>No hay información registrada en esta sección.</Muted>}
  </Card>;
}
export function SummaryScreen() {
  const { selectedProfile } = useProfiles();
  const stretch = useGridColumns(400) > 1;
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
    <AppTitle eyebrow="Para tu profesional" title="Preparar mi consulta" subtitle="Muestra este resumen a tu profesional. Reúne la información que has guardado en tu historial." />
    <ProfileSelector />
    {loading ? <LoadingState label="Preparando tu resumen…" /> : null}
    <FormError message={error} />
    {error ? <SecondaryButton title="Volver a intentar" icon="refresh" onPress={() => setRetry((value) => value + 1)} /> : null}
    {data ? <>
      <Card tone="hero">
        <View style={styles.header}>
          <Avatar name={data.profile.displayName} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.name}>{data.profile.displayName}</Text><Muted>Actualizado: {new Date(data.generatedAt).toLocaleString('es-BO')}</Muted></View>
        </View>
        <View style={styles.notice}><MaterialCommunityIcons name="information-outline" size={20} color={colors.primary} /><Text style={{ flex: 1 }}>{data.notice}</Text></View>
      </Card>
      <Grid min={400}>
        <Block stretch={stretch} title="Alergias" icon="alert-circle-outline" tone="warning" items={data.allergies} render={item => `${item.allergen || item.title}${item.reaction ? ` · ${item.reaction}` : ''}`} />
        <Block stretch={stretch} title="Medicamentos" icon="pill" tone="primary" items={data.medications} render={item => `${item.medicationName || item.title}${item.dose ? ` · ${item.dose}` : ''}${item.frequency ? ` · ${item.frequency}` : ''}`} />
        <Block stretch={stretch} title="Diagnósticos informados" icon="clipboard-check-outline" tone="ai" items={data.diagnoses} render={item => item.diagnosisName || item.title} />
        <Block stretch={stretch} title="Antecedentes" icon="history" tone="accent" items={data.antecedents} render={item => item.conditionName || item.title} />
        <Block stretch={stretch} title="Cirugías" icon="hospital-box-outline" tone="ai" items={data.surgeries} render={item => item.procedureName || item.title} />
        <Block stretch={stretch} title="Vacunas" icon="needle" tone="accent" items={data.vaccines} render={item => `${item.vaccineName || item.title}${item.doseNumber ? ` · dosis ${item.doseNumber}` : ''}`} />
        <Block stretch={stretch} title="Resultados recientes" icon="flask-outline" tone="primary" items={data.recentLabs} render={item => `${item.testName || item.title}: ${item.valueText ?? item.valueNumeric ?? 'sin valor'} ${item.unit || ''}`} />
      </Grid>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  stretch: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: 'rgba(12, 27, 36, 0.45)' },
  blockHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  blockTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 19, lineHeight: 27, color: colors.text },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 11, backgroundColor: colors.primary }
});
