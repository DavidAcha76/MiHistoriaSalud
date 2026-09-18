import React from 'react';
import { AppText as Text } from './AppText';
import { Card, Muted, SectionTitle } from './ui';
import type { AiResult } from '../types/domain';
import { colors } from '../theme/colors';

export function AiResultCard({ result }: { result: AiResult }) {
  return <Card style={{ borderColor: colors.ai }}>
    <Text style={{ color: colors.text, lineHeight: 26 }}>{result.summary}</Text>
    {([
      ['Datos incompletos', result.incompleteData, 'No se señalaron datos incompletos.'],
      ['Posibles contradicciones', result.contradictions, 'No se señalaron contradicciones.'],
      ['Preguntas para tu consulta', result.questions, 'No se añadieron preguntas.']
    ] as const).map(([title, items, empty]) => <React.Fragment key={title}><SectionTitle>{title}</SectionTitle>{items.length ? items.map((item, index) => <Text key={index} style={{ marginBottom: 8, lineHeight: 25 }}>• {item}</Text>) : <Muted>{empty}</Muted>}</React.Fragment>)}
    <Text style={{ marginTop: 18, color: colors.ai, lineHeight: 25 }}>{result.disclaimer}</Text>
  </Card>;
}
