import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Field, FormError, Muted, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { colors, fonts } from '../theme/colors';

/** RF-03: inicia la recuperación sin revelar si el correo tiene una cuenta. */
export function RecoverPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (loading) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Escribe el correo con el que te registraste, por ejemplo nombre@correo.com.');
    setLoading(true);
    try {
      const response = await apiRequest<{ message: string }>('/auth/recover', { method: 'POST', body: JSON.stringify({ email: email.trim() }) }, false);
      setSent(response.message);
    } catch (e: any) { setError(e.message || 'No pudimos enviar la solicitud. Inténtalo de nuevo.'); }
    finally { setLoading(false); }
  }
  return <Screen form>
    <View style={styles.container}>
      <AppTitle eyebrow="Recuperar acceso" title="¿Olvidaste tu contraseña?" subtitle="Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva. Vence en 30 minutos y solo funciona una vez." />
      <Card style={styles.card}>
        <Field label="Correo electrónico" icon="email-outline" autoComplete="email" autoCorrect={false} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} placeholder="nombre@correo.com" editable={!loading} />
        <FormError message={error} />
        {sent ? <View accessibilityLiveRegion="polite" style={styles.sent}><MaterialCommunityIcons name="email-check-outline" size={26} color={colors.success} /><Text style={styles.sentText}>{sent}</Text></View> : null}
        <PrimaryButton title={sent ? 'Enviar de nuevo' : 'Enviar instrucciones'} icon="email-fast-outline" onPress={submit} loading={loading} />
        <SecondaryButton title="Tengo un código" icon="key-outline" onPress={() => navigation.navigate('ResetPassword')} />
      </Card>
      <Muted>Por tu seguridad, al cambiar la contraseña se cerrarán las sesiones abiertas en otros dispositivos.</Muted>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  container: { width: '100%', maxWidth: 580, alignSelf: 'center' },
  card: { padding: 22, borderRadius: 26 },
  sent: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 14, marginBottom: 8, borderRadius: 16, backgroundColor: colors.primarySoft },
  sentText: { flex: 1, color: colors.text, fontFamily: fonts.medium }
});
