import type { Detection, StationState, ToolId } from './types';

export interface ChecklistItem {
  key: string;
  toolId: ToolId;
}

export interface ChecklistSnapshot {
  scanKey: string | null;
  checked: string[];
  completedScanKeys: string[];
}

export const EMPTY_CHECKLIST: ChecklistSnapshot = { scanKey: null, checked: [], completedScanKeys: [] };

// scanId and lastScanAt stay fixed while a result is held. updatedAt is a heartbeat.
export function getScanKey(state: StationState | null): string | null {
  if (!state || state.mode !== 'held' || state.detections.length === 0) return null;
  const identity = state.scanId || state.lastScanAt;
  return identity ? `${state.stationId}:${identity}:${state.lastScanAt ?? ''}` : null;
}

export function getChecklistItems(detections: readonly Detection[]): ChecklistItem[] {
  const seen = new Map<string, number>();
  return detections.map(({ id, toolId }) => {
    const base = `${toolId}:${id}`;
    const occurrence = (seen.get(base) ?? 0) + 1;
    seen.set(base, occurrence);
    return { key: `${base}:${occurrence}`, toolId };
  });
}

export function canFinalize(scanKey: string | null, items: readonly ChecklistItem[], snapshot: ChecklistSnapshot): boolean {
  return Boolean(scanKey && items.length > 0 && snapshot.scanKey === scanKey &&
    !snapshot.completedScanKeys.includes(scanKey) && items.every(({ key }) => snapshot.checked.includes(key)));
}

export function finalizeChecklist(scanKey: string | null, items: readonly ChecklistItem[], snapshot: ChecklistSnapshot): ChecklistSnapshot {
  if (!canFinalize(scanKey, items, snapshot) || !scanKey) return snapshot;
  return { scanKey: null, checked: [], completedScanKeys: [...snapshot.completedScanKeys, scanKey] };
}

export function readChecklistSnapshot(stationId: string): ChecklistSnapshot {
  if (typeof window === 'undefined') return EMPTY_CHECKLIST;
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(`toollighthouse:checklist:${stationId}`) ?? 'null');
    if (!raw || typeof raw !== 'object') return EMPTY_CHECKLIST;
    return {
      scanKey: typeof raw.scanKey === 'string' ? raw.scanKey : null,
      checked: Array.isArray(raw.checked) ? raw.checked.filter((key: unknown): key is string => typeof key === 'string') : [],
      completedScanKeys: Array.isArray(raw.completedScanKeys) ? raw.completedScanKeys.filter((key: unknown): key is string => typeof key === 'string') : [],
    };
  } catch {
    return EMPTY_CHECKLIST;
  }
}

export function writeChecklistSnapshot(stationId: string, snapshot: ChecklistSnapshot): void {
  try {
    window.sessionStorage.setItem(`toollighthouse:checklist:${stationId}`, JSON.stringify(snapshot));
  } catch {
    // Storage can be unavailable in private browsing; the current tab still works.
  }
}
