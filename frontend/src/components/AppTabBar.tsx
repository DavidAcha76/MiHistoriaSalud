import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BrandLogo } from './BrandLogo';
import { Avatar, type PressState } from './ui';
import { useAuth } from '../context/AuthContext';
import { SIDEBAR_WIDTH, useLayout } from '../hooks/useLayout';
import { colors, fonts, gradients } from '../theme/colors';
import { gradient } from '../theme/effects';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const icons: Record<string, [IconName, IconName]> = {
  Inicio: ['home-outline', 'home'],
  Medicinas: ['pill', 'pill'],
  Historial: ['clipboard-text-outline', 'clipboard-text'],
  IA: ['creation-outline', 'creation'],
  Más: ['dots-horizontal-circle-outline', 'dots-horizontal-circle']
};

export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { width, sidebarMode: wide } = useLayout();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  return <View accessibilityRole="tablist" accessibilityLabel="Navegación principal" style={[styles.bar, wide ? styles.sidebar : { paddingBottom: Math.max(insets.bottom, 8), paddingHorizontal: Math.max(insets.left, insets.right, 6) }]}>
    {wide ? <View style={styles.brand}><BrandLogo withName size={44} /></View> : null}
    {wide ? <Text style={styles.sectionLabel}>Menú</Text> : null}
    {state.routes.map((route, index) => {
      const selected = state.index === index;
      const [outline, filled] = icons[route.name] || ['circle-outline', 'circle'];
      const color = selected ? colors.primary : colors.muted;
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={route.name === 'Más' ? 'Más opciones' : route.name === 'IA' ? 'IA, inteligencia artificial' : route.name} accessibilityState={{ selected }} aria-selected={selected} onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
      }} onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })} style={(pressState) => {
        const { pressed, hovered } = pressState as PressState;
        return [styles.item, wide && styles.sidebarItem, wide && selected && styles.sidebarSelected, wide && hovered && !selected && styles.sidebarHovered, pressed && { opacity: .8 }];
      }}>
        {wide && selected ? <View style={styles.accentBar} /> : null}
        <View style={[styles.indicator, wide && styles.sidebarIndicator, selected && styles.indicatorSelected]}>
          <MaterialCommunityIcons name={selected ? filled : outline} size={wide ? 24 : 25} color={color} />
        </View>
        <Text style={[styles.label, width < 430 && styles.labelSmall, wide && styles.sidebarLabel, { color: selected ? colors.text : colors.muted }, selected && styles.labelSelected]}>{width < 360 && route.name === 'Medicinas' ? 'Tomas' : route.name}</Text>
      </Pressable>;
    })}
    {wide ? <View style={styles.footer}>
      <View style={styles.privacy}>
        <MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.primary} />
        <Text style={styles.privacyText}>Tu información es privada. Tú decides qué compartir.</Text>
      </View>
      {user ? <View style={styles.user}>
        <Avatar name={user.fullName || user.email} size={42} />
        <View style={styles.userCopy}>
          <Text numberOfLines={1} style={styles.userName}>{user.fullName}</Text>
          <Text numberOfLines={1} style={styles.userEmail}>{user.email}</Text>
        </View>
      </View> : null}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.backgroundDeep, borderTopWidth: 1, borderColor: colors.borderSoft, paddingTop: 8, gap: 2 },
  sidebar: { width: SIDEBAR_WIDTH, flexDirection: 'column', borderTopWidth: 0, borderRightWidth: 1, paddingHorizontal: 18, paddingVertical: 22, gap: 6 },
  brand: { marginTop: 10, marginBottom: 30, paddingHorizontal: 6 },
  sectionLabel: { color: colors.muted, fontFamily: fonts.bold, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase', paddingHorizontal: 14, marginBottom: 6 },
  item: { flex: 1, minWidth: 0, minHeight: 66, paddingHorizontal: 2, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 14 },
  sidebarItem: { flex: 0, minHeight: 56, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 10, overflow: 'hidden' },
  sidebarSelected: { backgroundColor: colors.primarySoft },
  sidebarHovered: { backgroundColor: colors.surface },
  accentBar: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 4, borderRadius: 4, backgroundColor: colors.primary, ...gradient(gradients.avatar) },
  indicator: { width: 58, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sidebarIndicator: { width: 40, height: 40, borderRadius: 12 },
  indicatorSelected: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: '#2E6662' },
  label: { width: '100%', fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, textAlign: 'center', flexShrink: 1 },
  labelSmall: { fontSize: 12, lineHeight: 17 },
  labelSelected: { fontFamily: fonts.bold },
  sidebarLabel: { width: 'auto', fontSize: 17, lineHeight: 25, textAlign: 'left' },
  footer: { marginTop: 'auto', gap: 14 },
  privacy: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  privacyText: { flex: 1, color: colors.muted, fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 14, paddingHorizontal: 4, borderTopWidth: 1, borderColor: colors.borderSoft },
  userCopy: { flex: 1, minWidth: 0 },
  userName: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  userEmail: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 }
});
