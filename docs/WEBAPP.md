# Webapp

Vite + React + TypeScript.

```bash
cd webapp
npm install
npm run dev
```

## Core model

Single webapp, two local radio transports:
- Desktop: USB via Web Serial
- Mobile: BLE via Web Bluetooth (UART-style firmware service)

Both feed the same BN event pipeline and UI state model.

## Primary pages

Navigation order:
1. Status
2. Messaging
3. Map
4. Radio
5. Config

Sidebar is navigation-only.

## Transport layer

Location: `src/services/transport/`

- `types.ts`: transport interface and status model
- `radioTransportManager.ts`: active transport coordinator
- `bleClient.ts`: BLE implementation
- USB adapter wraps existing `serialClient.ts`

Shared statuses include:
- `idle`
- `requesting_device`
- `connecting`
- `connected`
- `reconnecting`
- `disconnected`
- `failed`

## Message layer

Location: `src/services/messages/`

- `types.ts`: normalized message shape
- `adapter.ts`: maps raw BN/Meshtastic outcomes into normalized messages
- `messageStore.ts`: shared feed state for `Messaging` view

Status taxonomy:
- `ok`
- `decrypt_failed`
- `parse_failed`

## Terminal model

Location: `src/services/terminalLogStore.ts`

One shared terminal history powers:
- `layout/BottomTerminal.tsx`
- `components/RadioView.tsx` (Console tab)

Features:
- shared in/out history
- local `help/?` command support
- filter toggles (`in`, `out`, `errors`, `help`)
- text search
- session-persisted filter preferences

## Settings model

Location: `src/services/appSettings.ts`

Persisted keys:
- `gpsBridgeBaseUrl`
- `mqttBridgeBaseUrl`
- `googleMapsApiKey`
- `radioFrequencyMhz`
- `radioTxPowerDbm`

Reactive hook:
- `src/hooks/useAppSettings.ts`

Used by:
- `SettingsView` (Config page)
- `useBridgeHealth`
- `gpsService`
- `mqttBridge`
- Google Maps loaders

## Environment

Optional env defaults:

```bash
VITE_GPS_BRIDGE_URL=...
VITE_MQTT_BRIDGE_URL=...
VITE_GOOGLE_MAPS_API_KEY=...
VITE_BLACKBOXCOMS=...
```

Runtime saved settings can override these defaults in-browser.

## Current source layout (high signal)

```text
src/
  App.tsx
  hooks/
    useAppSettings.ts
    useBridgeHealth.ts
    useGpsBridge.ts
    useMeshConnection.ts
    useRadioConnection.ts
    useRadioGpsFeed.ts
  layout/
    Header.tsx
    BottomTerminal.tsx
    MobileOverlay.tsx
    Sidebar/
      index.tsx
      NavigationPanel.tsx
      NavButton.tsx
  views/
    NetworkView.tsx      # Status
    MessagesView.tsx     # Messaging
    MapView/
    SettingsView.tsx     # Config
  components/
    RadioView.tsx
    Map.tsx
    GoogleMap.tsx
  services/
    appSettings.ts
    terminalLogStore.ts
    serialClient.ts
    transport/
      types.ts
      bleClient.ts
      radioTransportManager.ts
    messages/
      types.ts
      adapter.ts
      messageStore.ts
    meshClient.ts
    meshtasticStore.ts
    gpsService.ts
    mqttBridge.ts
```

## Deployment note

Target hosted deployment is AWS Gen2.

Boundary to keep:
- BLE remains local device-to-browser transport.
- Cloud stack hosts webapp and bridge-backed remote workflows.

