import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText as Text } from '../components/AppText';
import { AppTitle, Avatar, Card, Disclosure, Grid, IconBadge, MenuGrid, MenuTile, Muted, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../hooks/useLayout';
import { colors, fonts } from '../theme/colors';

const steps = [
  ['account-check-outline', '1. Comprueba el nombre de la persona', 'Verás de quién es la información antes de consultar o añadir un registro.'],
  ['gesture-tap', '2. Elige lo que necesitas', 'En Inicio puedes añadir un registro. En Medicinas ves tus horarios. En Historial encuentras lo que guardaste.'],
  ['content-save-check-outline', '3. Guarda y vuelve cuando quieras', 'Los campos opcionales pueden quedar vacíos. Usa Volver para regresar a la pantalla anterior.']
] as const;

export function MoreScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const { twoColumns } = useLayout();
  const [confirmLogout, setConfirmLogout] = useState(false);
  return <Screen>
    <AppTitle title="Más opciones" subtitle="Tu familia, tus documentos y la ayuda que necesitas." />
    <Card tone="hero" style={styles.account}>
      <View style={[styles.accountRow, twoColumns && styles.accountRowWide]}>
        <View style={styles.identity}>
          <Avatar name={user?.fullName || user?.email || 'Clinia'} size={56} />
          <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.name}>{user?.fullName}</Text><Muted>{user?.email}</Muted></View>
        </View>
        <View style={twoColumns ? styles.accountAction : undefined}><SecondaryButton title="Ver mi plan y uso de IA" icon="medal-outline" onPress={() => navigation.navigate('Plan')} /></View>
      </View>
    </Card>
    <ProfileSelector />
    <SectionTitle>Tu información y tu familia</SectionTitle>
    <MenuGrid>
      <MenuTile icon="file-document-multiple-outline" label="Mis documentos" hint="Recetas, resultados y archivos" onPress={() => navigation.navigate('Documents')} />
      <MenuTile icon="account-multiple-outline" label="Perfiles de mi familia" hint="Añadir o editar una persona" onPress={() => navigation.navigate('Profiles')} tone="accent" />
      <MenuTile icon="stethoscope" label="Preparar mi consulta" hint="Un resumen de mis registros" onPress={() => navigation.navigate('Summary')} />
      <MenuTile icon="share-variant-outline" label="Compartir o descargar" hint="Elegir qué información compartir" onPress={() => navigation.navigate('Share')} tone="accent" />
      <MenuTile icon="bell-outline" label="Avisos" hint="Recordatorios y novedades" onPress={() => navigation.navigate('Notifications')} tone="warning" />
    </MenuGrid>
    <Disclosure title="Cómo usar Clinia, paso a paso">
      <Grid min={260}>
        {steps.map(([icon, title, text]) => <View key={title} style={styles.step}><IconBadge icon={icon} size={44} /><Text style={styles.stepTitle}>{title}</Text><Muted>{text}</Muted></View>)}
      </Grid>
    </Disclosure>
    <SectionTitle>Mi cuenta</SectionTitle>
    <SecondaryButton title="Cerrar mi sesión" icon="logout" danger onPress={() => setConfirmLogout(true)} />
    <ConfirmationDialog visible={confirmLogout} title="¿Quieres cerrar tu sesión?" message="Tus datos seguirán guardados. Necesitarás tu correo y contraseña para volver a entrar." confirmTitle="Sí, cerrar sesión" onConfirm={() => { setConfirmLogout(false); void logout(); }} onCancel={() => setConfirmLogout(false)} />
  </Screen>;
}

const styles = StyleSheet.create({
  account: { padding: 20, borderRadius: 24 },
  accountRow: { gap: 8 },
  accountRowWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  accountAction: { minWidth: 260 },
  name: { fontFamily: fonts.bold, fontSize: 21, lineHeight: 29, color: colors.text },
  step: { gap: 8, padding: 16, marginBottom: 14, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderSoft },
  stepTitle: { fontFamily: fonts.bold, marginTop: 4 }
});
