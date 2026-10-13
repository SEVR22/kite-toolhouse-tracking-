import { notFound } from 'next/navigation';
import { Simulator } from '@/components/Simulator';

export default function SimulatorPage() {
  if (process.env.NODE_ENV !== 'development' || process.env.STATION_DATA_SOURCE === 'remote') notFound();
  return <Simulator />;
}
