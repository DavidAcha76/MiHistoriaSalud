import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AppTitle, Field, PrimaryButton, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';

export function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false);
  async function submit() { if (!fullName || !email || !password) return Alert.alert('Faltan datos', 'Completa todos los campos.'); setLoading(true); try { await register(fullName.trim(), email.trim(), password); } catch (e: any) { Alert.alert('No se pudo crear la cuenta', e.message); } finally { setLoading(false); } }
  return <Screen><AppTitle title="Crear cuenta" subtitle="Al registrarte se crea automáticamente tu perfil principal." /><Field label="Nombre completo" value={fullName} onChangeText={setFullName} /><Field label="Correo" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} /><Field label="Contraseña" secureTextEntry value={password} onChangeText={setPassword} placeholder="Mín. 8 caracteres, mayúscula, minúscula y número" /><PrimaryButton title="Crear cuenta" onPress={submit} loading={loading} /></Screen>;
}
