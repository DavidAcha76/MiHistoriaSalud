import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as storage from '../utils/storage';
import { apiRequest } from '../api/client';
import type { HealthProfile } from '../types/domain';
import { useAuth } from './AuthContext';

const PROFILE_KEY = 'mihistoria.profile';
type Value = {
  profiles: HealthProfile[];
  selectedProfile: HealthProfile | null;
  loading: boolean;
  error: string;
  refreshProfiles(): Promise<void>;
  selectProfile(id: string): Promise<void>;
};
const Ctx = createContext<Value | null>(null);
const nameOf = (p: HealthProfile) => p.displayName || p.display_name || 'Perfil';

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<HealthProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const latestRequest = useRef(0);

  async function refreshProfiles() {
    const request = ++latestRequest.current;
    if (!user) { setProfiles([]); setSelectedId(null); setError(''); return; }
    setLoading(true);
    setError('');
    try {
      const list = await apiRequest<HealthProfile[]>('/profiles');
      const saved = selectedId || await storage.getItem(PROFILE_KEY);
      if (request !== latestRequest.current) return;
      setProfiles(list);
      const next = list.some((p) => p.id === saved) ? saved : list[0]?.id || null;
      setSelectedId(next);
      if (next) await storage.setItem(PROFILE_KEY, next);
    } catch {
      if (request === latestRequest.current) setError('No pudimos cargar los perfiles. Revisa tu conexión y vuelve a intentar.');
    } finally { if (request === latestRequest.current) setLoading(false); }
  }

  useEffect(() => { void refreshProfiles().catch(() => {}); }, [user?.id]);

  async function selectProfile(id: string) {
    if (!profiles.some((p) => p.id === id)) return;
    setSelectedId(id);
    await storage.setItem(PROFILE_KEY, id);
  }

  const selectedProfile = profiles.find((p) => p.id === selectedId) || null;
  const value = useMemo(() => ({ profiles, selectedProfile, loading, error, refreshProfiles, selectProfile }), [profiles, selectedProfile, loading, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useProfiles() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useProfiles debe usarse dentro de ProfileProvider');
  return value;
}
export { nameOf };
