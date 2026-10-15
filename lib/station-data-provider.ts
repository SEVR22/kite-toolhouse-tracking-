import { catalogById, canonicalToolIdForClass, deriveActiveDrawerIds } from './catalog';
import { createMockState, type DemoScenario } from './demo-state';
import type { ConnectionState, Detection, StationMode, StationState } from './types';

const MODES: readonly StationMode[] = ['idle', 'scanning', 'held', 'offline', 'error'];
const CONNECTIONS: readonly ConnectionState[] = ['online', 'offline', 'unknown'];

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid station state');
  return value as Record<string, unknown>;
}

function isoDate(value: unknown): string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Invalid station timestamp');
  return new Date(value).toISOString();
}

function connection(value: unknown): ConnectionState {
  return CONNECTIONS.includes(value as ConnectionState) ? value as ConnectionState : 'unknown';
}

/** Check the cloud contract at the server boundary and derive drawer IDs locally. */
export function parseRemoteState(raw: unknown, stationId: string): StationState {
  const input = object(raw);
  if (input.stationId !== stationId || !MODES.includes(input.mode as StationMode)) throw new Error('Invalid station identity or mode');
  if (!Array.isArray(input.detections)) throw new Error('Invalid detections');

  const detections: Detection[] = input.detections.map((value, index) => {
    const item = object(value);
    const toolId = typeof item.toolId === 'string' ? canonicalToolIdForClass(item.toolId) : null;
    if (!toolId) throw new Error(`Unknown tool class at detection ${index}`);
    const confidence = typeof item.confidence === 'number' && item.confidence >= 0 && item.confidence <= 1
      ? item.confidence : undefined;
    const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : `detection-${index + 1}`;
    const boxInput = item.box && typeof item.box === 'object' ? object(item.box) : null;
    const coords = boxInput && [boxInput.x, boxInput.y, boxInput.width, boxInput.height];
    const box = coords && coords.every((n) => typeof n === 'number' && n >= 0 && n <= 1)
      ? { x: coords[0] as number, y: coords[1] as number, width: coords[2] as number, height: coords[3] as number }
      : undefined;
    return { id, toolId, drawerId: catalogById[toolId].drawerId, confidence, box };
  });

  const connectivity = input.connectivity && typeof input.connectivity === 'object' ? object(input.connectivity) : {};
  return {
    stationId,
    mode: input.mode as StationMode,
    source: 'live',
    scanId: typeof input.scanId === 'string' ? input.scanId : null,
    updatedAt: isoDate(input.updatedAt),
    lastScanAt: input.lastScanAt == null ? null : isoDate(input.lastScanAt),
    connectivity: {
      camera: connection(connectivity.camera),
      inference: connection(connectivity.inference),
      ledController: connection(connectivity.ledController),
    },
    detections,
    activeDrawerIds: deriveActiveDrawerIds(detections),
    message: typeof input.message === 'string' ? input.message.slice(0, 300) : null,
  };
}

function unavailableState(stationId: string): StationState {
  return {
    stationId,
    mode: 'offline',
    source: 'live',
    scanId: null,
    updatedAt: new Date().toISOString(),
    lastScanAt: null,
    connectivity: { camera: 'unknown', inference: 'offline', ledController: 'unknown' },
    detections: [],
    activeDrawerIds: [],
    message: 'La estación no está disponible en este momento.',
  };
}

export async function getStationState(stationId: string, scenario?: DemoScenario): Promise<StationState> {
  if (process.env.NODE_ENV === 'development' && process.env.STATION_DATA_SOURCE === 'mock') {
    return createMockState(stationId, scenario);
  }
  if (process.env.STATION_DATA_SOURCE !== 'remote') return unavailableState(stationId);
  const baseUrl = process.env.STATION_BACKEND_URL;
  if (!baseUrl) return unavailableState(stationId);

  try {
    const url = new URL(`stations/${encodeURIComponent(stationId)}/state`, `${baseUrl.replace(/\/$/, '')}/`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return unavailableState(stationId);
    const headers: HeadersInit = { Accept: 'application/json' };
    if (process.env.STATION_BACKEND_TOKEN) headers.Authorization = `Bearer ${process.env.STATION_BACKEND_TOKEN}`;
    const response = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`Backend returned ${response.status}`);
    return parseRemoteState(await response.json(), stationId);
  } catch (error) {
    console.error('Station backend read failed:', error);
    return unavailableState(stationId);
  }
}
