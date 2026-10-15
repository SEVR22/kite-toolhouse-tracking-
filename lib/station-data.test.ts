import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOOL_CATALOG, canonicalToolIdForClass, deriveActiveDrawerIds, groupDetections } from './catalog';
import { createMockState } from './demo-state';
import { getDisplayStatus } from './display-status';
import { getStationState, parseRemoteState } from './station-data-provider';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('station data source gate', () => {
  it('allows simulated detections only in explicitly configured development mode', async () => {
    vi.stubEnv('STATION_DATA_SOURCE', 'mock');
    vi.stubEnv('NODE_ENV', 'development');
    const demo = await getStationState('station-01', 'held-three');
    expect(demo.source).toBe('mock');
    expect(demo.detections).toHaveLength(3);

    vi.stubEnv('NODE_ENV', 'production');
    const production = await getStationState('station-01', 'held-three');
    expect(production).toMatchObject({ mode: 'offline', source: 'live', detections: [], activeDrawerIds: [] });
  });

  it('returns offline for missing or invalid remote configuration', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STATION_DATA_SOURCE', 'remote');
    vi.stubEnv('STATION_BACKEND_URL', '');
    expect(await getStationState('station-01')).toMatchObject({ mode: 'offline', detections: [] });

    vi.stubEnv('STATION_BACKEND_URL', 'ftp://backend.example.test');
    expect(await getStationState('station-01')).toMatchObject({ mode: 'offline', detections: [] });
  });

  it('requests the existing FastAPI endpoint with a server-side bearer token', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STATION_DATA_SOURCE', 'remote');
    vi.stubEnv('STATION_BACKEND_URL', 'https://backend.example.test');
    vi.stubEnv('STATION_BACKEND_TOKEN', 'test-token');
    const raw = createMockState('station-01', 'held-one');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(raw), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const state = await getStationState('station-01');
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://backend.example.test/stations/station-01/state'),
      expect.objectContaining({ headers: { Accept: 'application/json', Authorization: 'Bearer test-token' }, cache: 'no-store' }),
    );
    expect(state.source).toBe('live');
    expect(state.detections).toHaveLength(1);
  });
});

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

  it('accepts the state served by the AI-tool-detection server', () => {
    // Shape produced by server.py in AI-tool-detection (GET /stations/station-01/state).
    const raw = {
      stationId: 'station-01', mode: 'held', source: 'live',
      scanId: '291dd93f-7102-4d96-a136-ef91e1d723dc',
      updatedAt: '2026-10-14T16:53:40.123456Z', lastScanAt: '2026-10-14T16:53:38.654321Z',
      connectivity: { camera: 'online', inference: 'online', ledController: 'unknown' },
      detections: [
        { id: '3f8a1c52-6d0e-4b7a-9c21-0a5e7d4b9e11', toolId: 'claw-hammer', confidence: 0.975 },
        { id: 'b8e4f2a5-9c61-4d37-a0b8-4d2f7e3c1a99', toolId: 'hammer-drill', confidence: 0.88 },
      ],
      message: null,
    };
    const parsed = parseRemoteState(raw, 'station-01');
    expect(parsed.activeDrawerIds).toEqual(['T01', 'T07']);
    expect(parsed.detections[0].id).toBe('3f8a1c52-6d0e-4b7a-9c21-0a5e7d4b9e11');
    expect(getDisplayStatus(parsed, Date.parse('2026-10-14T16:53:41Z'), 15000)).toBe('results');
  });
});
