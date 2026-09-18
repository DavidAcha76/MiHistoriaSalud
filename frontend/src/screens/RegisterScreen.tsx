import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppTitle, Card, Field, FormError, PrimaryButton, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

export function RegisterScreen() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validationMessage() {
    if (!fullName || !email || !password || !confirmPassword) return 'Completa todos los campos.';
    if (fullName.trim().length < 2) return 'Escribe tu nombre completo con al menos 2 caracteres.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Escribe un correo válido.';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return 'La contraseña debe incluir una mayúscula, una minúscula y un número.';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden.';
    return null;
  }

  async function submit() {
    if (loading) return;
    const validation = validationMessage();
    setError('');
    if (validation) return setError(validation);
    setLoading(true);
    try {
      await register(fullName.trim(), email.trim(), password);
    } catch (e: any) {
      setError(e.message || 'No se pudo crear la cuenta. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return <Screen form>
    <View style={{ width: '100%', maxWidth: 580, alignSelf: 'center' }}>
      <AppTitle title="Crea tu cuenta" subtitle="Completa estos datos. Prepararemos tu perfil para que puedas empezar." />
      <Card>
        <Field label="Nombre completo" autoComplete="name" textContentType="name" value={fullName} onChangeText={(value) => { setFullName(value); setError(''); }} placeholder="Como aparece en tus documentos" />
        <Field label="Correo electrónico" autoComplete="email" autoCorrect={false} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} placeholder="nombre@correo.com" />
        <Field label="Contraseña" hint="Usa al menos 8 caracteres, una mayúscula, una minúscula y un número." autoComplete="new-password" textContentType="newPassword" secureTextEntry value={password} onChangeText={(value) => { setPassword(value); setError(''); }} placeholder="Crea una contraseña" />
        <Field label="Repite tu contraseña" autoComplete="new-password" textContentType="newPassword" secureTextEntry value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setError(''); }} placeholder="Escribe la contraseña nuevamente" />
        <FormError message={error} />
        <PrimaryButton title="Crear cuenta" onPress={submit} loading={loading} />
      </Card>
      <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <MaterialCommunityIcons name="lock-outline" size={18} color={colors.success} />
        <Text style={{ flex: 1, color: colors.muted, fontSize: 16, lineHeight: 25 }}>Usa una contraseña con mayúscula, minúscula y número. Podrás añadir perfiles de familiares más adelante.</Text>
      </View>
    </View>
  </Screen>;
}
