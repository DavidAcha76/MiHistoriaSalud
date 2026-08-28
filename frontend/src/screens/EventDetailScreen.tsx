import React, { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiRequest } from '../api/client';
import { AppTitle, Card, Muted, PrimaryButton, Screen, SectionTitle, SecondaryButton } from '../components/ui';
import { useProfiles } from '../context/ProfileContext';
import type { HealthEvent } from '../types/domain';
import { colors } from '../theme/colors';

export function EventDetailScreen({ route, navigation }: any) {
  const { selectedProfile }=useProfiles(); const [event,setEvent]=useState<HealthEvent|null>(null); const {eventId}=route.params;
  const load=useCallback(()=>{if(!selectedProfile)return;apiRequest<HealthEvent>(`/profiles/${selectedProfile.id}/events/${eventId}`).then(setEvent).catch((e:any)=>Alert.alert('Error',e.message));},[selectedProfile?.id,eventId]);
  useFocusEffect(useCallback(()=>{load();},[load]));
  async function remove(){if(!selectedProfile)return;Alert.alert('Eliminar evento','Esta acción elimina el evento estructurado. Los documentos asociados se conservarán sin vínculo al evento.',[{text:'Cancelar',style:'cancel'},{text:'Eliminar',style:'destructive',onPress:async()=>{try{await apiRequest(`/profiles/${selectedProfile.id}/events/${eventId}`,{method:'DELETE'});navigation.goBack();}catch(e:any){Alert.alert('Error',e.message);}}}]);}
  if(!event)return <Screen><Muted>Cargando evento…</Muted></Screen>;
  const date=event.eventDate||event.event_date; const type=event.eventType||event.event_type; const details=event.details||{};
  return <Screen><AppTitle title={event.title} subtitle={`${date} · ${type}`}/><Card>{event.description?<Text style={{color:colors.text,lineHeight:21}}>{event.description}</Text>:<Muted>Sin descripción.</Muted>}{event.source?<Text style={{marginTop:10,color:colors.muted}}>Fuente: {event.source}</Text>:null}{event.notes?<Text style={{marginTop:10,color:colors.muted}}>Notas: {event.notes}</Text>:null}</Card><SectionTitle>Datos estructurados</SectionTitle><Card>{Object.entries(details).filter(([k])=>k!=='event_id').map(([k,v])=><View key={k} style={{marginBottom:9}}><Text style={{fontSize:12,fontWeight:'800',color:colors.muted}}>{k.replaceAll('_',' ').toUpperCase()}</Text><Text style={{color:colors.text}}>{v==null||v===''?'—':String(v)}</Text></View>)}{!Object.keys(details).length?<Muted>Este tipo no tiene campos adicionales.</Muted>:null}</Card><SectionTitle>Documentos vinculados</SectionTitle><Card>{event.documents?.length?event.documents.map(d=><Text key={d.id} style={{color:colors.text,marginBottom:5}}>• {d.originalName||d.original_name}</Text>):<Muted>No hay documentos vinculados.</Muted>}</Card><SecondaryButton title="Editar evento" onPress={()=>navigation.navigate('EventForm',{eventId})}/><SecondaryButton title="Adjuntar documento a este evento" onPress={()=>navigation.navigate('DocumentUpload',{eventId})}/><PrimaryButton title="Eliminar evento" danger onPress={remove}/></Screen>;
}
