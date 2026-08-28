import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { TimelineScreen } from '../screens/TimelineScreen';
import { DocumentsScreen } from '../screens/DocumentsScreen';
import { AIScreen } from '../screens/AIScreen';
import { ProfilesScreen } from '../screens/ProfilesScreen';
import { EventFormScreen } from '../screens/EventFormScreen';
import { EventDetailScreen } from '../screens/EventDetailScreen';
import { DocumentUploadScreen } from '../screens/DocumentUploadScreen';
import { ProfileFormScreen } from '../screens/ProfileFormScreen';
import { SummaryScreen } from '../screens/SummaryScreen';

const Stack=createNativeStackNavigator();const Tabs=createBottomTabNavigator();
function MainTabs(){return <Tabs.Navigator screenOptions={{headerShown:false,tabBarActiveTintColor:colors.primary,tabBarLabelStyle:{fontWeight:'700',fontSize:11},tabBarStyle:{height:62,paddingBottom:8,paddingTop:6}}}><Tabs.Screen name="Inicio" component={HomeScreen}/><Tabs.Screen name="Historial" component={TimelineScreen}/><Tabs.Screen name="Documentos" component={DocumentsScreen}/><Tabs.Screen name="IA" component={AIScreen}/><Tabs.Screen name="Perfiles" component={ProfilesScreen}/></Tabs.Navigator>}
export function AppNavigator(){const{user,loading}=useAuth();if(loading)return <ActivityIndicator style={{flex:1}} size="large" color={colors.primary}/>;return <NavigationContainer><Stack.Navigator>{user?<><Stack.Screen name="Main" component={MainTabs} options={{headerShown:false}}/><Stack.Screen name="EventForm" component={EventFormScreen} options={{title:'Registrar evento'}}/><Stack.Screen name="EventDetail" component={EventDetailScreen} options={{title:'Detalle'}}/><Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} options={{title:'Documento'}}/><Stack.Screen name="ProfileForm" component={ProfileFormScreen} options={{title:'Perfil'}}/><Stack.Screen name="Summary" component={SummaryScreen} options={{title:'Resumen para consulta'}}/></>:<><Stack.Screen name="Login" component={LoginScreen} options={{headerShown:false}}/><Stack.Screen name="Register" component={RegisterScreen} options={{title:'Crear cuenta'}}/></>}</Stack.Navigator></NavigationContainer>}
