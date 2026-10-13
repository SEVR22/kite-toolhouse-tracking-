# ToolLighthouse — Website MVP Specification

**Project:** KEY Week S2 2026 · ToolLighthouse (visual tool detection + storage guidance)  
**Version:** 0.1 — Website-first implementation brief  
**Status:** Ready for implementation with Codex; cloud and electronics integration deferred  
**Audience:** Student team, frontend/backend contributors, and Codex

## 1. Product summary

ToolLighthouse is a **single-station tool return assistant**. A student places one or more tools under a fixed camera. A cloud-hosted YOLO detector identifies the tools. A public, QR-accessible website displays the detected tools and their assigned drawer locations, while ESP32-controlled LEDs illuminate the appropriate drawers.

**This document scopes the website MVP only.** The website must work immediately using realistic mock data; integrating the actual YOLO service, camera, LED controller, and physical LCD must **not** block the initial build.

### Grounded facts versus design assumptions

- **Confirmed by team:** nine tool categories, a single scanning station, multiple simultaneous detections, nine color-indicated miniature drawers, cloud YOLO, ESP32 permitted instead of Arduino Nano, public QR website with **no student login**.
- **Confirmed from provided spreadsheet:** the nine tool names below and their physical-product reference URLs (not pretrained-model URLs).
- **Not yet confirmed:** actual YOLO class labels and endpoint/schema, cloud host/provider, camera transport, exact drawer IDs, final LED colors, scan trigger, state persistence service, measured latency.
- **Website design defaults for now:** Spanish-first interface, `station-01` as stable ID, drawers `T01`–`T09`, one tool category per drawer, provisional colors, polling every 1–2 seconds, scan results held until an explicit reset/new scan or a configurable timeout. All should be configurable.

## 2. Success criteria / user flow

1. Student scans a QR code next to the station and lands on `/station/station-01` without creating an account or signing in.
2. Student sees clear current station state: **Listo**, **Escaneando**, **Resultados listos**, **Desconectado**, or **Error**. An obvious **Modo demostración** indication is shown if using mock data.
3. The station acquires one image/frame batch, and YOLO may report **multiple** tool detections.
4. The backend maps model classes to canonical tool IDs and their drawer IDs. The website presents the identified tool **names** and **drawer number/color**; a 3 × 3 rack diagram highlights the active drawer(s).
5. Once a scan is finalized, the results remain **held** so LEDs do not switch off when the student lifts the tools off the scanning surface.
6. A reset/new-scan event clears the previous held result. Future physical button/ESP32 integration will initiate this event; the public student website is **read-only**.
7. Every device visiting the same station URL should eventually see the **same authoritative station state** after live backend integration. For the initial mock build, make it explicit that the state is simulated and may not synchronize across visitors.

## 3. Tool catalog — from team's spreadsheet

**Important:** The following tool-to-drawer mapping and LED colors are placeholders, **not** an agreed physical layout or verified YOLO classes. Keep this table in one editable configuration module (`catalog.ts` or equivalent), not hardcoded throughout UI components.

| Drawer (provisional) | Canonical tool ID | Display label (Spanish) | Reference product/category | Placeholder color |
|---|---|---|---|---|
| T01 | `hammer-drill` | Taladro percutor | Milwaukee M18 Compact Brushless 1/2\" Hammer Drill/Driver | Red `#EF4444` |
| T02 | `compact-blower` | Sopladora compacta | Milwaukee M18 Compact Blower | Orange `#F97316` |
| T03 | `battery` | Batería M18 | Milwaukee M18 REDLITHIUM XC5.0 | Yellow `#EAB308` |
| T04 | `hand-saw` | Serrucho | Tactix HAND SAW-POLISH | Lime `#84CC16` |
| T05 | `c-clamp` | Prensa tipo C | C-CLAMP | Green `#22C55E` |
| T06 | `combination-pliers` | Alicate universal | Combination pliers | Cyan `#06B6D4` |
| T07 | `claw-hammer` | Martillo de uña | INGCO Claw hammer | Blue `#3B82F6` |
| T08 | `flathead-screwdriver` | Destornillador plano | INGCO flathead screwdriver | Purple `#A855F7` |
| T09 | `adjustable-wrench` | Llave ajustable | Tactix ADJUSTABLE WRENCH | Pink `#EC4899` |

Do not imply product-specific model identification unless the model has actually been trained/evaluated to that level: initial labels may represent **tool categories** rather than exact brands/SKUs.

**Reference-data warning:** The original spreadsheet uses the **same Tactix URL** for both C-clamp and combination pliers; ask the team to verify it separately. Reference product URLs are **not** pretrained model links.

## 4. Website MVP — scope and design

### Student page `/station/station-01`

