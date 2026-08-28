import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as storage from '../utils/storage';
import { apiRequest } from '../api/client';
import type { HealthProfile } from '../types/domain';
import { useAuth } from './AuthContext';

const PROFILE_KEY = 'mihistoria.profile';
type Value = {
  profiles: HealthProfile[];
  selectedProfile: HealthProfile | null;
  loading: boolean;
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

  async function refreshProfiles() {
    if (!user) { setProfiles([]); setSelectedId(null); return; }
    setLoading(true);
    try {
      const list = await apiRequest<HealthProfile[]>('/profiles');
      setProfiles(list);
      const saved = selectedId || await storage.getItem(PROFILE_KEY);
      const next = list.some((p) => p.id === saved) ? saved : list[0]?.id || null;
      setSelectedId(next);
      if (next) await storage.setItem(PROFILE_KEY, next);
    } finally { setLoading(false); }
  }

  useEffect(() => { refreshProfiles(); }, [user?.id]);

  async function selectProfile(id: string) {
    if (!profiles.some((p) => p.id === id)) return;
    setSelectedId(id);
    await storage.setItem(PROFILE_KEY, id);
  }

  const selectedProfile = profiles.find((p) => p.id === selectedId) || null;
  const value = useMemo(() => ({ profiles, selectedProfile, loading, refreshProfiles, selectProfile }), [profiles, selectedProfile, loading]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useProfiles() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useProfiles debe usarse dentro de ProfileProvider');
  return value;
}
export { nameOf };
