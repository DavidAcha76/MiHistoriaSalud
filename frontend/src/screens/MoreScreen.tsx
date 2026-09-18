import React, { useState } from 'react';
import { View } from 'react-native';

import { AppText as Text } from '../components/AppText';
import { AppTitle, Card, Disclosure, MenuGrid, MenuTile, Muted, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { useAuth } from '../context/AuthContext';
import { colors, fonts } from '../theme/colors';

export function MoreScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);
  return <Screen>
    <AppTitle title="Más opciones" subtitle="Tu familia, tus documentos y la ayuda que necesitas." />
    <ProfileSelector />
    <SectionTitle>Tu información y tu familia</SectionTitle>
    <MenuGrid>
      <MenuTile icon="file-document-multiple-outline" label="Mis documentos" hint="Recetas, resultados y archivos" onPress={() => navigation.navigate('Documents')} />
      <MenuTile icon="account-multiple-outline" label="Perfiles de mi familia" hint="Añadir o editar una persona" onPress={() => navigation.navigate('Profiles')} tone="accent" />
      <MenuTile icon="stethoscope" label="Preparar mi consulta" hint="Un resumen de mis registros" onPress={() => navigation.navigate('Summary')} />
      <MenuTile icon="share-variant-outline" label="Compartir o descargar" hint="Elegir qué información compartir" onPress={() => navigation.navigate('Share')} tone="accent" />
      <MenuTile icon="bell-outline" label="Avisos" hint="Recordatorios y novedades" onPress={() => navigation.navigate('Notifications')} />
    </MenuGrid>
    <Disclosure title="Cómo usar Clinia, paso a paso">
      <Card><Text style={{ fontFamily: fonts.bold, marginBottom: 8 }}>1. Comprueba el nombre de la persona</Text><Muted>Verás de quién es la información antes de consultar o añadir un registro.</Muted><Text style={{ fontFamily: fonts.bold, marginTop: 20, marginBottom: 8 }}>2. Elige lo que necesitas</Text><Muted>En Inicio puedes añadir un registro. En Medicinas ves tus horarios. En Historial encuentras lo que guardaste.</Muted><Text style={{ fontFamily: fonts.bold, marginTop: 20, marginBottom: 8 }}>3. Guarda y vuelve cuando quieras</Text><Muted>Los campos opcionales pueden quedar vacíos. Usa Volver para regresar a la pantalla anterior.</Muted></Card>
    </Disclosure>
    <SectionTitle>Mi cuenta</SectionTitle>
    <Card><Text style={{ fontFamily: fonts.bold, fontSize: 20 }}>{user?.fullName}</Text><Muted>{user?.email}</Muted><View style={{ marginTop: 14 }}><SecondaryButton title="Ver mi plan y uso de IA" onPress={() => navigation.navigate('Plan')} /></View></Card>
    <SecondaryButton title="Cerrar mi sesión" onPress={() => setConfirmLogout(true)} />
    <ConfirmationDialog visible={confirmLogout} title="¿Quieres cerrar tu sesión?" message="Tus datos seguirán guardados. Necesitarás tu correo y contraseña para volver a entrar." confirmTitle="Sí, cerrar sesión" onConfirm={() => { setConfirmLogout(false); void logout(); }} onCancel={() => setConfirmLogout(false)} />
  </Screen>;
}
