'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { TOOL_CATALOG, groupDetections } from '@/lib/catalog';
import { getDisplayStatus } from '@/lib/display-status';
import { fetchStationState } from '@/lib/station-api';
import type { DemoScenario } from '@/lib/demo-state';
import type { ConnectionState, DisplayStatus, StationState } from '@/lib/types';

const POLL_MS = Math.max(1000, Number(process.env.NEXT_PUBLIC_STATION_POLL_MS) || 1500);
const STALE_AFTER_MS = Math.max(3000, Number(process.env.NEXT_PUBLIC_STATION_STALE_AFTER_MS) || 15000);

const copy: Record<DisplayStatus, { label: string; title: string; description: string; instruction: string }> = {
  loading: { label: 'CARGANDO', title: 'Consultando estación', description: 'Estamos obteniendo el estado más reciente.', instruction: 'Espera un momento.' },
  ready: { label: 'LISTO', title: 'Lista para escanear', description: 'La estación está esperando una nueva captura.', instruction: 'Coloca tus herramientas en el área de escaneo.' },
  scanning: { label: 'ESCANEANDO', title: 'Analizando herramientas…', description: 'La estación está identificando los objetos colocados.', instruction: 'Mantén las herramientas en el área de escaneo.' },
  results: { label: 'RESULTADOS LISTOS', title: 'Herramientas detectadas', description: 'Los resultados de este escaneo permanecen visibles para que puedas devolver cada herramienta.', instruction: 'Sigue las luces para devolver cada herramienta.' },
  empty: { label: 'SIN COINCIDENCIAS', title: 'No se reconocieron herramientas', description: 'El último escaneo terminó sin encontrar una categoría del catálogo.', instruction: 'Revisa la posición de las herramientas e intenta un nuevo escaneo en la estación.' },
  offline: { label: 'SIN CONEXIÓN', title: 'Estación no disponible', description: 'No podemos confirmar el estado actual de la estación.', instruction: 'Consulta al equipo encargado antes de devolver herramientas.' },
  error: { label: 'ERROR', title: 'No se completó el análisis', description: 'Ocurrió un problema durante el último escaneo.', instruction: 'Intenta un nuevo escaneo desde la estación o avisa al equipo.' },
  stale: { label: 'DATOS DESACTUALIZADOS', title: 'Último estado conocido', description: 'La estación dejó de actualizarse. Estos resultados pueden haber cambiado.', instruction: 'Confirma las luces de la estación antes de guardar herramientas.' },
};

function formatTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
}

function connectionLabel(value: ConnectionState | undefined) {
  return value === 'online' ? 'En línea' : value === 'offline' ? 'Sin conexión' : 'Sin verificar';
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 44 44" fill="none">
        <path d="M11 34h22M15 34l3-18h8l3 18M17 16l-1-5h12l-1 5M21 6h2v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 15l7 3M38 15l-7 3M5 24h7M39 24h-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".55" />
        <path d="M21 23h2v5h-2z" fill="currentColor" />
      </svg>
    </div>
  );
}

function StatusIcon({ status }: { status: DisplayStatus }) {
  return (
    <div className={`status-symbol status-symbol--${status}`} aria-hidden="true">
      {status === 'results' || status === 'empty' ? (
        <svg viewBox="0 0 64 64" fill="none"><rect x="12" y="16" width="40" height="32" rx="6" stroke="currentColor" strokeWidth="2" /><path d="M12 27h40M25 27v21M39 27v21" stroke="currentColor" strokeWidth="2" /><path d="m25 16 7-7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      ) : status === 'offline' || status === 'error' || status === 'stale' ? (
        <svg viewBox="0 0 64 64" fill="none"><path d="M32 10 57 53H7L32 10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M32 25v13M32 46h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
      ) : (
        <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="17" stroke="currentColor" strokeWidth="2" /><circle cx="32" cy="32" r="6" stroke="currentColor" strokeWidth="2" /><path d="M32 5v9M32 50v9M5 32h9M50 32h9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
      )}
    </div>
  );
}

