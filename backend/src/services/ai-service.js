import crypto from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';
import { fixedDisclaimer, inspectAiOutput, normalizeAiPayload } from './ai-safety.js';

const responseSchema = z.object({
  summary: z.string().min(1).max(5000),
  incompleteData: z.array(z.string()).default([]),
  contradictions: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([])
});

function demoResponse(events) {
  const missing = [];
  for (const event of events) {
    if (!event.description) missing.push(`El registro "${event.title}" no incluye una descripción.`);
    if (!event.source) missing.push(`El registro "${event.title}" no indica una fuente o institución.`);
  }
  const names = events.slice(0, 6).map((e) => `${e.event_date}: ${e.title}`).join('; ');
  return {
    provider: 'local-demo',
    model: 'deterministic-demo',
    output: normalizeAiPayload({
      summary: `Modo demostración: se revisaron ${events.length} registros seleccionados. ${names || 'No se seleccionaron registros con contenido.'}`,
      incompleteData: missing.slice(0, 10),
      contradictions: [],
      questions: [
        '¿Hay algún antecedente, medicamento o resultado reciente que falte incorporar al registro?',
        '¿Qué información conviene confirmar o actualizar con un profesional de salud en la próxima consulta?'
      ]
    })
  };
}

export function hashAiInput(events) {
  return crypto.createHash('sha256').update(JSON.stringify(events)).digest('hex');
}

export async function analyzeSelectedEvents(events, purpose = 'Revisión de información seleccionada') {
  if (env.ai.mockMode) return demoResponse(events);
  if (!env.ai.apiKey) throw new HttpError(503, 'La API de DeepSeek no está configurada.');

  const minimalEvents = events.map((e) => ({
    type: e.event_type,
    date: e.event_date,
    title: e.title,
    description: e.description || null,
    source: e.source || null,
    details: e.details || null
  }));

  const system = `Eres un módulo de revisión informativa de un registro personal de salud.\n
REGLAS OBLIGATORIAS:\n
- No diagnostiques ni sugieras que una persona tiene una enfermedad.\n
- No calcules ni declares factores o niveles de riesgo.\n
- No prescribas medicamentos, tratamientos, cambios de dosis ni conductas terapéuticas.\n
- No recomiendes estudios, pruebas, triaje o decisiones clínicas.\n
- Limítate a: (1) resumir fielmente la información seleccionada, (2) señalar campos ausentes o poco claros, (3) señalar contradicciones textuales evidentes entre registros, y (4) proponer preguntas neutrales para conversar con un profesional.\n
- No inventes datos. Si no existe evidencia suficiente, dilo como dato faltante.\n
Devuelve SOLO JSON válido con las claves summary, incompleteData, contradictions, questions.`;

  const response = await fetch(`${env.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ai.apiKey}` },
    body: JSON.stringify({
      model: env.ai.model,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({ purpose, selectedRecords: minimalEvents }) }
      ]
    }),
    signal: AbortSignal.timeout(30000)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(502, 'El proveedor de IA no respondió correctamente.', { providerStatus: response.status, body: body.slice(0, 300) });
  }
  const raw = await response.json();
  const content = raw?.choices?.[0]?.message?.content;
  if (!content) throw new HttpError(502, 'La respuesta de IA llegó vacía.');

  let parsed;
  try { parsed = JSON.parse(content); } catch { throw new HttpError(502, 'La respuesta de IA no tuvo el formato esperado.'); }
  const validated = responseSchema.parse(parsed);
  const output = normalizeAiPayload(validated);
  const inspection = inspectAiOutput(output);
  if (!inspection.safe) throw new HttpError(422, 'La salida de IA fue bloqueada por las reglas de seguridad.', { flags: inspection.matches });
  output.disclaimer = fixedDisclaimer;
  return { provider: 'deepseek', model: env.ai.model, output };
}

function demoChatReply(message) {
  const normalized = message.toLowerCase();
  if (/(diagn[oó]stico|enfermedad|tratamiento|medicamento|urgencia|emergencia)/i.test(normalized)) {
    return 'Puedo ayudarte a ordenar lo que registraste y a preparar preguntas neutrales para una consulta, pero no puedo diagnosticar, indicar tratamientos ni decidir una urgencia. Si tienes una preocupación de salud, contacta a un profesional de salud.';
  }
  return 'Puedo ayudarte a convertir lo que escribiste en un registro claro: qué molestia fue, desde cuándo, intensidad de 0 a 10, cuánto duró, qué la empeoró o alivió y cómo afectó tus actividades. También puedo ayudarte a redactar preguntas para tu próxima consulta.';
}

export async function answerOrganizerChat(history, message) {
  if (env.ai.mockMode) return { provider: 'local-demo', model: 'deterministic-demo', content: demoChatReply(message) };
  if (!env.ai.apiKey) throw new HttpError(503, 'La API de DeepSeek no está configurada.');

  const system = `Eres un asistente para organizar un historial personal de salud.
REGLAS OBLIGATORIAS:
- No diagnostiques, no evalúes urgencias, no declares riesgos ni indiques tratamientos, estudios, medicamentos o cambios de dosis.
- No sustituyas a un profesional de salud.
- Ayuda únicamente a ordenar información ya proporcionada, proponer campos de registro y redactar preguntas neutrales para una consulta.
- Si se solicita consejo médico, explica brevemente el límite y sugiere conversar con un profesional de salud.
- Responde de forma breve, clara y en español.`;
  const messages = history.slice(-12).map((item) => ({ role: item.role === 'USER' ? 'user' : 'assistant', content: item.content }));
  messages.push({ role: 'user', content: message });
  const response = await fetch(`${env.ai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ai.apiKey}` },
    body: JSON.stringify({ model: env.ai.model, temperature: 0.1, messages: [{ role: 'system', content: system }, ...messages] }),
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new HttpError(502, 'El proveedor de IA no respondió correctamente.');
  const raw = await response.json();
  const content = String(raw?.choices?.[0]?.message?.content || '').trim();
  if (!content) throw new HttpError(502, 'La respuesta del asistente llegó vacía.');
  const inspection = inspectAiOutput({ summary: content, incompleteData: [], contradictions: [], questions: [] });
  if (!inspection.safe) throw new HttpError(422, 'La salida del asistente fue bloqueada por las reglas de seguridad.', { flags: inspection.matches });
  return { provider: 'deepseek', model: env.ai.model, content: content.slice(0, 3000) };
}
