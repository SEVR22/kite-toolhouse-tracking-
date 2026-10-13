import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG, canonicalToolIdForClass, deriveActiveDrawerIds, groupDetections } from './catalog';
import { createMockState } from './demo-state';
import { getDisplayStatus } from './display-status';
import { parseRemoteState } from './station-data-provider';

describe('catalog and drawer mapping', () => {
  it('keeps nine unique provisional drawers and accepts only known canonical classes', () => {
    expect(TOOL_CATALOG).toHaveLength(9);
    expect(new Set(TOOL_CATALOG.map((tool) => tool.drawerId)).size).toBe(9);
    expect(canonicalToolIdForClass(' Claw-Hammer ')).toBe('claw-hammer');
    expect(canonicalToolIdForClass('unconfirmed-yolo-label')).toBeNull();
  });

  it('derives a single drawer per category despite duplicate detections', () => {
    expect(deriveActiveDrawerIds([
      { toolId: 'claw-hammer' },
      { toolId: 'combination-pliers' },
      { toolId: 'claw-hammer' },
      { toolId: 'adjustable-wrench' },
    ])).toEqual(['T06', 'T07', 'T09']);
  });

  it('groups duplicate objects for a readable result list', () => {
    const state = createMockState('station-01', 'held-three');
    expect(groupDetections([...state.detections, state.detections[0]])
      .find(({ tool }) => tool.id === 'claw-hammer')?.count).toBe(2);
  });
});

describe('station contract and display states', () => {
  const now = new Date('2026-10-13T15:00:00.000Z');

  it('shows exactly the three sample drawers', () => {
    const state = createMockState('station-01', 'held-three', now);
    expect(state.activeDrawerIds).toEqual(['T06', 'T07', 'T09']);
    expect(getDisplayStatus(state, now.getTime(), 15000)).toBe('results');
  });

  it.each([
    ['idle', 'ready'], ['scanning', 'scanning'], ['empty', 'empty'],
    ['offline', 'offline'], ['error', 'error'], ['stale', 'stale'],
  ] as const)('maps mock scenario %s to %s', (scenario, expected) => {
    const state = createMockState('station-01', scenario, now);
    expect(getDisplayStatus(state, now.getTime(), 15000)).toBe(expected);
  });

  it('marks failed initial requests offline and stops calling old held results current', () => {
    expect(getDisplayStatus(null, now.getTime(), 15000, true)).toBe('offline');
    const held = createMockState('station-01', 'held-three', now);
    expect(getDisplayStatus(held, now.getTime() + 16000, 15000, true)).toBe('stale');
  });

  it('validates remote data and recomputes drawers instead of trusting backend IDs', () => {
    const raw = { ...createMockState('station-01', 'held-one', now), source: 'mock', activeDrawerIds: ['T01'], detections: [{ id: 'x', toolId: 'claw-hammer', drawerId: 'T01', confidence: 0.9 }] };
    const parsed = parseRemoteState(raw, 'station-01');
    expect(parsed.source).toBe('live');
    expect(parsed.detections[0].drawerId).toBe('T07');
    expect(parsed.activeDrawerIds).toEqual(['T07']);
    expect(() => parseRemoteState({ ...raw, stationId: 'other' }, 'station-01')).toThrow();
    expect(() => parseRemoteState({ ...raw, detections: [{ toolId: 'not-confirmed' }] }, 'station-01')).toThrow();
  });
});
