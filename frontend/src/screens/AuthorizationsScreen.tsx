import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { AppText as Text } from '../components/AppText';
import { apiRequest } from '../api/client';
import { AppTitle, Avatar, Card, Chip, EmptyState, Field, FormError, Grid, LoadingState, Muted, Pill, PrimaryButton, Screen, SecondaryButton, SectionTitle } from '../components/ui';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { useFeedback } from '../context/FeedbackContext';
import { nameOf, useProfiles } from '../context/ProfileContext';
import type { ProfileAuthorization } from '../types/domain';
import { roleHints, roleLabels } from '../utils/audit';
import { colors, fonts } from '../theme/colors';

type Role = ProfileAuthorization['role'];

/** RF-07: el titular decide qué otras cuentas pueden consultar o actualizar este perfil. */
export function AuthorizationsScreen({ route }: any) {
  const notify = useFeedback();
  const { profiles } = useProfiles();
  const profileId: string = route.params.profileId;
  const profile = profiles.find((item) => item.id === profileId);
  const [items, setItems] = useState<ProfileAuthorization[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('VIEWER');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState<ProfileAuthorization | null>(null);
  const load = useCallback(() => {
    setError('');
    apiRequest<ProfileAuthorization[]>(`/profiles/${profileId}/authorizations`).then(setItems).catch((e: any) => { setItems([]); setError(e.message || 'No pudimos cargar las autorizaciones.'); });
  }, [profileId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function grant() {
    if (busy) return;
    setError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Escribe el correo de la cuenta de Clinia de esa persona.');
    setBusy(true);
    try {
      await apiRequest(`/profiles/${profileId}/authorizations`, { method: 'POST', body: JSON.stringify({ email: email.trim(), role }) });
      setEmail('');
      notify(`Autorización guardada: ${roleLabels[role].toLowerCase()}.`);
      load();
    } catch (e: any) { setError(e.message || 'No pudimos guardar la autorización.'); }
    finally { setBusy(false); }
  }
  async function update(item: ProfileAuthorization, body: Partial<Pick<ProfileAuthorization, 'role' | 'status'>>) {
    setBusy(true); setError('');
    try { await apiRequest(`/profiles/${profileId}/authorizations/${item.id}`, { method: 'PATCH', body: JSON.stringify(body) }); load(); }
    catch (e: any) { setError(e.message || 'No pudimos actualizar la autorización.'); }
    finally { setBusy(false); }
  }

  const active = (items || []).filter((item) => item.status === 'ACTIVE');
  const revoked = (items || []).filter((item) => item.status === 'REVOKED');
  return <Screen>
    <AppTitle eyebrow="Permisos" title="Personas autorizadas" subtitle={`Elige quién más puede ver o actualizar la información de ${profile ? nameOf(profile) : 'este perfil'}. Puedes revocar el permiso cuando quieras.`} />
    <Card tone="hero">
      <Text style={styles.cardTitle}>Autorizar a otra cuenta</Text>
      <Muted>La persona debe tener una cuenta de Clinia con ese correo. Verá este perfil en su lista de perfiles.</Muted>
      <View style={{ height: 14 }} />
      <Field label="Correo de la persona" icon="email-outline" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} placeholder="familiar@correo.com" editable={!busy} />
      <Text style={styles.label}>Permiso</Text>
      <View style={styles.roles}>{(['VIEWER', 'REPRESENTATIVE'] as Role[]).map((value) => <Chip key={value} label={roleLabels[value]} selected={role === value} onPress={() => setRole(value)} />)}</View>
      <Muted>{roleHints[role]}</Muted>
      <FormError message={error} />
      <PrimaryButton title="Autorizar" icon="account-key-outline" onPress={grant} loading={busy} />
    </Card>
    <SectionTitle right={<Pill label={`${active.length} vigentes`} tone="accent" />}>Con acceso ahora</SectionTitle>
    {items === null ? <LoadingState label="Buscando autorizaciones…" /> : active.length ? <Grid min={340}>{active.map((item) => <Card key={item.id}>
      <View style={styles.heading}><Avatar name={item.fullName} size={46} /><View style={styles.copy}><Text style={styles.name}>{item.fullName}</Text><Muted>{item.email}</Muted></View><Pill label={roleLabels[item.role]} tone={item.role === 'VIEWER' ? 'neutral' : 'primary'} /></View>
      <View style={styles.actions}>
        <View style={styles.action}><SecondaryButton title={item.role === 'VIEWER' ? 'Permitir actualizar' : 'Dejar solo consulta'} icon="account-edit-outline" disabled={busy} onPress={() => { void update(item, { role: item.role === 'VIEWER' ? 'REPRESENTATIVE' : 'VIEWER' }); }} /></View>
        <View style={styles.action}><SecondaryButton title="Revocar acceso" icon="account-cancel-outline" danger disabled={busy} onPress={() => setRevoking(item)} /></View>
      </View>
    </Card>)}</Grid> : <EmptyState icon="account-lock-outline" text="Nadie más tiene acceso a este perfil." />}
    {revoked.length ? <>
      <SectionTitle>Accesos revocados</SectionTitle>
      {revoked.map((item) => <Card key={item.id} style={{ backgroundColor: colors.background }}>
        <View style={styles.heading}><Avatar name={item.fullName} size={40} /><View style={styles.copy}><Text style={styles.name}>{item.fullName}</Text><Muted>{item.email} · {item.revokedAt ? `revocado el ${new Date(item.revokedAt).toLocaleDateString('es-BO')}` : 'revocado'}</Muted></View></View>
        <SecondaryButton title="Restablecer acceso" icon="account-reactivate-outline" disabled={busy} onPress={() => { void update(item, { status: 'ACTIVE' }); }} />
      </Card>)}
    </> : null}
    <ConfirmationDialog visible={Boolean(revoking)} title="¿Revocar el acceso?" message={revoking ? `${revoking.fullName} dejará de ver este perfil de inmediato. La acción queda registrada en la trazabilidad.` : ''} confirmTitle="Sí, revocar acceso" onConfirm={() => { const item = revoking; setRevoking(null); if (item) void update(item, { status: 'REVOKED' }); }} onCancel={() => setRevoking(null)} />
  </Screen>;
}

const styles = StyleSheet.create({
  cardTitle: { fontFamily: fonts.bold, fontSize: 19, lineHeight: 27, marginBottom: 4 },
  label: { fontFamily: fonts.semibold, fontSize: 17, marginBottom: 8 },
  roles: { flexDirection: 'row', flexWrap: 'wrap' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 6 },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0 },
  name: { fontFamily: fonts.bold },
  actions: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10 },
  action: { flexGrow: 1, flexBasis: 200 }
});
