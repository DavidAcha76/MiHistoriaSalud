import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppTitle, Card, Field, FormError, IconBadge, PrimaryButton, Screen } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { PasswordRules } from '../components/PasswordRules';
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
    <View style={styles.container}>
      <AppTitle eyebrow="Empieza en un minuto" title="Crea tu cuenta" subtitle="Completa estos datos. Prepararemos tu perfil para que puedas empezar." />
      <Card style={styles.card}>
        <Field label="Nombre completo" icon="account-outline" autoComplete="name" textContentType="name" value={fullName} onChangeText={(value) => { setFullName(value); setError(''); }} placeholder="Como aparece en tus documentos" />
        <Field label="Correo electrónico" icon="email-outline" autoComplete="email" autoCorrect={false} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} placeholder="nombre@correo.com" />
        <Field label="Contraseña" icon="lock-outline" accessibilityHint="Usa al menos 8 caracteres, una mayúscula, una minúscula y un número." autoComplete="new-password" textContentType="newPassword" secureTextEntry value={password} onChangeText={(value) => { setPassword(value); setError(''); }} placeholder="Crea una contraseña" />
        <Field label="Repite tu contraseña" icon="lock-check-outline" autoComplete="new-password" textContentType="newPassword" secureTextEntry value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setError(''); }} placeholder="Escribe la contraseña nuevamente" />
        <PasswordRules password={password} confirmPassword={confirmPassword} />
        <FormError message={error} />
        <PrimaryButton title="Crear cuenta" icon="account-check-outline" onPress={submit} loading={loading} />
      </Card>
      <View style={styles.note}>
        <IconBadge icon="account-multiple-plus-outline" tone="accent" size={44} />
        <Text style={styles.noteText}>Podrás añadir perfiles de familiares más adelante y elegir siempre qué información compartir.</Text>
      </View>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 580, alignSelf: 'center' },
  card: { padding: 22, borderRadius: 26 },
  note: { flexDirection: 'row', gap: 14, alignItems: 'center', paddingHorizontal: 4 },
  noteText: { flex: 1, color: colors.muted, fontSize: 16, lineHeight: 25 }
});
