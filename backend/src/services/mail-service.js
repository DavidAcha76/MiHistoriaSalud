import { env } from '../config/env.js';
import { log } from '../utils/logger.js';

/**
 * Adaptador de correo (RNF-13): el proveedor se elige por configuración y puede sustituirse.
 * - `log`: solo desarrollo; escribe el mensaje en la consola local para probar el flujo.
 * - `resend`: API HTTP compatible con Resend (https://resend.com/docs/api-reference/emails/send-email).
 * - `disabled`: no envía nada; la solicitud responde igual para no revelar cuentas.
 */
export function mailAvailable() {
  if (env.mail.driver === 'resend') return Boolean(env.mail.apiKey && env.mail.from);
  return env.mail.driver === 'log' && env.nodeEnv !== 'production';
}

export async function sendMail({ to, subject, text, html }) {
  if (env.mail.driver === 'log' && env.nodeEnv !== 'production') {
    log('info', 'mail_development_preview', { to, subject, text });
    return { delivered: true, driver: 'log' };
  }
  if (env.mail.driver === 'resend' && mailAvailable()) {
    const response = await fetch(env.mail.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.mail.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.mail.from, to: [to], subject, text, html }),
      signal: AbortSignal.timeout(15000)
    });
    // El cuerpo de error del proveedor puede contener datos del mensaje: solo se registra el estado.
    if (!response.ok) throw new Error(`El proveedor de correo respondió ${response.status}.`);
    return { delivered: true, driver: 'resend' };
  }
  log('warn', 'mail_not_configured', { subject });
  return { delivered: false, driver: env.mail.driver };
}
