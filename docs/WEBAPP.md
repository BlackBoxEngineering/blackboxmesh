# Webapp

Vite + React + TypeScript. Dev server runs on port 3000.

```bash
cd webapp
npm install
npm run dev
```

## Stack

- **Vite** for dev/build
- **React 18** with `StrictMode`
- **TypeScript**, named exports throughout, no React context, no global stores
- **MapLibre GL** + OpenStreetMap raster tiles (default, always-on)
- **Google Maps JS API** as an optional alternative (requires API key)
- **Tailwind CSS** for styling
- **Web Serial API** for talking to a locally-attached Heltec node directly
  from the browser (no bridge required for end users)

## Connection model — everything is opt-in

Nothing connects on load. Every external connection sits behind a sidebar
toggle whose state is persisted in `localStorage`:

| Toggle (Sidebar → Connections) | Backing key                | What it opens                                  |
| ------------------------------ | -------------------------- | ---------------------------------------------- |
| Radio                          | `serialClient.autoConnect` | Web Serial to the Heltec (CP210x VID 0x10c4)   |
| Browser GPS                    | `browserGeoEnabled`        | `navigator.geolocation.watchPosition`          |
| Phone GPS                      | `gpsBridgeRunning`         | Polls the local `gps-bridge` on `:8080`        |
| Mesh                           | `meshClient.autoConnect`   | WS to local `mqtt-bridge` on `:8081`           |
| Meshtastic Observer            | `observerMode`             | Sends `BN MESH ON` to firmware on connect      |

The Local Hub panel below shows liveness of the optional bridge services
(`:8080`, `:8081`) but does **not** open any connection itself.

## Two ways to talk to a node

End users only need a browser:

```
Browser ──Web Serial (USB)──> Heltec (COM3, 115200)
```

The dev rig adds optional bridge services for headless / multi-host setups:

```
Heltec ──USB──> serial-bridge ──HTTP──> mqtt-bridge ──WS──> Browser
Phone  ──ADB──> gps-bridge   ──HTTP──> serial-bridge ──USB──> Heltec
```

`serialClient.ts` is the canonical Web Serial path and the one used by the
Radio view. The bridge path is documented in [SERVICES.md](SERVICES.md) and
is dev-only.

## GPS into the radio

The Heltec has no on-board GPS. `useRadioGpsFeed` watches the browser/phone
fix and writes `BN GPS <lat> <lon> <acc>` to the connected radio so it can
include the position in its outgoing beacons.

## Map selection

The map selector in the top-right picks between:

- `osm` — MapLibre + OSM (no key required)
- `google` / `satellite` / `hybrid` / `terrain` — Google Maps

The choice is persisted in `localStorage` under `mapStyle`.

## Environment

`webapp/.env` (gitignored):

```
VITE_GOOGLE_MAPS_API_KEY=...   # optional — Google base map only
VITE_GPS_BRIDGE_URL=...        # optional — overrides default http://localhost:8080
VITE_MQTT_BRIDGE_URL=...       # optional — overrides default http://localhost:8081
VITE_BLACKBOXCOMS=...          # required for message encryption (EnDeCom Lambda key)
```

The Google Maps base map is only loaded if the key is present and the user
selects one of the Google modes. Vite reads `.env` at dev-server startup,
so restart `npm run dev` after editing it.

## Node shape

The single shape every view consumes. `mqttBridge.toClientNode()` normalises
`nodeId` → `id` at the boundary; nothing downstream sees `nodeId`.

```ts
interface BlackBoxMeshNode {
  id: string;          // hex node id, e.g. "0x9E9E139C"
  latitude?: number;
  longitude?: number;
  rssi?: number;
  snr?: number;
  lastSeen: number;
  routes: unknown[];
}
```

If `latitude`/`longitude` are missing the node is **not** rendered. No
`(0, 0)` fallback, no synthetic placeholder node.

## Meshtastic integration

Observed Meshtastic nodes are tracked separately from BlackBoxMesh nodes:

```ts
interface MeshtasticNode {
  id: string;           // e.g. "0x04C6723C"
  longName?: string;    // e.g. "HebMesh Static"
  shortName?: string;   // e.g. "HMSH"
  hwModel?: string;     // e.g. "HELTEC_V3"
  latitude?: number;
  longitude?: number;
  altitude?: number;
  rssi?: number;
  snr?: number;
  lastSeen: number;
}

interface MeshtasticMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
  rssi?: number;
  snr?: number;
}
```

### Two decode paths

