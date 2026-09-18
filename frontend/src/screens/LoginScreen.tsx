import React, { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppTitle, Card, Field, FormError, Muted, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme/colors';

export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 900 && fontScale < 1.4;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (loading) return;
    setError('');
    if (!email.trim() || !password) return setError('Escribe tu correo y tu contraseña para entrar.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Revisa tu correo. Debe tener un formato como nombre@correo.com.');
    setLoading(true);
    try { await login(email.trim(), password); }
    catch (e: any) { setError(e.message || 'No pudimos iniciar sesión. Inténtalo de nuevo.'); }
    finally { setLoading(false); }
  }
  return <Screen>
    <View style={styles.brand}><BrandLogo withName size={48} /></View>
    <View style={[styles.layout, wide && styles.wide]}>
      <View style={[styles.intro, wide && styles.introWide]}>
        <View style={styles.tag}><MaterialCommunityIcons name="heart-pulse" size={22} color={colors.primary} /><Text style={styles.tagText}>CONTIGO, CADA DÍA</Text></View>
        <AppTitle title="Tu salud, más fácil de cuidar." subtitle="Tus medicamentos, consultas y documentos, juntos en un lugar." />
        {wide ? <View style={styles.steps}>
          {([
            ['pill', 'Recuerda tus medicamentos', 'Consulta los horarios y anota tus tomas.'],
            ['clipboard-text-outline', 'Encuentra tu historia', 'Revisa lo que has guardado, por fecha.'],
            ['account-heart-outline', 'Cuida también de los tuyos', 'Organiza la información de tu familia.']] as const).map(([icon, title, description]) => <View key={title} style={styles.step}><View style={styles.stepIcon}><MaterialCommunityIcons name={icon} size={27} color={colors.primary} /></View><View style={{ flex: 1 }}><Text style={styles.stepTitle}>{title}</Text><Muted>{description}</Muted></View></View>)}
        </View> : null}
      </View>
      <View style={[styles.form, wide && { flex: 1 }]}>
        <Card style={{ padding: wide ? 28 : 20 }}>
          <Text accessibilityRole="header" style={styles.formTitle}>Entra a tu cuenta</Text><Text style={styles.formHint}>Escribe los datos con los que te registraste.</Text>
          <Field label="Correo electrónico" autoComplete="email" textContentType="emailAddress" autoCorrect={false} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} placeholder="nombre@correo.com" editable={!loading} />
          <Field label="Contraseña" autoComplete="current-password" textContentType="password" secureTextEntry value={password} onChangeText={(value) => { setPassword(value); setError(''); }} placeholder="Escribe tu contraseña" returnKeyType="go" onSubmitEditing={() => { void submit(); }} editable={!loading} />
          <FormError message={error} />
          <PrimaryButton title="Entrar a mi cuenta" onPress={submit} loading={loading} />
          <View style={styles.divider} /><Text style={styles.newAccount}>¿Es tu primera vez aquí?</Text>
          <SecondaryButton title="Crear mi cuenta" onPress={() => navigation.navigate('Register')} disabled={loading} />
        </Card>
        <View style={styles.privacy}><MaterialCommunityIcons name="lock-outline" size={21} color={colors.primary} /><Text style={styles.privacyText}>Tu información es privada. Tú eliges con quién compartirla.</Text></View>
      </View>
    </View>
  </Screen>;
}
const styles = StyleSheet.create({
  brand: { marginBottom: 32 },
  layout: { gap: 24, width: '100%', maxWidth: 580, alignSelf: 'center' },
  wide: { flexDirection: 'row', alignItems: 'flex-start', maxWidth: 1100, gap: 52, marginTop: 20 },
  intro: { width: '100%' }, introWide: { flex: 1, width: 'auto', paddingTop: 28 },
  tag: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 18 },
  tagText: { fontFamily: fonts.bold, color: colors.primary, fontSize: 16, letterSpacing: 1 },
  steps: { gap: 28, marginTop: 14 },
  step: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  stepIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: fonts.bold, color: colors.text, fontSize: 18, lineHeight: 27, marginBottom: 5 },
  form: { width: '100%', minWidth: 0 },
  formTitle: { fontFamily: fonts.bold, fontSize: 25, lineHeight: 34, color: colors.text, marginBottom: 8 },
  formHint: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.muted, marginBottom: 28 },
  divider: { height: 1, backgroundColor: colors.border, marginTop: 20, marginBottom: 20 },
  newAccount: { fontFamily: fonts.regular, color: colors.muted, fontSize: 16, textAlign: 'center', marginBottom: 6 },
  privacy: { flexDirection: 'row', gap: 10, paddingHorizontal: 8 },
  privacyText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted, flex: 1 }
});
