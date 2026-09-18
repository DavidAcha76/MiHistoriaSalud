import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { PlanStatus } from '../types/domain';

// Refresh status only: reaching Monday must never trigger an AI request.
export function useAiQuotaRefresh(status: PlanStatus, refresh?: () => Promise<void>) {
  useEffect(() => {
    if (!refresh) return;
    const dates = [status.chat.resetsAt, status.analysis.nextAnalysisAt].filter(Boolean)
      .map((value) => new Date(value!).getTime()).filter((value) => value > Date.now());
    const timer = dates.length ? setTimeout(() => { void refresh(); }, Math.min(Math.min(...dates) - Date.now() + 250, 2147483647)) : undefined;
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { if (timer) clearTimeout(timer); listener.remove(); };
  }, [status.chat.resetsAt, status.analysis.nextAnalysisAt, refresh]);
}
