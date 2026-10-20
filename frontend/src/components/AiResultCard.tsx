import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from './AppText';
import { Card, IconBadge, Muted, Pill, type IconName, type Tone } from './ui';
import type { AiResult } from '../types/domain';
import { colors, fonts } from '../theme/colors';
import { focusLabels } from '../utils/presentation';

export function AiResultCard({ result }: { result: AiResult }) {
  const sections: Array<[string, string[], string, IconName, Tone]> = [
    ['Datos incompletos', result.incompleteData, 'No se señalaron datos incompletos.', 'progress-question', 'warning'],
    ['Posibles contradicciones', result.contradictions, 'No se señalaron contradicciones.', 'swap-horizontal', 'accent'],
    ['Preguntas para tu consulta', result.questions, 'No se añadieron preguntas.', 'comment-question-outline', 'primary']
  ];
  return <Card style={{ borderColor: '#46597D' }}>
    {result.createdAt || result.purpose || result.focus ? <View style={styles.meta}>
      <View style={styles.pills}>
        <Pill label="Generado con IA · informativo" icon="creation" tone="ai" />
        {result.focus ? <Pill label={focusLabels[result.focus] || result.focus} tone="neutral" /> : null}
      </View>
      {result.createdAt ? <Muted>Generado el {new Date(result.createdAt).toLocaleString('es-BO')}{result.selectedCount ? ` · ${result.selectedCount} ${result.selectedCount === 1 ? 'registro seleccionado' : 'registros seleccionados'}` : ''}</Muted> : null}
      {result.purpose ? <Muted>Finalidad: {result.purpose}</Muted> : null}
    </View> : null}
    <View style={styles.summary}>
      <IconBadge icon="creation" tone="ai" size={44} />
      <Text style={styles.summaryText}>{result.summary}</Text>
    </View>
    {sections.map(([title, items, empty, icon, tone]) => <View key={title} style={styles.section}>
      <View style={styles.sectionHeading}><IconBadge icon={icon} tone={tone} size={36} /><Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text></View>
      {items.length ? items.map((item, index) => <View key={index} style={styles.item}><View style={styles.dot} /><Text style={styles.itemText}>{item}</Text></View>) : <Muted>{empty}</Muted>}
    </View>)}
    <View style={styles.disclaimer}><MaterialCommunityIcons name="information-outline" size={20} color={colors.ai} /><Text style={styles.disclaimerText}>{result.disclaimer}</Text></View>
  </Card>;
}

const styles = StyleSheet.create({
  meta: { gap: 4, paddingBottom: 14, marginBottom: 16, borderBottomWidth: 1, borderColor: colors.borderSoft },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  summary: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  summaryText: { flex: 1, color: colors.text, lineHeight: 27 },
  section: { marginTop: 22, gap: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  sectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 19, lineHeight: 27, color: colors.text },
  item: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingLeft: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 10, backgroundColor: colors.primary },
  itemText: { flex: 1, lineHeight: 26 },
  disclaimer: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 22, padding: 14, borderRadius: 14, backgroundColor: colors.aiSoft },
  disclaimerText: { flex: 1, color: colors.ai, lineHeight: 25 }
});
