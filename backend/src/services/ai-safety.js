const forbiddenPatterns = [
  /diagn[oó]stico\s*:/i,
  /usted\s+(tiene|padece|presenta)\b/i,
  /debes?\s+(tomar|suspender|iniciar|aumentar|disminuir)\b/i,
  /recomiendo\s+(?:(?:realizar|hacerte|hacer)\s+)?(?:un|una)?\s*(estudio|an[aá]lisis|radiograf|tomograf|resonancia|medicamento|tratamiento)/i,
  /prescrib/i,
  /probabilidad\s+de\s+que\s+tengas/i,
  /riesgo\s+(alto|moderado|bajo)\s+de/i,
  /acude\s+a\s+emergencias\s+(porque|ya que)\b/i
];

export const fixedDisclaimer = 'Contenido informativo y no diagnóstico. No sustituye la evaluación, diagnóstico ni tratamiento de un profesional de salud.';

export function inspectAiOutput(payload) {
  const text = JSON.stringify(payload);
  const matches = forbiddenPatterns.filter((p) => p.test(text)).map((p) => p.source);
  return { safe: matches.length === 0, matches };
}

export function normalizeAiPayload(payload) {
  return {
    summary: String(payload?.summary || '').trim(),
    incompleteData: Array.isArray(payload?.incompleteData) ? payload.incompleteData.map(String).slice(0, 10) : [],
    contradictions: Array.isArray(payload?.contradictions) ? payload.contradictions.map(String).slice(0, 10) : [],
    questions: Array.isArray(payload?.questions) ? payload.questions.map(String).slice(0, 8) : [],
    disclaimer: fixedDisclaimer
  };
}