- **Mobile-first** (QR opens on phones), responsive desktop layout, Spanish text as the default.
- Brand: **ToolLighthouse**; modern engineering-lab feel, tidy visual hierarchy, high contrast, accessible typography, no excessive animation.
- Header: name/logo treatment, station identifier, connection status, last updated time.
- Status panel: `Listo para escanear`, `Analizando herramientas…`, `Herramientas detectadas`, `Sin conexión`, and appropriate failure/empty/loading states.
- Detected tool cards: human-readable name, drawer number, matching color swatch, optionally a small confidence value in an **advanced/details** section (not the main instruction).
- **Nine-drawer overview** (3 columns × 3 rows) showing all locations, active highlights, drawer IDs, and readable text labels. Do not communicate solely through color; the tray number/text should always appear.
- Short instruction: `Coloca tus herramientas en el área de escaneo` before scanning; `Sigue las luces para devolver cada herramienta` after results are held.
- Show **mock/demo warning** when there is no live data; never display a fake “connected to camera/cloud” status.
- Loading skeleton, zero detections, offline, and stale state. If state is stale, make it obvious and do not claim the results are current.
- **No login, personal profile, public mutation controls, or requirement to give camera permissions to the website visitor.** The camera belongs to the station.

### Optional developer-only demo view `/dev/simulator`

- Only available in local development, or explicitly guarded by environment configuration in deployed demo mode.
- Change sample state between `idle`, `scanning`, `held` (one tool), `held` (three tools), `empty`, `offline`, `error`, `stale`.
- Sample held results: hammer + pliers + adjustable wrench (T07, T06, T09).
- Mark mock state unmistakably. No public control path that could modify real station state.

### Non-goals for MVP

- Actual camera input, training YOLO, media streaming, and hosting an inference GPU.
- Electrical circuit design, ESP32 firmware, LCD wiring, LED driver and power supply.
- Inventory stock-management logic, student authentication, returns history, payments, QR generation service, multiple stations, raw image storage, or complex analytics.

## 5. Proposed implementation stack

Use **Next.js App Router + TypeScript + Tailwind CSS** for a fast single-project build. Prefer accessible, lightweight components and icons. No heavy UI framework is required. Do not add a real database just to make the mock UI function.

- Frontend reads station state through an API/data-service abstraction, **not** directly from YOLO.
- Route handler `GET /api/stations/station-01/state` initially returns sample JSON (or a mock adapter). Disable caching / force fresh state as appropriate.
- A typed `StationState` contract is shared between API adapter and React components.
- Configuration lets developers choose `mock` versus `remote` as the state source **without rewriting UI**.
- In `remote` mode, the server-side adapter should call the future team's cloud backend using environment variables; show a graceful unavailable state until configured. Do not hardcode provider assumptions.
- UI can poll `GET` every 1–2 seconds while visible; back off when the page is hidden, prevent overlapping requests, and show stale/offline state after a configurable threshold. **WebSockets/SSE are future optimization, not a blocker.**
- Any private endpoint receiving model outputs or IoT commands must be server-side and authenticated. The student page is **public but read-only**.

### Suggested repository structure (adjust if an existing repo already exists)

```text
/
  TOOLLIGHTHOUSE_WEBSITE_SPEC.md
  web/
    app/
      station/[stationId]/page.tsx
      api/stations/[stationId]/state/route.ts
      dev/simulator/page.tsx          # development only
    components/
      StationHeader.tsx
      ScanStatus.tsx
      DetectionList.tsx
      DrawerGrid.tsx
      EmptyAndErrorStates.tsx
    lib/
      catalog.ts
      types.ts
      demo-state.ts
      station-api.ts
      station-data-provider.ts
    README.md
    .env.example
```

If the workspace is already a Next.js repository, work in its existing structure instead of nesting an unnecessary second app.

## 6. Shared data contract (draft; to be reconciled with cloud teammate)

Use stable **canonical tool IDs** independent of YOLO's training class names. The server will convert model-specific classes to canonical IDs and then map to drawers. A public API response should look approximately like:

```json
{
  "stationId": "station-01",
  "mode": "held",
  "source": "mock",
  "scanId": "demo-scan-001",
  "updatedAt": "2026-10-13T15:00:00Z",
  "lastScanAt": "2026-10-13T14:59:58Z",
  "connectivity": {
    "camera": "unknown",
    "inference": "unknown",
    "ledController": "unknown"
  },
  "detections": [
    {
      "id": "det-001",
      "toolId": "claw-hammer",
      "confidence": 0.94,
      "drawerId": "T07",
      "box": { "x": 0.13, "y": 0.22, "width": 0.26, "height": 0.42 }
    },
    {
      "id": "det-002",
      "toolId": "combination-pliers",
      "confidence": 0.91,
      "drawerId": "T06",
      "box": { "x": 0.51, "y": 0.36, "width": 0.22, "height": 0.25 }
    }
  ],
  "activeDrawerIds": ["T07", "T06"],
  "message": null
}
```

