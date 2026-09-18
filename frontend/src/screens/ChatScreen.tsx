import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Field, Muted, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { ProfileSelector } from '../components/ProfileSelector';
import { useProfiles } from '../context/ProfileContext';
import type { PlanStatus } from '../types/domain';
import { colors } from '../theme/colors';

type Message = { id?: string; role: 'USER' | 'ASSISTANT'; content: string; createdAt?: string };

export function ChatScreen({ navigation }: any) {
  const { selectedProfile } = useProfiles();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [sending, setSending] = useState(false);
  const load = useCallback(() => {
    if (!selectedProfile) return;
    Promise.all([
      apiRequest<any>(`/profiles/${selectedProfile.id}/ai/chat/latest`),
      apiRequest<PlanStatus>(`/profiles/${selectedProfile.id}/ai/status`)
    ]).then(([chat, plan]) => { setConversationId(chat.conversation?.id); setMessages(chat.messages || []); setStatus(plan); }).catch((error: any) => Alert.alert('Asistente', error.message));
  }, [selectedProfile?.id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function send() {
    if (!selectedProfile || !text.trim()) return;
    const content = text.trim(); setText(''); setSending(true);
    try {
      const response = await apiRequest<any>(`/profiles/${selectedProfile.id}/ai/chat`, { method: 'POST', body: JSON.stringify({ conversationId, message: content }) });
      setConversationId(response.conversationId);
      setMessages((current) => [...current, { role: 'USER', content }, response.message]);
      setStatus((current) => current ? { ...current, chat: { ...current.chat, usedThisWeek: current.chat.usedThisWeek + 1 } } : current);
    } catch (error: any) { setText(content); Alert.alert('Asistente no disponible', error.message); } finally { setSending(false); }
  }

  const chatAvailable = status?.consent.granted && status.plan.weeklyChatLimit !== 0;
  return <Screen>
    <AppTitle title="Asistente de organización" subtitle="Te ayuda a ordenar registros y preparar preguntas. No diagnostica, decide urgencias ni indica tratamientos." />
    <ProfileSelector />
    {!chatAvailable ? <Card style={{ backgroundColor: colors.warningSoft }}><Text style={{ fontWeight: '800', color: colors.text }}>El asistente requiere consentimiento de IA y plan Plata u Oro.</Text><SecondaryButton title="Ver planes" onPress={() => navigation.navigate('Plan')} /></Card> : null}
    {messages.map((message, index) => <Card key={message.id || index} style={{ backgroundColor: message.role === 'USER' ? colors.primarySoft : colors.aiSoft, marginLeft: message.role === 'USER' ? 28 : 0 }}><Text style={{ fontSize: 16, color: colors.muted, fontWeight: '800' }}>{message.role === 'USER' ? 'Tú' : 'Asistente'}</Text><Text style={{ marginTop: 5, color: colors.text, lineHeight: 25 }}>{message.content}</Text></Card>)}
    {!messages.length ? <Card><Muted>Ejemplo: “Ayúdame a convertir esta molestia en un registro claro”.</Muted></Card> : null}
    <View style={{ opacity: chatAvailable ? 1 : .55 }}><Field label="Mensaje" value={text} onChangeText={setText} multiline placeholder="Describe qué quieres ordenar o registrar" editable={Boolean(chatAvailable) && !sending} /><PrimaryButton title="Enviar" onPress={send} disabled={!chatAvailable || !text.trim()} loading={sending} /></View>
  </Screen>;
}
