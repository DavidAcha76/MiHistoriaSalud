import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { apiRequest } from '../api/client';
import { AppTitle, Chip, Field, PrimaryButton, Screen, SectionTitle } from '../components/ui';
import { useProfiles } from '../context/ProfileContext';
import type { EventType } from '../types/domain';

const typeOptions: Array<{value:EventType;label:string}> = [
  {value:'ANTECEDENT',label:'Antecedente'},{value:'CONSULTATION',label:'Consulta'},{value:'DIAGNOSIS',label:'Diagnóstico declarado'},
  {value:'TREATMENT',label:'Tratamiento'},{value:'MEDICATION',label:'Medicamento'},{value:'ALLERGY',label:'Alergia'},
  {value:'VACCINE',label:'Vacuna'},{value:'SURGERY',label:'Cirugía'},{value:'LAB_RESULT',label:'Laboratorio'},{value:'OTHER',label:'Otro'}
];
const detailFields: Record<EventType, Array<[string,string,string?]>> = {
  ANTECEDENT:[['category','Categoría (PERSONAL / FAMILY / OTHER)'],['condition_name','Antecedente o condición'],['relationship_person','Parentesco, si es familiar'],['onset_date','Fecha de inicio (AAAA-MM-DD)'],['status','Estado']],
  CONSULTATION:[['professional_name','Profesional'],['specialty','Especialidad'],['facility','Centro o institución'],['reason','Motivo']],
  DIAGNOSIS:[['diagnosis_name','Diagnóstico declarado'],['status','Estado'],['diagnosed_by','Profesional / fuente']],
  TREATMENT:[['treatment_name','Nombre del tratamiento'],['instructions','Indicaciones registradas'],['start_date','Fecha de inicio'],['end_date','Fecha de fin']],
  MEDICATION:[['medication_name','Medicamento'],['dose','Dosis registrada'],['frequency','Frecuencia'],['route','Vía'],['start_date','Fecha de inicio'],['end_date','Fecha de fin'],['status','Estado']],
  ALLERGY:[['allergen','Alérgeno'],['reaction','Reacción registrada'],['severity','Severidad registrada'],['status','Estado']],
  VACCINE:[['vaccine_name','Vacuna'],['dose_number','Número de dosis'],['lot_number','Lote'],['provider','Proveedor / centro']],
  SURGERY:[['procedure_name','Procedimiento'],['facility','Centro o institución'],['professional_name','Profesional']],
  LAB_RESULT:[['test_name','Prueba'],['value_text','Valor textual'],['value_numeric','Valor numérico'],['unit','Unidad'],['reference_range','Rango de referencia'],['flag','Marca / observación del laboratorio'],['laboratory','Laboratorio']],
  OTHER:[]
};
const today = () => new Date().toISOString().slice(0,10);
export function EventFormScreen({ navigation, route }: any) {
  const { selectedProfile } = useProfiles(); const editId = route.params?.eventId as string | undefined; const [eventType,setEventType]=useState<EventType>('CONSULTATION'); const [title,setTitle]=useState(''); const [eventDate,setEventDate]=useState(today()); const [description,setDescription]=useState(''); const [source,setSource]=useState(''); const [notes,setNotes]=useState(''); const [details,setDetails]=useState<Record<string,string>>({}); const [loading,setLoading]=useState(false);
  const fields=useMemo(()=>detailFields[eventType],[eventType]);

  useEffect(()=>{
    if(!editId||!selectedProfile)return;
    apiRequest<any>(`/profiles/${selectedProfile.id}/events/${editId}`).then(e=>{
      setEventType(e.event_type||e.eventType); setTitle(e.title||''); setEventDate(e.event_date||e.eventDate||today());
      setDescription(e.description||''); setSource(e.source||''); setNotes(e.notes||'');
      const d={...(e.details||{})}; delete d.event_id; setDetails(Object.fromEntries(Object.entries(d).map(([k,v])=>[k,v==null?'':String(v)])));
    }).catch((err:any)=>Alert.alert('No se pudo cargar',err.message));
  },[editId,selectedProfile?.id]);
  async function save(){ if(!selectedProfile) return Alert.alert('Sin perfil','Selecciona un perfil.'); if(title.trim().length<2) return Alert.alert('Falta el título','Escribe un título para el registro.'); setLoading(true); try { await apiRequest(`/profiles/${selectedProfile.id}/events${editId?`/${editId}`:''}`,{method:editId?'PATCH':'POST',body:JSON.stringify({eventType,title:title.trim(),eventDate,description:description.trim()||null,source:source.trim()||null,notes:notes.trim()||null,details})}); navigation.goBack(); } catch(e:any){Alert.alert('No se pudo guardar',e.message);} finally{setLoading(false);} }
  return <Screen><AppTitle title={editId?'Editar evento':'Registrar evento'} subtitle="Los datos quedan vinculados al perfil activo y a una fecha."/><Text style={{fontWeight:'800',marginBottom:8}}>Tipo</Text><ScrollView horizontal showsHorizontalScrollIndicator={false}>{typeOptions.map(t=><Chip key={t.value} label={t.label} selected={eventType===t.value} onPress={editId?undefined:()=>{setEventType(t.value);setDetails({});}}/>)}</ScrollView><Field label="Título" value={title} onChangeText={setTitle} placeholder="Ej.: Consulta de control"/><Field label="Fecha (AAAA-MM-DD)" value={eventDate} onChangeText={setEventDate} autoCapitalize="none"/><Field label="Descripción" value={description} onChangeText={setDescription} multiline/><Field label="Fuente / institución" value={source} onChangeText={setSource}/>{fields.length?<SectionTitle>Datos estructurados</SectionTitle>:null}{fields.map(([key,label])=><Field key={key} label={label} value={details[key]||''} onChangeText={(v)=>setDetails(d=>({...d,[key]:v}))}/>) }<Field label="Notas" value={notes} onChangeText={setNotes} multiline/><PrimaryButton title={editId?'Guardar cambios':'Guardar evento'} onPress={save} loading={loading}/></Screen>;
}
