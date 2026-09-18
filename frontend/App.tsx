import '@expo/metro-runtime';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFonts } from '@expo-google-fonts/manrope/useFonts';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { ProfileProvider } from './src/context/ProfileContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { colors, fonts } from './src/theme/colors';
import { WebAccessibility } from './src/components/WebAccessibility';
import { FeedbackProvider } from './src/context/FeedbackContext';

export default function App() {
  const [loaded] = useFonts({
    [fonts.regular]: Manrope_400Regular,
    [fonts.medium]: Manrope_500Medium,
    [fonts.semibold]: Manrope_600SemiBold,
    [fonts.bold]: Manrope_700Bold
  });
  if (!loaded) return <View style={styles.loading}><StatusBar style="light" /><ActivityIndicator size="large" color={colors.primary} /></View>;
  return <SafeAreaProvider><WebAccessibility /><AuthProvider><ProfileProvider><FeedbackProvider><StatusBar style="light"/><AppNavigator/></FeedbackProvider></ProfileProvider></AuthProvider></SafeAreaProvider>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background } });
