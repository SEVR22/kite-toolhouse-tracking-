import type { Detection, DrawerId, ToolId } from './types';

export interface ToolCatalogEntry {
  id: ToolId;
  drawerId: DrawerId;
  label: string;
  shortLabel: string;
  color: string;
}

// Provisional physical arrangement and LED colors. Update this one table after
// the team confirms actual drawer labels and LED assignments.
export const TOOL_CATALOG: readonly ToolCatalogEntry[] = [
  { id: 'hammer-drill', drawerId: 'T01', label: 'Taladro percutor', shortLabel: 'Taladro', color: '#EF4444' },
  { id: 'compact-blower', drawerId: 'T02', label: 'Sopladora compacta', shortLabel: 'Sopladora', color: '#F97316' },
  { id: 'battery', drawerId: 'T03', label: 'Batería M18', shortLabel: 'Batería', color: '#EAB308' },
  { id: 'hand-saw', drawerId: 'T04', label: 'Serrucho', shortLabel: 'Serrucho', color: '#84CC16' },
  { id: 'c-clamp', drawerId: 'T05', label: 'Prensa tipo C', shortLabel: 'Prensa C', color: '#22C55E' },
  { id: 'combination-pliers', drawerId: 'T06', label: 'Alicate universal', shortLabel: 'Alicate', color: '#06B6D4' },
  { id: 'claw-hammer', drawerId: 'T07', label: 'Martillo de uña', shortLabel: 'Martillo', color: '#3B82F6' },
  { id: 'flathead-screwdriver', drawerId: 'T08', label: 'Destornillador plano', shortLabel: 'Destorn.', color: '#A855F7' },
  { id: 'adjustable-wrench', drawerId: 'T09', label: 'Llave ajustable', shortLabel: 'Llave', color: '#EC4899' },
] as const;

export const catalogById = Object.fromEntries(TOOL_CATALOG.map((tool) => [tool.id, tool])) as Record<ToolId, ToolCatalogEntry>;

// Add confirmed YOLO class aliases here as the team's model is finalized.
// Canonical IDs are also accepted so fixtures and backend tests stay stable.
export const MODEL_CLASS_ALIASES: Readonly<Record<string, ToolId>> = {};

export function canonicalToolIdForClass(modelClass: string): ToolId | null {
  const key = modelClass.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(catalogById, key)) return key as ToolId;
  return MODEL_CLASS_ALIASES[key] ?? null;
}

export function deriveActiveDrawerIds(detections: readonly Pick<Detection, 'toolId'>[]): DrawerId[] {
  const active = new Set(detections.map(({ toolId }) => catalogById[toolId]?.drawerId).filter((id): id is DrawerId => Boolean(id)));
  return TOOL_CATALOG.map(({ drawerId }) => drawerId).filter((drawerId) => active.has(drawerId));
}

export function groupDetections(detections: readonly Detection[]) {
  const counts = new Map<ToolId, { tool: ToolCatalogEntry; count: number; confidence?: number }>();
  for (const detection of detections) {
    const tool = catalogById[detection.toolId];
    if (!tool) continue;
    const current = counts.get(tool.id);
    counts.set(tool.id, {
      tool,
      count: (current?.count ?? 0) + 1,
      confidence: Math.max(current?.confidence ?? 0, detection.confidence ?? 0) || undefined,
    });
  }
  return TOOL_CATALOG.flatMap(({ id }) => counts.get(id) ?? []);
}
