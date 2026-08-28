import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { AppTitle, Field, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo@mihistoria.local');
  const [password, setPassword] = useState('Demo1234!');
  const [loading, setLoading] = useState(false);
  async function submit() { setLoading(true); try { await login(email.trim(), password); } catch (e: any) { Alert.alert('No se pudo iniciar sesión', e.message); } finally { setLoading(false); } }
  return <Screen><AppTitle title="MiHistoria Salud" subtitle="Tu información de salud organizada a lo largo del tiempo." /><Field label="Correo" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} /><Field label="Contraseña" secureTextEntry value={password} onChangeText={setPassword} /><PrimaryButton title="Iniciar sesión" onPress={submit} loading={loading} /><SecondaryButton title="Crear una cuenta" onPress={() => navigation.navigate('Register')} /><Text style={{ marginTop: 18, color: colors.muted, fontSize: 12, lineHeight: 18 }}>El sistema es un registro personal y no reemplaza la historia clínica oficial ni la evaluación de un profesional de salud.</Text></Screen>;
}
