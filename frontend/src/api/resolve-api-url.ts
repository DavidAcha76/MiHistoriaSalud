type ApiEnvironment = {
  configuredUrl?: string;
  development: boolean;
  platform: string;
  webHostname?: string;
  expoHostUri?: string | null;
};

export const PUBLIC_API_URL = 'https://api.clinia.win/api';

export function normalizeApiUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_URL debe ser una URL HTTP/HTTPS sin credenciales, parámetros ni fragmentos.');
  }
  if (url.pathname === '/') url.pathname = '/api';
  return url.toString().replace(/\/+$/, '');
}

export function resolveApiUrl(options: ApiEnvironment): string {
  if (options.configuredUrl?.trim()) return normalizeApiUrl(options.configuredUrl);
  if (!options.development) return PUBLIC_API_URL;

  let hostname = options.platform === 'web' ? options.webHostname : undefined;
  if (!hostname && options.expoHostUri) {
    const hostUri = options.expoHostUri;
    hostname = new URL(hostUri.includes('://') ? hostUri : `http://${hostUri}`).hostname;
  }
  if (options.platform === 'android' && (!hostname || ['localhost', '127.0.0.1', '[::1]'].includes(hostname))) {
    hostname = '10.0.2.2';
  }
  return normalizeApiUrl(`http://${hostname || 'localhost'}:4000/api`);
}
