import React, { useEffect, useRef, useState } from 'react';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Field, FormError, LoadingState, Muted, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { AiUsageCard } from '../components/AiUsageCard';
import { AiRecordSelector } from '../components/AiRecordSelector';
import { useProfiles } from '../context/ProfileContext';
import { useProfileResource } from '../hooks/useProfileResource';
import type { PlanStatus } from '../types/domain';
import { aiBlockedReason } from '../utils/ai-access';
import { colors } from '../theme/colors';

type Message = { id?: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt?: string };
type Conversation = { conversation: { id: string } | null; messages: Message[] };
const fetchChat = (id: string) => Promise.all([
  apiRequest<Conversation>(`/profiles/${id}/ai/chat/latest`),
  apiRequest<PlanStatus>(`/profiles/${id}/ai/status`)
]).then(([chat, status]) => ({ chat, status }));

export function ChatScreen(props: any) {
  const { selectedProfile } = useProfiles();
  return <ChatForProfile key={selectedProfile?.id || 'none'} {...props} />;
}

function ChatForProfile({ navigation }: any) {
  const { profileId, data, error, loading, refresh } = useProfileResource(fetchChat);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [medicationIds, setMedicationIds] = useState<string[]>([]);
  const inFlight = useRef(false);
  useEffect(() => { if (data) setMessages(data.chat.messages); }, [data]);
  const reason = aiBlockedReason(data?.status || null, 'chat');
  const chatAvailable = Boolean(profileId && data && !reason && !sending);

  async function send() {
    if (!profileId || !chatAvailable || !text.trim() || inFlight.current) return;
    inFlight.current = true;
    const content = text.trim();
    setSending(true);
    try {
      const response = await apiRequest<{ message: Message }>(`/profiles/${profileId}/ai/chat`, { method: 'POST', body: JSON.stringify({ conversationId: data?.chat.conversation?.id, message: content, eventIds: selected, medicationIds }) });
      setMessages((current) => [...current, { role: 'USER', content }, response.message]);
      setText('');
    } catch (error: any) { Alert.alert('Asistente no disponible', error.message); }
    finally { await refresh(); setSending(false); inFlight.current = false; }
  }

  return <Screen>
    <AppTitle title="Asistente de organización" subtitle="Ordena lo que quieres registrar y prepara preguntas. No diagnostica ni indica tratamientos o decisiones de urgencia." />
    <ProfileSelector />
    {loading ? <LoadingState /> : null}
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar" onPress={refresh} /></> : null}
    {data ? <AiUsageCard status={data.status} onRenew={refresh} /> : null}
    {!profileId ? <Card><Muted>Selecciona un perfil para usar el asistente.</Muted></Card> : null}
    {data && reason ? <Card><Muted>{reason}</Muted><SecondaryButton title="Ir al centro de IA" onPress={() => navigation.navigate('AICenter')} />{data.status.chat.limit === 0 ? <SecondaryButton title="Ver planes" onPress={() => navigation.navigate('Plan')} /> : null}</Card> : null}
    {profileId ? <AiRecordSelector profileId={profileId} selected={selected} onChange={setSelected} medicationIds={medicationIds} onMedicationChange={setMedicationIds} disabled={sending} /> : null}
    <Muted>{selected.length || medicationIds.length ? 'Cada envío usará la información seleccionada actualizada y hasta 12 mensajes anteriores de este perfil.' : 'Sin registros seleccionados, el asistente solo dispone de esta conversación. Selecciona información para consultar tu historial.'}</Muted>
    {messages.map((message, index) => <Card key={message.id || index} style={{ backgroundColor: message.role === 'USER' ? colors.primarySoft : colors.aiSoft, marginLeft: message.role === 'USER' ? 24 : 0 }}><Text style={{ color: colors.muted, fontWeight: '800' }}>{message.role === 'USER' ? 'Tú' : 'Asistente'}</Text><Text style={{ marginTop: 6, lineHeight: 25 }}>{message.content}</Text></Card>)}
    {!messages.length && data ? <Card><Muted>Ejemplo: “Ayúdame a convertir esta molestia en un registro claro”.</Muted></Card> : null}
    <Field label="Mensaje" hint={`${text.length}/1500 caracteres. Cada envío respondido consume un mensaje de tu cupo.`} value={text} onChangeText={setText} multiline maxLength={1500} placeholder="Describe qué quieres ordenar o registrar" editable={chatAvailable} />
    <PrimaryButton title="Enviar" onPress={send} disabled={!chatAvailable || !text.trim()} loading={sending} />
  </Screen>;
}
