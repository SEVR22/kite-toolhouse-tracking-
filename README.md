# ToolLighthouse website MVP

A mobile-first, Spanish-language station dashboard for the KEY Week ToolLighthouse project. It shows a public, read-only station state, detected tool categories, and a 3 × 3 drawer rack. The default state uses a clearly labeled mock with three held detections: T06, T07, and T09.

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

## Connect the cloud backend

1. Agree on the cloud backend's read endpoint, response schema, authentication, and actual YOLO class list. The web adapter expects `GET {STATION_BACKEND_URL}/stations/station-01/state` to return the `StationState` shape. If the backend uses different field names, translate them in `lib/station-data-provider.ts`.
2. Map confirmed model class labels to canonical IDs in `MODEL_CLASS_ALIASES` in `lib/catalog.ts`. The web API validates classes and recalculates drawer IDs from the catalog, ignoring any untrusted drawer list in the response.
3. Set `STATION_DATA_SOURCE=remote`, `STATION_BACKEND_URL`, and optionally `STATION_BACKEND_TOKEN` as **server-side** environment variables. Do not use `NEXT_PUBLIC_` for credentials. Until configured or when the backend fails, the page shows an unavailable state.
4. Give the backend one authoritative current state for this station. The trusted processor should validate predictions, deduplicate categories, manage scan/hold/reset transitions, and persist `scanId`, `lastScanAt`, and `updatedAt`. Every visitor then reads the same held result. Keep the camera/inference ingress and any ESP32 command channel private and authenticated; this public API only supports GET.
5. Measure camera-to-result latency with real station images and verify all nine categories, multiple simultaneous tools, actual drawer assignments, LED colors, and the physical scan/reset trigger.

The tool labels are categories, not verified brand or SKU identifications. The drawer layout and colors are placeholders from the spec. The source spreadsheet reportedly reuses one Tactix URL for the C-clamp and pliers; verify that reference separately.

## Main files

- `app/station/[stationId]/page.tsx` — public station route
- `components/StationDashboard.tsx` — polling, status UI, detected tools, rack
- `app/dev/simulator/page.tsx` and `components/Simulator.tsx` — development-only scenarios
- `app/api/stations/[stationId]/state/route.ts` — public read-only API
- `lib/catalog.ts`, `lib/types.ts`, `lib/station-data-provider.ts` — catalog, contract, mock/remote source
- `lib/station-data.test.ts` — mapping, deduplication, contract, and status tests

The provided implementation specification is copied to `TOOLLIGHTHOUSE_WEBSITE_SPEC.md` for the team.
