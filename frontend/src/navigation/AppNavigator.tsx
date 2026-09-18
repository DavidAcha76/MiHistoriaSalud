import React from 'react';
import { ActivityIndicator, Pressable, Text, useWindowDimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme/colors';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { AIScreen } from '../screens/AIScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { ProfilesScreen } from '../screens/ProfilesScreen';
import { EventFormScreen } from '../screens/EventFormScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { DocumentUploadScreen } from '../screens/DocumentUploadScreen';
import { ProfileFormScreen } from '../screens/ProfileFormScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { PlanScreen } from '../screens/PlanScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { ShareScreen } from '../screens/ShareScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { MedicationScheduleScreen } from '../screens/MedicationScheduleScreen';
import { MedicationFormScreen } from '../screens/MedicationFormScreen';
import { AppTabBar } from '../components/AppTabBar';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();
const navigationTheme = { ...DarkTheme, colors: { ...DarkTheme.colors, primary: colors.primary, background: colors.background, card: colors.surface, text: colors.text, border: colors.border, notification: colors.danger } };

function MainTabs() {
  const { width, fontScale } = useWindowDimensions();
  return <Tabs.Navigator tabBar={(props) => <AppTabBar {...props} />} screenOptions={{
    headerShown: false,
    tabBarPosition: width >= 1100 && fontScale < 1.4 ? 'left' : 'bottom',
    animation: 'none'
  }}>
    <Tabs.Screen name="Inicio" component={HomeScreen} />
    <Tabs.Screen name="Medicinas" component={MedicationScheduleScreen} />
    <Tabs.Screen name="Historial" component={TimelineScreen} />
    <Tabs.Screen name="Más" component={MoreScreen} />
  </Tabs.Navigator>;
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;
  return <NavigationContainer theme={navigationTheme}><Stack.Navigator screenOptions={({ navigation }) => ({ headerShadowVisible: false, headerStyle: { backgroundColor: colors.surface }, headerTintColor: colors.primary, headerTitleStyle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 }, contentStyle: { backgroundColor: colors.background }, headerBackVisible: false, headerLeft: ({ canGoBack }) => canGoBack ? <Pressable accessibilityRole="button" accessibilityLabel="Volver a la pantalla anterior" onPress={() => navigation.goBack()} style={{ minHeight: 48, paddingRight: 14, flexDirection: 'row', alignItems: 'center' }}><MaterialCommunityIcons name="chevron-left" size={26} color={colors.primary} /><Text style={{ color: colors.primary, fontFamily: fonts.bold, fontSize: 16 }}>Volver</Text></Pressable> : null })}>
    {user ? <>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="IA" component={AIScreen} options={{ title: 'Revisión con IA' }} />
      <Stack.Screen name="EventForm" component={EventFormScreen} options={{ title: 'Registrar evento' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Detalle' }} />
      <Stack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documentos clínicos' }} />
      <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} options={{ title: 'Documento' }} />
      <Stack.Screen name="Profiles" component={ProfilesScreen} options={{ title: 'Perfiles' }} />
      <Stack.Screen name="ProfileForm" component={ProfileFormScreen} options={{ title: 'Perfil' }} />
      <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Resumen para consulta' }} />
      <Stack.Screen name="Share" component={ShareScreen} options={{ title: 'Compartir para consulta' }} />
      <Stack.Screen name="Plan" component={PlanScreen} options={{ title: 'Plan y uso de IA' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Asistente de organización' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Avisos' }} />
      <Stack.Screen name="MedicationSchedule" component={MedicationScheduleScreen} options={{ title: 'Medicamentos y tomas' }} />
      <Stack.Screen name="MedicationForm" component={MedicationFormScreen} options={{ title: 'Registrar medicamento' }} />
    </> : <>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta' }} />
    </>}
  </Stack.Navigator></NavigationContainer>;
}
