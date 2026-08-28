import { Platform } from 'react-native';
import type { User } from '../types/domain';

const DEFAULT_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api';
const API_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;
let accessToken: string | null = null;
let refreshToken: string | null = null;
let onRefresh: ((session: { accessToken: string; refreshToken: string; user: User }) => void | Promise<void>) | null = null;
let refreshPromise: Promise<boolean> | null = null;

export function configureApiSession(tokens: { accessToken: string | null; refreshToken: string | null }, callback?: typeof onRefresh) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  if (callback !== undefined) onRefresh = callback;
}

async function refreshSession(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken, deviceInfo: 'Expo React Native' })
        });
        if (!response.ok) return false;
        const data = await response.json();
        accessToken = data.accessToken;
        refreshToken = data.refreshToken;
        await onRefresh?.(data);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetchRaw(path: string, options: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && retry && await refreshSession()) return apiFetchRaw(path, options, false);
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
  if (response.status === 401 && retry && await refreshSession()) return apiRequest<T>(path, options, false);
  if (response.status === 204) return undefined as T;
  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof body === 'object' && body?.error ? body.error : `Error HTTP ${response.status}`;
    const error = new Error(message) as Error & { status?: number; details?: unknown };
    error.status = response.status;
    error.details = typeof body === 'object' ? body?.details : undefined;
    throw error;
  }
  return body as T;
}

export const getApiUrl = () => API_URL;
export const getAccessToken = () => accessToken;