Notes:
- `mode` is one of `idle | scanning | held | offline | error`. `held` with an empty detections array covers `no tools recognized`; represent a stale connection distinctly in UI by comparing timestamps.
- `source` is `mock` or `live` so the UI can identify demos.
- `connectivity` fields are `online | offline | unknown`, and `unknown` should be displayed honestly.
- `box` values are **optional normalized** object coordinates; drawing camera images or bounding boxes is **not** necessary in the first UI.
- `activeDrawerIds` can be derived from validated detections. Ensure duplicate detections of the same tool category do **not** cause conflicting LED states. The UI may show counts if duplicates matter later.
- `updatedAt` and `lastScanAt` use UTC ISO 8601. UI renders localized time and distinguishes fresh from stale.
- Example timestamps/IDs above are demo values, not current live readings.

### Event and security responsibilities (future cloud integration)

1. Station camera/gateway sends images to a **private** inference endpoint; NOT through the publicly readable student website.
2. YOLO returns raw model predictions to a **trusted** backend processor.
3. Trusted backend validates mapped class labels, confidence thresholds, deduplication, scan ID, and state transitions. It writes an authoritative **current station state**.
4. Website reads that state (`GET`) without login. ESP32 reads/receives commands based on the same state through an **authenticated device** channel.
5. Stale scan results should not silently masquerade as a live feed. Persist a **held result** for a clear user-facing window while showing when that scan occurred; if the station loses connection, report it.
6. No public control or arbitrary LED commands. Rate limit authenticated ingress; do not expose tokens in frontend environment variables.
7. Keep the physical camera pointed at the work surface; avoid collecting or publicly displaying people or unnecessary imagery.

## 7. QA / acceptance checklist

- [ ] `npm install` and `npm run dev` work using instructions in `web/README.md`.
- [ ] No login; direct visit to `/station/station-01` loads on a smartphone-sized viewport.
- [ ] UI clearly indicates mock/demo mode.
- [ ] All nine catalog tools and drawers render with correct provisional IDs and editable mapping.
- [ ] Example scan with **three tools** highlights exactly **T07, T06, T09** and lists their names.
- [ ] Displayed text and tray IDs remain understandable without distinguishing colors.
- [ ] `idle`, `scanning`, `held`, `held-empty`, `offline`, `error`, and `stale` UI states are testable.
- [ ] UI consumes a typed API/data adapter; replacing mock source does not require a frontend rewrite.
- [ ] Periodic updates do not overlap requests or leak intervals on unmount.
- [ ] Public student UI cannot trigger scan/reset or send hardware commands.
- [ ] API response and code do not expose cloud/device credentials; `.env.example` uses placeholders.
- [ ] Basic automated tests cover class-to-tool mapping, active drawer derivation/deduplication, and component states where practical.
- [ ] `npm run lint` and `npm run build` succeed, and README explains how to access site from a phone (deployment or same-LAN hosting, **not** `localhost` from another phone).

## 8. Implementation sequence / backlog

**Build now — website MVP**
1. Inspect existing repository; scaffold Next.js web app if absent.
2. Create catalog and typed state contract.
3. Implement sample-state provider plus `GET /api/stations/[stationId]/state`.
4. Build polished, responsive station page and nine-drawer visualization.
5. Exercise multiple scan/connection/error states in a dev-only simulator.
6. Write setup documentation and run lint/build/tests.

**Next — integrate your teammate's cloud service**
1. Obtain deployment URL, authentication method, response schema, class list, and image transport details.
2. Add remote adapter and canonical class mapping.
3. Implement a shared authoritative backend station state (database/cache as suitable) so all viewers receive one result.
4. Measure end-to-end capture → inference → web state propagation latency.
5. Verify real nine-class/multi-tool detections with station-camera images.

**Later — electronics, independent of initial web app**
1. Finalize ESP32 model and camera/IoT division of responsibilities.
2. Design the 9-pixel WS2812B LED wiring, 5 V regulated power, ESP32 level shifting and common ground as required.
3. Define authenticated ESP32 command consumption and reliable reconnect/failsafe states.
4. Add a physical scan/reset control and optional LCD. Existing **16-pin parallel LCD without I²C backpack** is optional; pin count/wiring can be addressed later.
5. Adapt the 3D-printable stackable mini-drawer organizer and conceal cables.

## 9. Open integration decisions (do not block website MVP)

- Which YOLO classes are actually trained? Match each to catalog entry, including any missing tool categories.
- What service hosts the YOLO model? What inference endpoint and response format?
- What exact ESP32 variant/camera will be purchased? Can its image quality handle several tools at once?
- Which physical drawer receives each tool? Which LED colors are final?
- Who triggers scan/hold/reset? Physical button, timeout, or software-controlled station event?
- Which service will persist the public station state across devices after mock mode?

## 10. Sources/context supplied by the team

- KEY Week challenge HTML (`SEMANA KEY S2 2026.html`) — educational project scope and deliverables.
- Team workbook (`for key week.xlsx`) — nine selected reference tool names / product links.
- Presentation slide photos — general AI vision principles, evaluation, inference, and debugging; **not mandatory design requirements**.
- Proposed model: https://www.printables.com/model/1812724-workstation-system-stackable-part-drawer-organizer — miniature drawer prototype reference (to be customized later).

**Priority:** Finish a compelling **working mock UI first**, with a clean contract for replacing mocks with the real cloud API. Do not spend the first development session integrating hardware.
