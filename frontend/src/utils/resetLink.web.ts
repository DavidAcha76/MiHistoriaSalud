/**
 * RF-03: el correo de recuperación abre `/?restablecer=TOKEN`. El token se lee una vez y se
 * retira de la barra de direcciones para que no quede en el historial ni se comparta por error.
 */
export function takeResetToken(): string | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const token = url.searchParams.get('restablecer');
  if (!token) return null;
  url.searchParams.delete('restablecer');
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  return token;
}
