import type { StationState } from './types';

/** Browser reads only our public, read-only route; it never reaches the cloud provider. */
export async function fetchStationState(stationId: string, signal: AbortSignal, scenario?: string): Promise<StationState> {
  const params = scenario ? `?scenario=${encodeURIComponent(scenario)}` : '';
  const response = await fetch(`/api/stations/${encodeURIComponent(stationId)}/state${params}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Station API returned ${response.status}`);
  return response.json() as Promise<StationState>;
}
