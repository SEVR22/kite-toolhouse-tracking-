import { catalogById, deriveActiveDrawerIds } from './catalog';
import type { Detection, StationMode, StationState, ToolId } from './types';

export type DemoScenario = 'idle' | 'scanning' | 'held-one' | 'held-three' | 'empty' | 'offline' | 'error' | 'stale';
export const DEMO_SCENARIOS: readonly DemoScenario[] = ['idle', 'scanning', 'held-one', 'held-three', 'empty', 'offline', 'error', 'stale'];
const scanTimes = new Map<DemoScenario, string>();

function detection(id: string, toolId: ToolId, confidence: number): Detection {
  return { id, toolId, confidence, drawerId: catalogById[toolId].drawerId };
}

export function createMockState(stationId: string, scenario: DemoScenario = 'held-three', now = new Date()): StationState {
  const mode: StationMode = scenario === 'idle' || scenario === 'scanning' || scenario === 'offline' || scenario === 'error' ? scenario : 'held';
  const isScan = mode === 'held';
  if (isScan && !scanTimes.has(scenario)) scanTimes.set(scenario, new Date(now.getTime() - (scenario === 'stale' ? 65_000 : 0)).toISOString());
  const detections = scenario === 'held-one'
    ? [detection('demo-001', 'claw-hammer', 0.94)]
    : scenario === 'held-three' || scenario === 'stale'
      ? [
          detection('demo-001', 'claw-hammer', 0.94),
          detection('demo-002', 'combination-pliers', 0.91),
          detection('demo-003', 'adjustable-wrench', 0.88),
        ]
      : [];

  return {
    stationId,
    mode,
    source: 'mock',
    scanId: isScan ? `demo-${scenario}` : null,
    updatedAt: new Date(now.getTime() - (scenario === 'stale' ? 60_000 : 0)).toISOString(),
    lastScanAt: isScan ? scanTimes.get(scenario)! : null,
    connectivity: { camera: 'unknown', inference: 'unknown', ledController: 'unknown' },
    detections,
    activeDrawerIds: deriveActiveDrawerIds(detections),
    message: scenario === 'error' ? 'No se pudo procesar el último escaneo.' : null,
  };
}