function useStationState(stationId: string, scenario?: DemoScenario) {
  const [state, setState] = useState<StationState | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;

    async function poll() {
      if (disposed || document.hidden) return;
      controller = new AbortController();
      try {
        const next = await fetchStationState(stationId, controller.signal, scenario);
        if (!disposed) {
          setState(next);
          setRequestFailed(false);
          setNow(Date.now());
        }
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) setRequestFailed(true);
      } finally {
        controller = undefined;
        if (!disposed && !document.hidden) timer = setTimeout(poll, POLL_MS);
      }
    }

    function onVisibility() {
      if (timer) clearTimeout(timer);
      controller?.abort();
      if (!document.hidden) timer = setTimeout(poll, 0);
    }

    document.addEventListener('visibilitychange', onVisibility);
    if (!document.hidden) timer = setTimeout(poll, 0);
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [stationId, scenario]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return { state, status: getDisplayStatus(state, now, STALE_AFTER_MS, requestFailed), requestFailed };
}

export function StationDashboard({ stationId, scenario, showSimulatorLink = false }: { stationId: string; scenario?: DemoScenario; showSimulatorLink?: boolean }) {
  const { state, status, requestFailed } = useStationState(stationId, scenario);
  const content = copy[status];
  const isDemo = state?.source === 'mock';
  const active = new Set(status === 'results' || status === 'stale' ? state?.activeDrawerIds : []);
  const groups = groupDetections(state?.detections ?? []);
  const resultsVisible = (status === 'results' || status === 'stale') && groups.length > 0;

  return (
    <div className="site-shell">
      <div className="ambient-glow" aria-hidden="true" />
      <header className="site-header page-width">
        <div className="brand-lockup"><BrandMark /><div><div className="brand-name">Tool<span>Lighthouse</span></div><div className="brand-subtitle">SMART RETURN STATION</div></div></div>
        <div className="header-right"><span className="keyweek-tag">KEY WEEK <span>·</span> S2 2026</span><span className="header-divider" /><span className="station-tag"><span className="tiny-dot" /> ESTACIÓN 01</span></div>
      </header>

      <main className="page-width main-content">
        <div className="topline"><div><div className="eyebrow"><span className="eyebrow-line" /> PANEL DE DEVOLUCIÓN</div><h1>Encuentra el lugar de <em>cada herramienta.</em></h1><p className="intro-copy">Identificación visual y guía de almacenamiento para la estación de herramientas.</p></div><div className="system-id">SISTEMA <strong>TL / 01</strong></div></div>

        {isDemo && <div className="demo-banner" role="note"><span className="demo-banner-icon">◇</span><strong>Modo demostración</strong><span>Los datos son simulados y pueden variar entre visitantes. No hay conexión con cámara, nube ni luces reales.</span></div>}
        {requestFailed && state && status !== 'stale' && <div className="connection-warning" role="status">La actualización está fallando. Mostrando el último estado recibido; se marcará como desactualizado si continúa.</div>}

        <div className="dashboard-grid">
          <section className="left-column" aria-label="Estado y resultados">
            <div className={`panel status-panel status-panel--${status}`} aria-live="polite">
              <div className="panel-top"><span className="section-index">01 / ESTADO ACTUAL</span><span className={`live-pill live-pill--${status}`}><span className="pill-dot" /> {content.label}</span></div>
              <div className="status-body"><StatusIcon status={status} /><div><h2>{content.title}</h2><p>{state?.message && status === 'error' ? state.message : content.description}</p></div></div>
              <div className="instruction-bar"><span aria-hidden="true">↗</span><p>{content.instruction}</p></div>
            </div>

            <div className="panel detection-panel">
              <div className="panel-heading"><div><span className="section-index">02 / RESULTADOS</span><h2>Herramientas identificadas</h2></div><span className="count-chip">{resultsVisible ? groups.length.toString().padStart(2, '0') : '00'} <span>CATEGORÍAS</span></span></div>
              {status === 'loading' ? <div className="skeleton-list" aria-label="Cargando herramientas"><div /><div /><div /></div> : resultsVisible ? (
                <div className="detection-list">
                  {groups.map(({ tool, count, confidence }) => (
                    <div className="detection-row" key={tool.id} style={{ '--drawer-color': tool.color } as CSSProperties}>
                      <div className="detection-color" aria-hidden="true" /><div className="detection-text"><strong>{tool.label}</strong><span>{count > 1 ? `${count} objetos · ` : ''}Ubicación asignada</span></div><div className="drawer-badge"><small>CAJÓN</small><strong>{tool.drawerId}</strong></div>
                      {confidence !== undefined && <span className="sr-only">Confianza: {Math.round(confidence * 100)}%</span>}
                    </div>
                  ))}
                  <details className="details-block"><summary>Detalles del análisis</summary><div className="details-content"><div><span>Escaneo</span><strong>{state?.scanId ?? '—'}</strong></div><div><span>Realizado a las</span><strong>{formatTime(state?.lastScanAt)}</strong></div><div><span>Detecciones</span><strong>{state?.detections.length ?? 0}</strong></div><div><span>Confianza máxima</span><strong>{Math.max(...groups.map(({ confidence }) => confidence ?? 0)) ? `${Math.round(Math.max(...groups.map(({ confidence }) => confidence ?? 0)) * 100)}%` : '—'}</strong></div></div></details>
                </div>
              ) : (
                <div className="empty-results"><div className="empty-visual" aria-hidden="true">▦</div><strong>{status === 'empty' ? 'Sin herramientas reconocidas' : 'Aún no hay resultados para mostrar'}</strong><p>{status === 'empty' ? 'El cajón se iluminará cuando la estación reconozca una herramienta.' : 'Las herramientas detectadas aparecerán aquí al terminar el análisis.'}</p></div>
              )}
            </div>
          </section>

          <section className="panel rack-panel" aria-labelledby="rack-title"><div className="rack-heading"><div><span className="section-index">03 / MAPA DE ALMACENAMIENTO</span><h2 id="rack-title">Estación de cajones</h2><p>9 ubicaciones · matriz 3 × 3</p></div><div className="rack-legend"><span className="legend-light" /><span>{status === 'stale' ? 'ÚLTIMO RESULTADO' : 'CAJÓN ACTIVO'}</span></div></div>
            <div className="rack-frame"><div className="rack-frame-top"><span>TOOLLIGHTHOUSE / RACK 01</span><span>◈ ◈ ◈</span></div><div className="drawer-grid">
              {TOOL_CATALOG.map((tool, index) => {
                const highlighted = active.has(tool.drawerId);
                return <div key={tool.id} className={`drawer ${highlighted ? 'drawer--active' : ''} ${status === 'stale' && highlighted ? 'drawer--stale' : ''}`} style={{ '--drawer-color': tool.color } as CSSProperties} aria-label={`${tool.drawerId}, ${tool.label}, ${highlighted ? status === 'stale' ? 'último resultado conocido' : 'activo' : 'inactivo'}`}><div className="drawer-top"><span>{tool.drawerId}</span><span className="drawer-led" /></div><div className="drawer-handle" aria-hidden="true" /><strong>{tool.shortLabel}</strong><small>{highlighted ? status === 'stale' ? 'SIN CONFIRMAR' : 'ACTIVO' : `POSICIÓN ${String(index + 1).padStart(2, '0')}`}</small></div>;
              })}
            </div><div className="rack-frame-bottom"><span>DISPOSICIÓN PROVISIONAL</span><span>01 — 09</span></div></div>
            <p className="rack-footnote"><span aria-hidden="true">ⓘ</span> Los números y colores son provisionales hasta confirmar el montaje físico.</p>
          </section>
        </div>

        <footer className="site-footer"><div className="footer-station"><span className={`footer-status-dot ${status === 'offline' || status === 'error' || status === 'stale' ? 'footer-status-dot--warning' : ''}`} /> <span>Estado actualizado: <strong>{formatTime(state?.updatedAt)}</strong></span></div><div className="footer-connectivity"><span>Cámara: {connectionLabel(state?.connectivity.camera)}</span><span>Modelo: {connectionLabel(state?.connectivity.inference)}</span><span>Luces: {connectionLabel(state?.connectivity.ledController)}</span></div>{showSimulatorLink && <Link href="/dev/simulator" className="simulator-link">Abrir simulador ↗</Link>}</footer>
      </main>
    </div>
  );
}
