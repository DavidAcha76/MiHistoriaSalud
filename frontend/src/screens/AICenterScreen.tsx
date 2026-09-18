import React, { useRef, useState } from 'react';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { apiRequest } from '../api/client';
import { AppTitle, Card, FormError, LoadingState, MenuGrid, MenuTile, Muted, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { AiUsageCard } from '../components/AiUsageCard';
import { useProfileResource } from '../hooks/useProfileResource';
import type { PlanStatus } from '../types/domain';
import { aiBlockedReason } from '../utils/ai-access';

const fetchStatus = (id: string) => apiRequest<PlanStatus>(`/profiles/${id}/ai/status`);

export function AICenterScreen({ navigation }: any) {
  const { profileId, data: status, error, loading, refresh } = useProfileResource(fetchStatus);
  const [busy, setBusy] = useState(false);
  const currentProfile = useRef(profileId);
  currentProfile.current = profileId;
  async function setConsent() {
    if (!profileId || !status || busy) return;
    setBusy(true);
    try {
      await apiRequest(`/profiles/${profileId}/ai/consent`, { method: 'PUT', body: JSON.stringify({ granted: !status.consent.granted }) });
      if (currentProfile.current === profileId) await refresh();
    } catch (error: any) { Alert.alert('Consentimiento', error.message); }
    finally { setBusy(false); }
  }
  return <Screen>
    <AppTitle title="Tu centro de IA" subtitle="Revisa tus registros, ordena tus ideas y prepara preguntas para tu próxima consulta." />
    <ProfileSelector />
    {!profileId ? <Card><Muted>Crea o selecciona un perfil para usar las herramientas de IA.</Muted></Card> : null}
    {loading ? <LoadingState label="Cargando tu plan y uso de IA…" /> : null}
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar" onPress={refresh} /></> : null}
    {status ? <AiUsageCard status={status} onRenew={refresh} /> : null}
    <SectionTitle>¿Qué quieres hacer?</SectionTitle>
    <MenuGrid>
      <MenuTile icon="text-box-search-outline" label="Revisar mis registros" hint={status ? aiBlockedReason(status, 'analysis') || 'Elige registros y genera una revisión informativa' : 'Resumen, datos incompletos y preguntas para consulta'} tone="ai" onPress={() => navigation.navigate('AIAnalysis')} />
      <MenuTile icon="chat-processing-outline" label="Hablar con el asistente" hint={status ? aiBlockedReason(status, 'chat') || 'Organiza lo que quieres registrar o preguntar' : 'Chat para organizar tu información'} tone="ai" onPress={() => navigation.navigate('Chat')} />
      <MenuTile icon="history" label="Mis revisiones" hint="Consulta tus resultados guardados" tone="ai" onPress={() => navigation.navigate('AIHistory')} />
      <MenuTile icon="medal-outline" label="Mi plan y suscripción" hint="Consulta los beneficios de Gratis, Plata y Oro" onPress={() => navigation.navigate('Plan')} />
    </MenuGrid>
    <SectionTitle>Permiso para este perfil</SectionTitle>
    <Card>
      <Text style={{ fontWeight: '800', marginBottom: 8 }}>{status?.consent.granted ? 'Uso de IA autorizado' : 'Tú decides cuándo autorizar la IA'}</Text>
      <Muted>Al autorizar, permites enviar los registros seleccionados y tus mensajes a nuestro proveedor de IA, DeepSeek, para organizar tu información.</Muted>
      <Muted>La IA solo se ejecuta cuando solicitas una revisión o envías un mensaje. Elige los registros y horarios de medicamentos que quieres incluir como contexto.</Muted>
      <Muted>Puedes retirar el permiso en cualquier momento para impedir nuevas solicitudes. Las revisiones guardadas seguirán disponibles.</Muted>
      <SecondaryButton title={status?.consent.granted ? 'Retirar permiso de IA' : 'Autorizar uso de IA'} onPress={setConsent} disabled={!status || !profileId} loading={busy} />
    </Card>
    <Muted>La IA organiza información. No diagnostica ni indica estudios, tratamientos o decisiones de urgencia.</Muted>
  </Screen>;
}
