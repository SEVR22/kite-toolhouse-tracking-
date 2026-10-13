'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StationDashboard } from './StationDashboard';
import type { DemoScenario } from '@/lib/demo-state';

const scenarios: { id: DemoScenario; label: string; detail: string }[] = [
  { id: 'idle', label: 'Lista', detail: 'Sin escaneo' },
  { id: 'scanning', label: 'Escaneando', detail: 'Análisis en curso' },
  { id: 'held-one', label: '1 herramienta', detail: 'Martillo · T07' },
  { id: 'held-three', label: '3 herramientas', detail: 'T06 · T07 · T09' },
  { id: 'empty', label: 'Vacía', detail: 'Sin coincidencias' },
  { id: 'offline', label: 'Desconectada', detail: 'Sin conexión' },
  { id: 'error', label: 'Error', detail: 'Fallo de análisis' },
  { id: 'stale', label: 'Desactualizada', detail: 'Estado antiguo' },
];

export function Simulator() {
  const [scenario, setScenario] = useState<DemoScenario>('held-three');
  return <>
    <div className="simulator-bar"><div className="simulator-bar-inner"><div><span className="simulator-kicker">ENTORNO DE DESARROLLO</span><h1>Simulador de estados</h1><p>Prueba la interfaz con respuestas simuladas de la API. Esta vista no modifica la estación.</p></div><Link href="/station/station-01">Abrir vista estudiante ↗</Link></div>
      <div className="scenario-strip" role="group" aria-label="Elegir escenario simulado">{scenarios.map((item) => <button type="button" key={item.id} className={`scenario-button ${scenario === item.id ? 'scenario-button--active' : ''}`} onClick={() => setScenario(item.id)} aria-pressed={scenario === item.id}><strong>{item.label}</strong><span>{item.detail}</span></button>)}</div>
    </div>
    <StationDashboard key={scenario} stationId="station-01" scenario={scenario} />
  </>;
}
