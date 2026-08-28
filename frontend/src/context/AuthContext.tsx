import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as storage from '../utils/storage';
import { apiRequest, configureApiSession } from '../api/client';
import type { User } from '../types/domain';

const ACCESS_KEY = 'mihistoria.access';
const REFRESH_KEY = 'mihistoria.refresh';
const USER_KEY = 'mihistoria.user';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login(email: string, password: string): Promise<void>;
  register(fullName: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

async function persist(data: { accessToken: string; refreshToken: string; user: User }) {
  await Promise.all([
    storage.setItem(ACCESS_KEY, data.accessToken),
    storage.setItem(REFRESH_KEY, data.refreshToken),
    storage.setItem(USER_KEY, JSON.stringify(data.user))
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const installSession = async (data: { accessToken: string; refreshToken: string; user: User }) => {
    await persist(data);
    setUser(data.user);
    configureApiSession({ accessToken: data.accessToken, refreshToken: data.refreshToken }, installSession);
  };

  useEffect(() => {
    (async () => {
      try {
        const [a, r, u] = await Promise.all([
          storage.getItem(ACCESS_KEY),
          storage.getItem(REFRESH_KEY),
          storage.getItem(USER_KEY)
        ]);
        configureApiSession({ accessToken: a, refreshToken: r }, installSession);
        if (u && r) setUser(JSON.parse(u));
        if (r) {
          try {
            const me = await apiRequest<{ id: string; email: string; fullName: string }>('/auth/me');
            setUser({ id: me.id, email: me.email, fullName: me.fullName });
          } catch {
            await clearSession();
          }
        }
      } finally { setLoading(false); }
    })();
  }, []);

  async function clearSession() {
    configureApiSession({ accessToken: null, refreshToken: null });
    setUser(null);
    await Promise.all([storage.deleteItem(ACCESS_KEY), storage.deleteItem(REFRESH_KEY), storage.deleteItem(USER_KEY)]);
  }

  async function login(email: string, password: string) {
    const data = await apiRequest<{ accessToken: string; refreshToken: string; user: User }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password, deviceInfo: 'Expo React Native' })
    });
    await installSession(data);
  }

  async function register(fullName: string, email: string, password: string) {
    const data = await apiRequest<{ accessToken: string; refreshToken: string; user: User }>('/auth/register', {
      method: 'POST', body: JSON.stringify({ fullName, email, password })
    });
    await installSession(data);
  }

  async function logout() {
    const r = await storage.getItem(REFRESH_KEY);
    if (r) { try { await apiRequest('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken: r }) }, false); } catch {} }
    await clearSession();
  }

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
}
