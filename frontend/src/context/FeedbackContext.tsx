import React, { createContext, useContext, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/colors';

const FeedbackContext = createContext<(message: string) => void>(() => {});
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('');
  const insets = useSafeAreaInsets();
  return <FeedbackContext.Provider value={setMessage}><View style={{ flex: 1, backgroundColor: colors.background }}>
    {message ? <View style={{ paddingTop: Math.max(insets.top, 12), paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primarySoft }}>
      <MaterialCommunityIcons name="check-circle-outline" size={26} color={colors.primary} />
      <Text accessibilityLiveRegion="polite" role="status" style={{ flex: 1, color: colors.text, fontFamily: fonts.semibold, fontSize: 17, lineHeight: 26 }}>{message}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Cerrar mensaje de confirmación" onPress={() => setMessage('')} style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><MaterialCommunityIcons name="close" size={24} color={colors.primary} /></Pressable>
    </View> : null}
    {children}
  </View></FeedbackContext.Provider>;
}
export const useFeedback = () => useContext(FeedbackContext);
