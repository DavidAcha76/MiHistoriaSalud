import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';
import { brandMark } from './brandMark';

type BrandLogoProps = {
  size?: number;
  withName?: boolean;
  tagline?: boolean;
};

/** Marca Clinia: la «C» en degradado verde agua y azul cielo que abraza una cruz médica. */
export function BrandLogo({ size = 44, withName = false, tagline = true }: BrandLogoProps) {
  const nameSize = Math.max(20, Math.round(size * 0.56));
  return <View accessibilityRole="image" accessibilityLabel="Clinia" style={styles.row}>
    <Image source={brandMark} resizeMode="contain" style={{ width: size, height: size }} />
    {withName ? <View style={styles.copy}>
      <Text style={[styles.name, { fontSize: nameSize, lineHeight: Math.round(nameSize * 1.2) }]}>Clinia</Text>
      {tagline ? <Text style={styles.tagline}>Tu salud, organizada</Text> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, maxWidth: '100%' },
  copy: { flexShrink: 1, minWidth: 0 },
  name: { color: colors.text, fontFamily: fonts.bold, letterSpacing: -0.6 },
  tagline: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14, lineHeight: 19 }
});
