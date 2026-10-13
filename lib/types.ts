export type ToolId =
  | 'hammer-drill'
  | 'compact-blower'
  | 'battery'
  | 'hand-saw'
  | 'c-clamp'
  | 'combination-pliers'
  | 'claw-hammer'
  | 'flathead-screwdriver'
  | 'adjustable-wrench';

export type DrawerId = `T0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
export type StationMode = 'idle' | 'scanning' | 'held' | 'offline' | 'error';
export type ConnectionState = 'online' | 'offline' | 'unknown';

export interface Detection {
  id: string;
  toolId: ToolId;
  drawerId: DrawerId;
  confidence?: number;
  box?: { x: number; y: number; width: number; height: number };
}

export interface StationState {
  stationId: string;
  mode: StationMode;
  source: 'mock' | 'live';
  scanId: string | null;
  updatedAt: string;
  lastScanAt: string | null;
  connectivity: {
    camera: ConnectionState;
    inference: ConnectionState;
    ledController: ConnectionState;
  };
  detections: Detection[];
  activeDrawerIds: DrawerId[];
  message: string | null;
}

export type DisplayStatus =
  | 'loading'
  | 'ready'
  | 'scanning'
  | 'results'
  | 'empty'
  | 'offline'
  | 'error'
  | 'stale';