| Path | When | Decoder | Output |
| ---- | ---- | ------- | ------ |
| **Web Serial direct** | `dev:noserial` / end-user | `services/meshtasticDecoder.ts` (Web Crypto API, browser-side) | Inline in sniffer table |
| **Bridge stack** | `npm run dev` | `services/meshtastic-decoder.ts` (Node.js crypto) | Map markers + Network messages feed |

Both use the same algorithm: AES-128-CTR with the default LongFast PSK
(`1PG7OiApB1nwvP+rz05pAQ==`). Frames using a private PSK show as
"encrypted" with header info (from, to, RSSI) still visible.

### Sniffer tab (Radio → Sniffer)

- Observer mode toggle persists in `localStorage` — survives tab switches
  and page reloads
- Auto-sends `BN MESH ON` on radio reconnect if observer was enabled
- Decoded frames show inline:
  - 💬 Text messages (green)
  - 👤 Node info with long name (cyan)
  - 📍 GPS positions (yellow)
  - Other portnums (blue)
  - Private/encrypted (grey)

### Map + Network view (bridge stack only)

- **Map** — Meshtastic nodes render as **green** markers (BlackBoxMesh = orange).
  Popup shows long name, hardware model, altitude, RSSI/SNR.
- **Network view** — `MeshtasticMessages` component shows decoded text messages
  from the default LongFast channel in real-time.
- **Data source** — `useMeshtastic()` hook polls `GET /meshtastic/nodes` and
  `GET /meshtastic/messages`, plus subscribes to `meshtastic_node` /
  `meshtastic_message` WebSocket events for live updates.

## Source layout

```
src/
├── App.tsx                   # composition only, ~84 lines
├── main.tsx
├── hooks/
│   ├── useBridgeHealth.ts    # polls :8080 + :8081 every 5s
│   ├── useGpsBridge.ts       # owns the gps-bridge polling lifecycle
│   ├── useMeshConnection.ts  # mesh WS connect/disconnect + node list
│   ├── useMeshtastic.ts      # Meshtastic node/message polling + WS subscription
│   ├── usePersistentToggle.ts# localStorage-backed boolean
│   ├── useRadioConnection.ts # Web Serial connect/disconnect + status
│   └── useRadioGpsFeed.ts    # pipes browser/phone fix to BN GPS
├── layout/
│   ├── Header.tsx
│   ├── BottomTerminal.tsx
│   ├── MobileOverlay.tsx
│   └── Sidebar/
│       ├── index.tsx
│       ├── NavigationPanel.tsx
│       ├── ConnectionsPanel.tsx
│       ├── LocalHubPanel.tsx
│       ├── NodeStatusPanel.tsx
│       ├── NetworkSidebarPanel.tsx
│       ├── ConfigSidebarPanel.tsx
│       └── NavButton.tsx
├── views/
│   ├── NetworkView.tsx       # services dashboard + Meshtastic messages feed
│   ├── ConfigView.tsx
│   └── MapView/
│       ├── index.tsx         # merges BlackBoxMesh + Meshtastic nodes for map
│       ├── useMapGps.ts
│       ├── useMeshNodes.ts
│       ├── useGoogleMapsApi.ts
│       └── calculateDistance.ts
├── components/
│   ├── RadioView.tsx         # full Radio page: Messages/Peers/Sniffer/Telemetry/Console
│   ├── Map.tsx               # MapLibre OSM view (green=Meshtastic, orange=BlackBoxMesh)
│   ├── GoogleMap.tsx         # Google Maps view
│   ├── Map/                  # marker + control subcomponents
│   └── Messages/
│       └── MeshtasticMessages.tsx  # decoded Meshtastic text message feed
├── services/
│   ├── serialClient.ts       # Web Serial singleton (canonical end-user path)
│   ├── meshClient.ts         # mesh WS singleton, node store, autoConnect
│   ├── radioNodeAdapter.ts   # bridges serialClient RX/STATUS events → meshClient
│   ├── mqttBridge.ts         # REST + WS primitives for mqtt-bridge (incl. Meshtastic endpoints)
│   ├── meshtasticDecoder.ts  # browser-side AES-128-CTR decoder (Web Crypto API)
│   ├── gpsService.ts         # browser geolocation + bridge polling
│   ├── encryption.ts         # callEnDeCom — V2 AES-256-GCM via Lambda
│   └── types.ts              # BlackBoxMeshNode, MeshtasticNode, MeshtasticMessage
└── types/
    ├── gps.ts
    └── view.ts
```

## House rules

- Named exports only.
- One top-level component / hook per file.
- No React context, no global stores. State lives in `App.tsx` and flows
  down as props.
- Props bag pattern when a row of related state crosses the boundary
  (`radio`, `browserGps`, `phoneGps`, …).
- No new dependencies without architect sign-off.
- No comments explaining unchanged code.
