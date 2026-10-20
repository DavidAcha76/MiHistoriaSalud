import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Avatar, Card, Chip, Disclosure, FormError, Grid, IconBadge, LoadingState, Muted, Pill, PrimaryButton, Screen, SecondaryButton, useGridColumns, type IconName, type Tone } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import { readableDate } from '../utils/presentation';
import { colors, fonts } from '../theme/colors';

type Item = Record<string, any> & { id?: string; eventDate?: string; title?: string; missing?: string[] };
type SectionKey = 'allergies' | 'medications' | 'diagnoses' | 'antecedents' | 'treatments' | 'surgeries' | 'vaccines' | 'recentLabs';
type Summary = { generatedAt: string; profile: { displayName: string }; selectedSections?: SectionKey[]; notice: string } & Partial<Record<SectionKey, Item[]>>;

/** RF-25 / CU-10: secciones de la vista estructurada, sin IA y con los datos faltantes señalados. */
const sections: Array<{ key: SectionKey; title: string; icon: IconName; tone: Tone; render: (item: Item) => string }> = [
  { key: 'allergies', title: 'Alergias', icon: 'alert-circle-outline', tone: 'warning', render: (item) => `${item.allergen || item.title}${item.reaction ? ` · ${item.reaction}` : ''}` },
  { key: 'medications', title: 'Medicamentos', icon: 'pill', tone: 'primary', render: (item) => `${item.medicationName || item.title}${item.dose ? ` · ${item.dose}` : ''}${item.frequency ? ` · ${item.frequency}` : ''}` },
  { key: 'diagnoses', title: 'Diagnósticos informados', icon: 'clipboard-check-outline', tone: 'ai', render: (item) => item.diagnosisName || item.title || '' },
  { key: 'antecedents', title: 'Antecedentes', icon: 'history', tone: 'accent', render: (item) => `${item.conditionName || item.title}${item.category === 'FAMILY' ? ` · familiar${item.relationshipPerson ? ` (${item.relationshipPerson})` : ''}` : ''}` },
  { key: 'treatments', title: 'Tratamientos', icon: 'medical-bag', tone: 'primary', render: (item) => item.treatmentName || item.title || '' },
  { key: 'surgeries', title: 'Cirugías y procedimientos', icon: 'hospital-box-outline', tone: 'ai', render: (item) => item.procedureName || item.title || '' },
  { key: 'vaccines', title: 'Vacunas', icon: 'needle', tone: 'accent', render: (item) => `${item.vaccineName || item.title}${item.doseNumber ? ` · dosis ${item.doseNumber}` : ''}` },
  { key: 'recentLabs', title: 'Resultados recientes', icon: 'flask-outline', tone: 'primary', render: (item) => `${item.testName || item.title}: ${item.valueText ?? item.valueNumeric ?? 'sin valor'} ${item.unit || ''}`.trim() }
];
const allKeys = sections.map((section) => section.key);

function Block({ title, icon, tone, items, render, stretch }: { title: string; icon: IconName; tone: Tone; items: Item[]; render: (item: Item) => string; stretch: boolean }) {
  return <Card style={stretch ? styles.stretch : undefined}>
    <View style={styles.blockHeading}>
      <IconBadge icon={icon} tone={tone} size={44} />
      <Text accessibilityRole="header" style={styles.blockTitle}>{title}</Text>
      <Pill label={String(items.length)} tone={items.length ? tone : 'neutral'} />
    </View>
    {items.length ? items.map((item, index) => <View key={item.id || index} style={styles.item}>
      <View style={styles.dot} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: fonts.bold }}>{render(item)}</Text>
        <Muted>{readableDate(item.eventDate)}</Muted>
        {item.missing?.length ? <View style={styles.missing}><MaterialCommunityIcons name="help-circle-outline" size={17} color={colors.warning} /><Text style={styles.missingText}>No registrado: {item.missing.join(', ').toLowerCase()}</Text></View> : null}
      </View>
    </View>) : <Muted>No hay información registrada en esta sección.</Muted>}
  </Card>;
}

export function SummaryScreen() {
  const { selectedProfile } = useProfiles();
  const stretch = useGridColumns(400) > 1;
  const [draft, setDraft] = useState<SectionKey[]>(allKeys);
  const [applied, setApplied] = useState<SectionKey[]>(allKeys);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setData(null); setError('');
    if (!selectedProfile) { setLoading(false); return; }
    setLoading(true);
    const query = applied.length === allKeys.length ? '' : `?sections=${applied.join(',')}`;
    apiRequest<Summary>(`/profiles/${selectedProfile.id}/consultation-summary${query}`).then((response) => { if (active) setData(response); }).catch(() => { if (active) setError('No pudimos preparar tu resumen. Revisa tu conexión y vuelve a intentar.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [selectedProfile?.id, retry, applied]));
  const toggle = (key: SectionKey) => setDraft((current) => current.includes(key) ? current.filter((item) => item !== key) : allKeys.filter((item) => item === key || current.includes(item)));
  const shown = sections.filter((section) => (data?.selectedSections || applied).includes(section.key));
  return <Screen>
    <AppTitle eyebrow="Para tu profesional" title="Preparar mi consulta" subtitle="Muestra este resumen a tu profesional. Reúne la información que has guardado en tu historial." />
    <ProfileSelector />
    <Disclosure title={`Elegir qué incluir (${applied.length} de ${allKeys.length} secciones)`}>
      <Muted>Selecciona las secciones que quieres mostrar. La vista solo usa lo que registraste: no completa ni inventa datos.</Muted>
      <View style={styles.chips}>{sections.map((section) => <Chip key={section.key} label={section.title} selected={draft.includes(section.key)} onPress={() => toggle(section.key)} />)}</View>
      <Grid min={240} gap={12}>
        <PrimaryButton title="Generar vista" icon="file-document-check-outline" disabled={!draft.length} onPress={() => setApplied(draft)} />
        <SecondaryButton title="Incluir todas" icon="checkbox-multiple-marked-outline" onPress={() => { setDraft(allKeys); setApplied(allKeys); }} />
      </Grid>
    </Disclosure>
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
        {shown.map((section) => <Block key={section.key} stretch={stretch} title={section.title} icon={section.icon} tone={section.tone} items={data[section.key] || []} render={section.render} />)}
      </Grid>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  stretch: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, marginBottom: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  name: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 30 },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: 'rgba(12, 27, 36, 0.45)' },
  blockHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  blockTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 19, lineHeight: 27, color: colors.text },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 11, backgroundColor: colors.primary },
  missing: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  missingText: { flex: 1, color: colors.warning, fontSize: 15, lineHeight: 22 }
});
