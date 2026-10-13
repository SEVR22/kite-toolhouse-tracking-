import { notFound } from 'next/navigation';
import { StationDashboard } from '@/components/StationDashboard';

export default async function StationPage({ params }: { params: Promise<{ stationId: string }> }) {
  const { stationId } = await params;
  if (stationId !== 'station-01') notFound();
  return <StationDashboard stationId={stationId} showSimulatorLink={process.env.NODE_ENV === 'development'} />;
}
