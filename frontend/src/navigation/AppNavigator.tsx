import React from 'react';
import { ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
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

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function tabIcon(name: string): keyof typeof MaterialCommunityIcons.glyphMap {
  if (name === 'Inicio') return 'home-variant-outline';
  if (name === 'Historial') return 'timeline-text-outline';
  if (name === 'IA') return 'star-four-points-outline';
  return 'dots-grid';
}

function MainTabs() {
  return <Tabs.Navigator screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: '#7B8994',
    tabBarHideOnKeyboard: true,
    tabBarLabelStyle: { fontWeight: '800', fontSize: 11, marginTop: 1 },
    tabBarStyle: { height: 68, paddingTop: 7, paddingBottom: 9, borderTopColor: '#DCE6EA', backgroundColor: '#FFFFFF' },
    tabBarIcon: ({ color, size, focused }) => <MaterialCommunityIcons name={tabIcon(route.name)} size={focused ? size + 1 : size} color={color} />
  })}>
    <Tabs.Screen name="Inicio" component={HomeScreen} />
    <Tabs.Screen name="Historial" component={TimelineScreen} />
    <Tabs.Screen name="IA" component={AIScreen} options={{ title: 'IA' }} />
    <Tabs.Screen name="Más" component={MoreScreen} />
  </Tabs.Navigator>;
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color={colors.primary} />;
  return <NavigationContainer><Stack.Navigator screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.primary, headerTitleStyle: { color: colors.text, fontWeight: '900' } }}>
    {user ? <>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
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
    </> : <>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Crear cuenta' }} />
    </>}
  </Stack.Navigator></NavigationContainer>;
}
