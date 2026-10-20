import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppTitle, Card, Field, FormError, IconBadge, Muted, Pill, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../hooks/useLayout';
import { colors, fonts } from '../theme/colors';

const features = [
  ['pill', 'Recuerda tus medicamentos', 'Consulta los horarios y anota tus tomas.'],
  ['clipboard-text-outline', 'Encuentra tu historia', 'Revisa lo que has guardado, por fecha.'],
  ['account-heart-outline', 'Cuida también de los tuyos', 'Organiza la información de tu familia.']
] as const;

export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { width, height, largeText } = useLayout();
  const wide = width >= 900 && !largeText;
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
  const tag = <View style={styles.tag}><MaterialCommunityIcons name="heart-pulse" size={20} color={colors.primary} /><Text style={styles.tagText}>CONTIGO, CADA DÍA</Text></View>;
  const privacy = <View style={styles.privacy}><MaterialCommunityIcons name="shield-lock-outline" size={22} color={colors.primary} /><Text style={styles.privacyText}>Tu información es privada. Tú eliges con quién compartirla.</Text></View>;
  const form = <Card style={[styles.formCard, wide && styles.formCardWide]}>
    <Text accessibilityRole="header" style={styles.formTitle}>Entra a tu cuenta</Text><Text style={styles.formHint}>Escribe los datos con los que te registraste.</Text>
    <Field label="Correo electrónico" icon="email-outline" autoComplete="email" textContentType="emailAddress" autoCorrect={false} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} placeholder="nombre@correo.com" editable={!loading} />
    <Field label="Contraseña" icon="lock-outline" autoComplete="current-password" textContentType="password" secureTextEntry value={password} onChangeText={(value) => { setPassword(value); setError(''); }} placeholder="Escribe tu contraseña" returnKeyType="go" onSubmitEditing={() => { void submit(); }} editable={!loading} />
    <FormError message={error} />
    <PrimaryButton title="Entrar a mi cuenta" icon="login" onPress={submit} loading={loading} />
    <View style={styles.dividerRow}><View style={styles.divider} /><Text style={styles.newAccount}>¿Es tu primera vez aquí?</Text><View style={styles.divider} /></View>
    <SecondaryButton title="Crear mi cuenta" icon="account-plus-outline" onPress={() => navigation.navigate('Register')} disabled={loading} />
  </Card>;

  if (wide) return <Screen>
    <View style={[styles.wideFrame, { minHeight: Math.max(0, height - 110) }]}><View style={styles.wide}>
      <Card tone="hero" style={styles.panel}>
        <View aria-hidden style={styles.panelArt}><MaterialCommunityIcons name="heart-pulse" size={260} color="rgba(121, 221, 202, 0.07)" /></View>
        <BrandLogo withName size={52} />
        <View style={styles.panelCopy}>
          {tag}
          <AppTitle title="Tu salud, más fácil de cuidar." subtitle="Tus medicamentos, consultas y documentos, juntos en un lugar." />
          <View style={styles.steps}>
            {features.map(([icon, title, description]) => <View key={title} style={styles.step}><IconBadge icon={icon} size={52} /><View style={{ flex: 1 }}><Text style={styles.stepTitle}>{title}</Text><Muted>{description}</Muted></View></View>)}
          </View>
        </View>
        {privacy}
      </Card>
      <View style={styles.formColumn}>{form}</View>
    </View></View>
  </Screen>;

  return <Screen>
    <View style={styles.layout}>
      <View style={styles.brand}><BrandLogo withName size={52} /></View>
      {tag}
      <AppTitle title="Tu salud, más fácil de cuidar." subtitle="Tus medicamentos, consultas y documentos, juntos en un lugar." />
      <View style={styles.pills}>
        <Pill icon="pill" label="Medicamentos" />
        <Pill icon="clipboard-text-outline" label="Historial" tone="accent" />
        <Pill icon="account-heart-outline" label="Familia" tone="ai" />
      </View>
      {form}
      {privacy}
    </View>
  </Screen>;
}
const styles = StyleSheet.create({
  layout: { width: '100%', maxWidth: 580, alignSelf: 'center' },
  brand: { marginBottom: 32 },
  wideFrame: { justifyContent: 'center' },
  wide: { flexDirection: 'row', alignItems: 'stretch', width: '100%', maxWidth: 1100, alignSelf: 'center', gap: 32 },
  panel: { flex: 1.1, padding: 36, marginBottom: 0, borderRadius: 30, overflow: 'hidden', justifyContent: 'space-between', gap: 32 },
  panelArt: { position: 'absolute', right: -60, bottom: -40, pointerEvents: 'none' },
  panelCopy: { gap: 4 },
  formColumn: { flex: 1, minWidth: 0, justifyContent: 'center' },
  tag: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 14 },
  tagText: { fontFamily: fonts.bold, color: colors.primary, fontSize: 15, letterSpacing: 1.4 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6, marginBottom: 24 },
  steps: { gap: 24, marginTop: 8 },
  step: { flexDirection: 'row', gap: 16, alignItems: 'center' },
  stepTitle: { fontFamily: fonts.bold, color: colors.text, fontSize: 18, lineHeight: 27, marginBottom: 2 },
  formCard: { padding: 22, borderRadius: 26 },
  formCardWide: { padding: 32, marginBottom: 0 },
  formTitle: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 35, letterSpacing: -0.4, color: colors.text, marginBottom: 6 },
  formHint: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 25, color: colors.muted, marginBottom: 26 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, marginBottom: 8 },
  divider: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  newAccount: { flexShrink: 1, fontFamily: fonts.regular, color: colors.muted, fontSize: 16, textAlign: 'center' },
  privacy: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 6, marginTop: 4 },
  privacyText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 24, color: colors.muted, flex: 1 }
});
