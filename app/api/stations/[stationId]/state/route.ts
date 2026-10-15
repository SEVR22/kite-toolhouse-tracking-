import { NextRequest, NextResponse } from 'next/server';
import { DEMO_SCENARIOS, type DemoScenario } from '@/lib/demo-state';
import { getStationState } from '@/lib/station-data-provider';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ stationId: string }> }) {
  const { stationId } = await context.params;
  if (stationId !== 'station-01') return NextResponse.json({ error: 'Station not found' }, { status: 404 });
  const requested = request.nextUrl.searchParams.get('scenario');
  const scenario = process.env.NODE_ENV === 'development' && process.env.STATION_DATA_SOURCE === 'mock' && requested && DEMO_SCENARIOS.includes(requested as DemoScenario)
    ? requested as DemoScenario : undefined;
  const state = await getStationState(stationId, scenario);
  return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
