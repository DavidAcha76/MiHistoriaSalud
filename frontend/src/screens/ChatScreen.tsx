import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText as Text } from '../components/AppText';
import { AppAlert as Alert } from '../utils/alerts';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Field, FormError, IconBadge, LoadingState, Muted, PrimaryButton, Screen, SecondaryButton } from '../components/ui';
import { useLayout } from '../hooks/useLayout';
import { ProfileSelector } from '../components/ProfileSelector';
import { AiUsageCard } from '../components/AiUsageCard';
import { AiRecordSelector } from '../components/AiRecordSelector';
import { useProfiles } from '../context/ProfileContext';
import { useProfileResource } from '../hooks/useProfileResource';
import type { PlanStatus } from '../types/domain';
import { aiBlockedReason } from '../utils/ai-access';
import { colors, fonts } from '../theme/colors';

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
  const { twoColumns } = useLayout();
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
    <AppTitle eyebrow="Asistente de IA" title="Asistente de organización" subtitle="Ordena lo que quieres registrar y prepara preguntas. No diagnostica ni indica tratamientos o decisiones de urgencia." />
    <ProfileSelector />
    {loading ? <LoadingState /> : null}
    {error ? <><FormError message={error} /><SecondaryButton title="Volver a cargar" onPress={refresh} /></> : null}
    {data ? <AiUsageCard status={data.status} onRenew={refresh} /> : null}
    {!profileId ? <Card><Muted>Selecciona un perfil para usar el asistente.</Muted></Card> : null}
    {data && reason ? <Card><Muted>{reason}</Muted><SecondaryButton title="Ir al centro de IA" onPress={() => navigation.navigate('AICenter')} />{data.status.chat.limit === 0 ? <SecondaryButton title="Ver planes" onPress={() => navigation.navigate('Plan')} /> : null}</Card> : null}
    {profileId ? <AiRecordSelector profileId={profileId} selected={selected} onChange={setSelected} medicationIds={medicationIds} onMedicationChange={setMedicationIds} disabled={sending} /> : null}
    <Muted>{selected.length || medicationIds.length ? 'Cada envío usará la información seleccionada actualizada y hasta 12 mensajes anteriores de este perfil.' : 'Sin registros seleccionados, el asistente solo dispone de esta conversación. Selecciona información para consultar tu historial.'}</Muted>
    {messages.length || data ? <View style={styles.thread}>
      {messages.map((message, index) => {
        const mine = message.role === 'USER';
        return <View key={message.id || index} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
          {!mine ? <IconBadge icon="robot-outline" tone="ai" size={38} /> : null}
          <View style={[styles.bubble, { maxWidth: twoColumns ? '78%' : '88%' }, mine ? styles.mine : styles.theirs]}>
            <Text style={styles.author}>{mine ? 'Tú' : 'Asistente'}</Text>
            <Text style={{ marginTop: 4, lineHeight: 25 }}>{message.content}</Text>
          </View>
        </View>;
      })}
      {!messages.length && data ? <View style={styles.example}><MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={colors.warning} /><Muted style={{ flex: 1 }}>Ejemplo: “Ayúdame a convertir esta molestia en un registro claro”.</Muted></View> : null}
    </View> : null}
    <Field label="Mensaje" hint={`${text.length}/1500 caracteres. Cada envío respondido consume un mensaje de tu cupo.`} value={text} onChangeText={setText} multiline maxLength={1500} placeholder="Describe qué quieres ordenar o registrar" editable={chatAvailable} />
    <PrimaryButton title="Enviar" icon="send" onPress={send} disabled={!chatAvailable || !text.trim()} loading={sending} />
  </Screen>;
}

const styles = StyleSheet.create({
  thread: { gap: 12, padding: 16, marginVertical: 12, borderRadius: 24, backgroundColor: colors.backgroundDeep, borderWidth: 1, borderColor: colors.borderSoft },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { flexShrink: 1, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1 },
  mine: { backgroundColor: colors.primarySoft, borderColor: '#2E6662', borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.aiSoft, borderColor: '#46597D', borderBottomLeftRadius: 6 },
  author: { color: colors.muted, fontFamily: fonts.bold, fontSize: 15, lineHeight: 21 },
  example: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' }
});
