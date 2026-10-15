import { describe, expect, it } from 'vitest';
import { createMockState } from './demo-state';
import { canFinalize, EMPTY_CHECKLIST, finalizeChecklist, getChecklistItems, getScanKey } from './storage-checklist';

describe('manual storing checklist', () => {
  const held = createMockState('station-01', 'held-three');
  const key = getScanKey(held)!;
  const items = getChecklistItems(held.detections);

  it('uses the stable scan identity instead of the polling heartbeat', () => {
    expect(key).toBeTruthy();
    expect(getScanKey({ ...held, updatedAt: new Date().toISOString() })).toBe(key);
    expect(getScanKey({ ...held, scanId: 'next-scan' })).not.toBe(key);
    expect(getScanKey(createMockState('station-01', 'idle'))).toBeNull();
  });

  it('requires a manual confirmation for every detection and permits corrections', () => {
    expect(items).toHaveLength(3);
    expect(canFinalize(key, items, EMPTY_CHECKLIST)).toBe(false);
    const partial = { ...EMPTY_CHECKLIST, scanKey: key, checked: items.slice(0, 2).map(({ key: itemKey }) => itemKey) };
    expect(canFinalize(key, items, partial)).toBe(false);
    const complete = { ...partial, checked: items.map(({ key: itemKey }) => itemKey) };
    expect(canFinalize(key, items, complete)).toBe(true);
    expect(canFinalize(key, items, { ...complete, checked: complete.checked.slice(1) })).toBe(false);
    expect(canFinalize(key, [], complete)).toBe(false);
  });

  it('clears checked items and blocks a held scan from being finalized again', () => {
    const complete = { ...EMPTY_CHECKLIST, scanKey: key, checked: items.map(({ key: itemKey }) => itemKey) };
    const finalized = finalizeChecklist(key, items, complete);
    expect(finalized.scanKey).toBeNull();
    expect(finalized.checked).toEqual([]);
    expect(finalized.completedScanKeys).toEqual([key]);
    expect(canFinalize(key, items, finalized)).toBe(false);
    expect(finalizeChecklist(key, items, finalized)).toBe(finalized);
  });
});
