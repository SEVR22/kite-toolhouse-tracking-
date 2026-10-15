# ToolLighthouse website MVP

A mobile-first, Spanish-language station dashboard for the KEY Week ToolLighthouse project. It shows a public station state, detected tool categories, a manual storing checklist, and nine assigned compartments. The default state uses a clearly labeled mock with three held detections: T06, T07, and T09.

## Run locally

Requirements: Node.js 22.12 LTS or 24+ and npm (tested with Node 24).

```bash
git clone https://github.com/SEVR22/kite-toolhouse-tracking-.git
cd kite-toolhouse-tracking-
npm install
cp .env.example .env.local  # optional; mock mode is the default
npm run dev
```

Open `http://localhost:3000/station/station-01`. The root path redirects there. In development, open `http://localhost:3000/dev/simulator` to exercise **ready, scanning, one tool, three tools, empty, offline, error, and stale** states. The simulator is unavailable in production and when using the remote source.

On Windows PowerShell, run `npm.cmd install` and `npm.cmd run dev` if its execution policy blocks `npm.ps1`.

To test on a phone, connect the phone and computer to the same network, find the computer's LAN IP, then visit `http://<computer-LAN-IP>:3000/station/station-01`. The development server binds to `0.0.0.0`; allow it through the local firewall if needed. A phone cannot use the computer's `localhost` address. For the physical station QR code, use the eventual deployed HTTPS URL.

```bash
npm run lint
npm run test
npm run build
npm run start
```

## Data flow

The browser polls `GET /api/stations/station-01/state` every 1.5 seconds while visible. Polls never overlap, stop when the tab is hidden, and resume on return. After 15 seconds without a fresh `updatedAt`, the view marks the last state **desactualizado**. Both timings are configurable in `.env.local`.

`lib/types.ts` defines the public `StationState` and detection contract. `lib/catalog.ts` is the one place to edit the nine provisional tool names, drawer IDs, and colors. It derives unique active drawers from known tool IDs, so duplicate objects cannot request conflicting drawer states. The API route reads through `lib/station-data-provider.ts`; React only calls the route via `lib/station-api.ts`. Mock results are held in the running server process, with a stable scan ID and scan time. Their heartbeat timestamp refreshes on API reads; visitors may see different mock lifetimes after server restarts or across server instances. Mock state is never an authoritative shared station state.

## Storing checklist and physical organizer

For each detected item, the student manually checks its box after placing it in the indicated compartment. Detection never checks a box. Progress shows confirmed items versus total; **Finalizar proceso de guardado** stays disabled until every item is checked. Unchecking an item disables it again. Empty scans cannot be finalized.

Finalization clears the list and returns **this browser tab** to the ready view. A completed scan key is saved in `sessionStorage`, so polling, refreshes in the same tab, and stale held responses cannot reopen the same result. A new `scanId` or `lastScanAt` starts a fresh unchecked checklist. The backend must keep these values stable during a held result and change them for each new scan. If both are absent, the page cannot safely finalize the result.

This is a local UI confirmation. It does **not** reset the cloud station state, camera, ESP32, or LEDs, and it does not synchronize confirmation across phones. A shared, persistent finalization workflow requires a trusted backend action with scan identity, authorization, and a hardware reset path. The student-facing API remains GET-only.

The physical organizer is two columns by five rows with one permitted divider removed, leaving nine usable spaces. The precise removed divider and tool positions have not been supplied. The two-column display is therefore a **reference list**, not a verified physical map. Keep the nine existing IDs, labels, colors, and assignments in `lib/catalog.ts`; update that catalog and the diagram order only after the final physical layout is measured.

## Presentation deployment and rollback

The working version is preserved as `backup/pre-presentation-2026-10-15` at `d784dce`; teammate commit `828f974` is included on the presentation feature branch. After reviewing this branch, deploy only with the team's explicit approval and the host's normal restart procedure:

```bash
git fetch origin
git switch feature/presentation-checklist
git pull --ff-only
npm ci
# Set server-side variables in .env.local for live mode; keep tokens out of Git.
npm run build
npm run start
```

Check `/station/station-01`: all boxes start empty, the button enables only after all are checked, finalization clears the page, and a new scan creates a new list. Confirm live detections and LEDs separately. To roll back the site source, stop its process, check out the previously deployed commit (or `backup/pre-presentation-2026-10-15` for the original website), run `npm ci && npm run build`, and restart the web process. Rolling back the website does not change backend or hardware state.

## Connect the cloud backend

1. Agree on the cloud backend's read endpoint, response schema, authentication, and actual YOLO class list. The web adapter expects `GET {STATION_BACKEND_URL}/stations/station-01/state` to return the `StationState` shape. If the backend uses different field names, translate them in `lib/station-data-provider.ts`.
2. Map confirmed model class labels to canonical IDs in `MODEL_CLASS_ALIASES` in `lib/catalog.ts`. The web API validates classes and recalculates drawer IDs from the catalog, ignoring any untrusted drawer list in the response.
3. Set `STATION_DATA_SOURCE=remote`, `STATION_BACKEND_URL`, and optionally `STATION_BACKEND_TOKEN` as **server-side** environment variables. Do not use `NEXT_PUBLIC_` for credentials. Until configured or when the backend fails, the page shows an unavailable state.
4. Give the backend one authoritative current state for this station. The trusted processor should validate predictions, deduplicate categories, manage scan/hold/reset transitions, and persist `scanId`, `lastScanAt`, and `updatedAt`. Every visitor then reads the same held result. Keep the camera/inference ingress and any ESP32 command channel private and authenticated; this public API only supports GET.
5. Measure camera-to-result latency with real station images and verify all nine categories, multiple simultaneous tools, actual drawer assignments, LED colors, and the physical scan/reset trigger.

The tool labels are categories, not verified brand or SKU identifications. The drawer layout and colors are placeholders from the spec. The source spreadsheet reportedly reuses one Tactix URL for the C-clamp and pliers; verify that reference separately.

## Live backend: AI-tool-detection

The live backend is `server.py` in the AI-tool-detection repo. It runs the YOLO model on frames
from a phone camera at the station. It serves `GET /stations/station-01/state` in the
`StationState` shape above, and it holds each scan result itself. It sends canonical `toolId`s,
so `MODEL_CLASS_ALIASES` can stay empty. Each detection's `id` is that tool's fixed UUID.
The model's `boxcutter` class has no drawer here, so the backend does not send it.

When the website runs on the same VM as the backend:

```bash
# .env.local
STATION_DATA_SOURCE=remote
STATION_BACKEND_URL=http://127.0.0.1:8000
STATION_BACKEND_TOKEN=<STATION_TOKEN from AI-tool-detection/.env>
```

If the website is deployed somewhere else, set `STATION_BACKEND_URL` to the backend's public HTTPS URL instead.
The test `accepts the state served by the AI-tool-detection server` in `lib/station-data.test.ts`
pins the backend's response shape.

## Main files

- `app/station/[stationId]/page.tsx` — public station route
- `components/StationDashboard.tsx` — polling, status UI, detected tools, rack
- `app/dev/simulator/page.tsx` and `components/Simulator.tsx` — development-only scenarios
- `app/api/stations/[stationId]/state/route.ts` — public read-only API
- `lib/catalog.ts`, `lib/types.ts`, `lib/station-data-provider.ts` — catalog, contract, mock/remote source
- `lib/station-data.test.ts` — mapping, deduplication, contract, and status tests

The provided implementation specification is copied to `TOOLLIGHTHOUSE_WEBSITE_SPEC.md` for the team.
