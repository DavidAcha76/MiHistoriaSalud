import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Field, FormError, Muted, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { PasswordRules, passwordRules } from '../components/PasswordRules';
import { useFeedback } from '../context/FeedbackContext';

/** RF-03: fija la contraseña nueva con el enlace o código de un solo uso. */
export function ResetPasswordScreen({ route, navigation }: any) {
  const notify = useFeedback();
  const fromLink = Boolean(route.params?.token);
  const [token, setToken] = useState<string>(route.params?.token || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (loading) return;
    setError('');
    if (token.trim().length < 20) return setError('Pega el código completo que recibiste por correo.');
    const pending = passwordRules(password, confirmPassword).find(([, met]) => !met);
    if (pending) return setError(`Revisa la contraseña: ${pending[0].toLowerCase()}.`);
    setLoading(true);
    try {
      const response = await apiRequest<{ message: string }>('/auth/reset', { method: 'POST', body: JSON.stringify({ token: token.trim(), password }) }, false);
      notify(response.message);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e: any) { setError(e.message || 'No pudimos cambiar la contraseña. Solicita un enlace nuevo.'); }
    finally { setLoading(false); }
  }
  return <Screen form>
    <View style={styles.container}>
      <AppTitle eyebrow="Recuperar acceso" title="Crea una contraseña nueva" subtitle={fromLink ? 'Abriste el enlace de recuperación. Elige tu nueva contraseña.' : 'Pega el código que recibiste por correo y elige tu nueva contraseña.'} />
      <Card style={styles.card}>
        {!fromLink ? <Field label="Código de recuperación" icon="key-outline" autoCorrect={false} autoCapitalize="none" value={token} onChangeText={(value) => { setToken(value); setError(''); }} placeholder="Pega aquí el código del correo" editable={!loading} /> : null}
        <Field label="Nueva contraseña" icon="lock-outline" accessibilityHint="Usa al menos 8 caracteres, una mayúscula, una minúscula y un número." autoComplete="new-password" textContentType="newPassword" secureTextEntry value={password} onChangeText={(value) => { setPassword(value); setError(''); }} editable={!loading} />
        <Field label="Repite la nueva contraseña" icon="lock-check-outline" autoComplete="new-password" textContentType="newPassword" secureTextEntry value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setError(''); }} editable={!loading} />
        <PasswordRules password={password} confirmPassword={confirmPassword} />
        <FormError message={error} />
        <PrimaryButton title="Guardar nueva contraseña" icon="content-save-outline" onPress={submit} loading={loading} />
        {!navigation.canGoBack() ? <SecondaryButton title="Ir a iniciar sesión" icon="login" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })} disabled={loading} /> : null}
      </Card>
      <Muted>Al guardar, se cerrarán las sesiones abiertas en tus otros dispositivos.</Muted>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 580, alignSelf: 'center' },
  card: { padding: 22, borderRadius: 26 }
});
