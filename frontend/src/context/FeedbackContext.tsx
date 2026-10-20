import React, { createContext, useContext, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gradients } from '../theme/colors';
import { gradient } from '../theme/effects';

const FeedbackContext = createContext<(message: string) => void>(() => {});
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('');
  const insets = useSafeAreaInsets();
  return <FeedbackContext.Provider value={setMessage}><View style={styles.root}>
    {message ? <View style={[styles.banner, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.icon}><MaterialCommunityIcons name="check" size={22} color={colors.background} /></View>
      <Text accessibilityLiveRegion="polite" role="status" style={styles.text}>{message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar mensaje de confirmación" onPress={() => setMessage('')} style={styles.close}><MaterialCommunityIcons name="close" size={24} color={colors.primary} /></Pressable>
    </View> : null}
    {children}
  </View></FeedbackContext.Provider>;
}
export const useFeedback = () => useContext(FeedbackContext);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  banner: { paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft, ...gradient(gradients.hero), borderBottomWidth: 1, borderColor: '#2E6662' },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  text: { flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 26 },
  close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14 }
});
