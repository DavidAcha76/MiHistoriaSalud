import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useProfiles } from '../context/ProfileContext';

// Ignore responses from an earlier profile, refresh or screen visit.
export function useProfileResource<T>(fetcher: (profileId: string) => Promise<T>) {
  const { selectedProfile } = useProfiles();
  const profileId = selectedProfile?.id;
  const request = useRef(0);
  const [state, setState] = useState<{ profileId?: string; data: T | null; error: string; loading: boolean }>({ data: null, error: '', loading: false });
  const refresh = useCallback(async () => {
    const current = ++request.current;
    setState({ profileId, data: null, error: '', loading: Boolean(profileId) });
    if (!profileId) return;
    try {
      const data = await fetcher(profileId);
      if (current === request.current) setState({ profileId, data, error: '', loading: false });
    } catch (error: any) {
      if (current === request.current) setState({ profileId, data: null, error: error.message, loading: false });
    }
  }, [profileId, fetcher]);
  useFocusEffect(useCallback(() => { void refresh(); return () => { request.current++; }; }, [refresh]));
  return { profileId, data: state.profileId === profileId ? state.data : null, error: state.profileId === profileId ? state.error : '', loading: state.loading || state.profileId !== profileId, refresh };
}
