import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { resolveApiUrl } from './resolve-api-url';
import type { User } from '../types/domain';

declare const process: { env: Record<string, string | undefined> };

const API_URL = resolveApiUrl({
  configuredUrl: process.env.EXPO_PUBLIC_API_URL,
  development: __DEV__,
  platform: Platform.OS,
  webHostname: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.hostname : undefined,
  expoHostUri: Constants.expoConfig?.hostUri
});
let accessToken: string | null = null;
let refreshToken: string | null = null;
type RefreshHandler = (session: { accessToken: string; refreshToken: string; user: User }) => void | Promise<void>;
type SessionInvalidHandler = () => void | Promise<void>;
let onRefresh: RefreshHandler | null = null;
let onSessionInvalid: SessionInvalidHandler | null = null;
type RefreshResult = 'refreshed' | 'invalid' | 'unavailable' | 'missing';
let refreshPromise: Promise<RefreshResult> | null = null;

type SessionHandlers = {
  onRefresh?: RefreshHandler;
  onSessionInvalid?: SessionInvalidHandler;
};

export function configureApiSession(tokens: { accessToken: string | null; refreshToken: string | null }, handlers?: SessionHandlers) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  if (handlers) {
    onRefresh = handlers.onRefresh || null;
    onSessionInvalid = handlers.onSessionInvalid || null;
  }
}

async function refreshSession(): Promise<RefreshResult> {
  if (!refreshToken) return 'missing';
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken, deviceInfo: 'Expo React Native' })
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            await onSessionInvalid?.();
            return 'invalid';
          }
          return 'unavailable';
        }
        const data = await response.json();
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        await onRefresh?.(data);
        return 'refreshed';
      } catch {
        return 'unavailable';
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function sessionRenewalUnavailable() {
  return new Error('No se pudo renovar la sesión. Conservamos el acceso local e inténtalo cuando vuelva la conexión.');
}

export async function apiFetchRaw(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && retry) {
    const refresh = await refreshSession();
    if (refresh === 'refreshed') return apiFetchRaw(path, options, false);
    if (refresh === 'unavailable') throw sessionRenewalUnavailable();
  }
  if (!response.ok) {
    let message = `Error HTTP ${response.status}`;
    try {
      const body = await response.clone().json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return response;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && retry) {
    const refresh = await refreshSession();
    if (refresh === 'refreshed') return apiRequest<T>(path, options, false);
    if (refresh === 'unavailable') throw sessionRenewalUnavailable();
  }
  if (response.status === 204) return undefined as T;
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const details = typeof body === 'object' && Array.isArray(body?.details)
      ? [...new Set(body.details.map((detail: unknown) => typeof detail === 'object' && detail && 'message' in detail ? String(detail.message) : '').filter(Boolean))]
      : [];
    const message = details.length ? details.join('\n') : typeof body === 'object' && body?.error ? body.error : `Error HTTP ${response.status}`;
    const error = new Error(message) as Error & { status?: number; details?: unknown };
    error.status = response.status;
    error.details = typeof body === 'object' ? body?.details : undefined;
    throw error;
  }
  return body as T;
}

export const getApiUrl = () => API_URL;
export const getAccessToken = () => accessToken;
