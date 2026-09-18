import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BrandLogo } from './BrandLogo';
import { colors, fonts } from '../theme/colors';

const icons: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = { Inicio: 'home-outline', Medicinas: 'pill', Historial: 'clipboard-text-outline', IA: 'creation', Más: 'dots-horizontal' };

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 1100 && fontScale < 1.4;
  return <View accessibilityRole="tablist" accessibilityLabel="Navegación principal" style={[styles.bar, wide ? styles.sidebar : { paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: Math.max(insets.left, insets.right, 4) }]}>
    {wide ? <View style={styles.brand}><BrandLogo withName size={42} /></View> : null}
    {state.routes.map((route, index) => {
      const selected = state.index === index;
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={route.name === 'Más' ? 'Más opciones' : route.name === 'IA' ? 'IA, inteligencia artificial' : route.name} accessibilityState={{ selected }} aria-selected={selected} onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
      }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} style={({ pressed }) => [styles.item, wide && styles.sidebarItem, selected && styles.selected, pressed && { opacity: .8 }]}>
        <MaterialCommunityIcons name={icons[route.name]} size={27} color={selected ? colors.primary : colors.muted} />
        <Text style={[styles.label, width < 430 && { fontSize: 12, lineHeight: 18 }, wide && styles.sidebarLabel, { color: selected ? colors.primary : colors.muted }]}>{width < 360 && route.name === 'Medicinas' ? 'Tomas' : route.name}</Text>
      </Pressable>;
    })}
    {wide ? <View style={styles.footer}><MaterialCommunityIcons name="heart-pulse" size={24} color={colors.primary} /><Text style={styles.footerText}>Tu salud, paso a paso.</Text></View> : null}
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8, gap: 2 },
  sidebar: { width: 250, flexDirection: 'column', borderTopWidth: 0, borderRightWidth: 1, padding: 18, gap: 10 },
  brand: { marginTop: 18, marginBottom: 38 },
  item: { flex: 1, minWidth: 0, minHeight: 66, paddingHorizontal: 2, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  sidebarItem: { flex: 0, flexDirection: 'row', justifyContent: 'flex-start', gap: 14, paddingHorizontal: 18 },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  label: { width: '100%', fontFamily: fonts.bold, fontSize: 14, lineHeight: 21, textAlign: 'center', flexShrink: 1 },
  sidebarLabel: { width: 'auto', fontSize: 18, lineHeight: 26 },
  footer: { marginTop: 'auto', paddingVertical: 24, gap: 10 },
  footerText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 }
});
