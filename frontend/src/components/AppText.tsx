import React from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, fonts } from '../theme/colors';

/** Mantiene legibles los textos de pantallas secundarias y respeta el tamaño del sistema. */
export function AppText({ style, ...props }: TextProps) {
  const weight = StyleSheet.flatten(style)?.fontWeight;
  const bold = weight === 'bold' || (weight != null && Number(weight) >= 600);
  return <Text {...props} style={[{ fontFamily: bold ? fonts.bold : fonts.regular, color: colors.text, fontSize: 17, lineHeight: 27 }, style]} />;
}
