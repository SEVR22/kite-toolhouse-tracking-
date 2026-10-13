import type { DisplayStatus, StationState } from './types';

export function getDisplayStatus(state: StationState | null, now: number, staleAfterMs: number, requestFailed = false): DisplayStatus {
  if (!state) return requestFailed ? 'offline' : 'loading';
  if (state.mode === 'offline') return 'offline';
  if (state.mode === 'error') return 'error';
  if (now - Date.parse(state.updatedAt) > staleAfterMs) return 'stale';
  if (state.mode === 'scanning') return 'scanning';
  if (state.mode === 'idle') return 'ready';
  return state.detections.length > 0 ? 'results' : 'empty';
}
