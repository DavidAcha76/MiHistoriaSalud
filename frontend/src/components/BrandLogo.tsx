import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/colors';

const cliniaMark = require('../../assets/brand/clinia-logo.png');

type BrandLogoProps = {
  size?: number;
  withName?: boolean;
};

/** Marca Clinia con área libre alrededor del símbolo. */
export function BrandLogo({ size = 44, withName = false }: BrandLogoProps) {
  const frameSize = Math.round(size * 1.2);
  return <View accessibilityRole="image" accessibilityLabel="Clinia" style={styles.row}>
    <View style={[styles.markFrame, { width: frameSize, height: frameSize, padding: Math.round(size * 0.1) }]}>
      <Image source={cliniaMark} resizeMode="contain" style={{ width: size, height: size }} />
    </View>
    {withName ? <View style={{ flexShrink: 1, minWidth: 0 }}><Text style={styles.name}>Clinia</Text><Text style={styles.tagline}>Tu salud, organizada</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, maxWidth: '100%' },
  markFrame: { alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5 },
  tagline: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14, marginTop: 1 }
});
