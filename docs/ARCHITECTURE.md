# Architecture

BlackBoxMesh is a sovereign LoRa mesh network with an optional desktop
bridge layer and a web client.

## Who connects how

The webapp is the universal client; any browser can join. Nothing
auto-connects — every external connection is behind an explicit user
toggle persisted in `localStorage`.

| User                          | Location source                                 | Node link                       |
| ----------------------------- | ----------------------------------------------- | ------------------------------- |
| Desktop, nothing attached     | `navigator.geolocation` (often IP-geolocated)   | —                               |
| Desktop with Heltec on USB    | Browser GPS or phone GPS                        | **Web Serial direct** (no bridge) |
| Desktop with phone over ADB   | Phone GPS via `gps-bridge` (precise)            | Optional bridge stack           |
| Mobile (phone visits webapp)  | Phone's native GPS via `navigator.geolocation`  | —                               |

The LoRa nodes talk to each other over their own radio. They do not need
WiFi or any internet path. The firmware never opens WiFi.

## Two host paths

There are two ways the browser can reach a locally-attached node:

1. **Web Serial direct** — the canonical end-user path. The browser
   (`services/serialClient.ts`) opens the CP210x USB serial port itself,
   talks BN line protocol to the firmware, and feeds GPS in via
   `BN GPS <lat> <lon> <acc>`. No bridges required, no install beyond
   the webapp.
2. **Bridge stack** — dev-rig only. `serial-bridge` holds COM3, forwards
   reports to `mqtt-bridge`, which fans out over WebSocket. Useful for
   headless hosts and for sharing one node across multiple browsers, but
   not required for normal use. See [SERVICES.md](SERVICES.md).

## Topology (full dev rig)

```
+---------------------+        USB serial          +---------------------+
|  Heltec WiFi LoRa   |  <---------------------->  |  serial-bridge.ts   |
|  32 V3  (firmware)  |   BN line protocol         |   (:no port)        |
+---------------------+                            +----------+----------+
         | LoRa 868 MHz                                       |
         |                                                    | HTTP POST /report
         v                                                    v
   other BlackBoxMesh nodes                              +---------------------+
   + observed Meshtastic                            |   mqtt-bridge.ts    |
                                                    |     (:8081)         |
                                                    +----------+----------+
                                                               |
                                                               | HTTP / WS
+-----------------+    ADB        +---------------------+      v
| Android phone   |  ----------> |   gps-bridge.ts     |   +---------------------+
| (GPS source)    |   :8080      |     (:8080)         |   |  Vite webapp        |
+-----------------+              +---------------------+   |     (:3000)         |
                                          ^                +---------------------+
                                          |
                                          +-- HTTP GET /gps (every 10s)
```

## Process layout (dev rig — bridges are optional)

| Process                              | Port  | Purpose                                                    |
| ------------------------------------ | ----- | ---------------------------------------------------------- |
| `webapp` (Vite)                      | 3000  | React UI, Web Serial client, MapLibre/OSM + optional Google Maps |
| `services/gps-bridge.ts`             | 8080  | Reads phone GPS via ADB, exposes `GET /gps`                |
| `services/mqtt-bridge.ts`            | 8081  | Receives node reports, broadcasts over WebSocket           |
| `services/serial-bridge.ts`          | —     | Holds COM3, translates BN line protocol ⇄ HTTP             |
| `services/meshtastic-decoder.ts`     | —     | Decrypts observed Meshtastic frames (inline + standalone)  |

An end user only needs the webapp. `npm run dev` boots all four for the dev
rig. Use `npm run dev:noserial` when you need COM3 free for `platformio
upload` or for the browser's Web Serial path. When `serial-bridge` is
running it holds COM3 exclusively, so the browser cannot also open it.

## Data flow

### Web Serial path (end-user, no bridges)

1. Browser opens CP210x port via `serialClient.ts`
2. `useRadioGpsFeed` writes `BN GPS <lat> <lon> <acc>` when a fix is available
3. Firmware emits `BN RX ...` and `BN STATUS {...}` lines
4. `radioNodeAdapter` converts `BN RX` events via `meshClient.ingestRadioRx()` and `BN STATUS` events via `meshClient.upsertNode()`
5. `useMeshNodes` subscribes to `meshClient.onNodes()` and renders markers on the map

### Bridge path (dev rig)

1. Phone GPS → `gps-bridge` → `serial-bridge` polls every 10s → `BN GPS <lat> <lon> <acc>` over USB
2. Firmware stores position and includes it in periodic `BN STATUS {...}` lines
3. `serial-bridge` forwards each `BN STATUS` / `BN RX` to `mqtt-bridge` as `POST /report`
4. `mqtt-bridge` normalises the shape (`nodeId` → `id`), merges with prior state, broadcasts `{type:"node_report", data:{...}}` over WebSocket
5. `meshClient` consumes the WebSocket plus a 5s `GET /nodes` poll, upserts nodes into its store via `meshClient.upsertNode()`
6. `useMeshNodes` subscribes to `meshClient.onNodes()` and renders markers on the map

### Meshtastic passive observation

1. Firmware in observer mode captures Meshtastic frames → `BN MTRX <rssi> <snr> <hex>`
2. `serial-bridge` calls `decodeFrame()` from `meshtastic-decoder.ts` which:
   - Parses the Meshtastic header (from, to, packetId, channelHash, flags)
   - Attempts AES-128-CTR decryption with known PSKs (default LongFast key)
   - Parses inner protobuf: POSITION → lat/lon, NODEINFO → name/hardware, TEXT_MESSAGE → plaintext
3. Enriched report posted to `mqtt-bridge` as `{type: "meshtastic_observed", meshtastic: {...}}`
4. `mqtt-bridge` maintains a separate Meshtastic node store (30-min TTL) and message log
5. Webapp receives `meshtastic_node` / `meshtastic_message` events via WebSocket
6. Meshtastic nodes appear as green markers on the map; text messages appear in the messages feed

## Hardware

- **Heltec WiFi LoRa 32 V3** — ESP32-S3 + SX1262
- LoRa pins: CS=8, DIO1=14, RST=12, BUSY=13, SCK=9, MISO=11, MOSI=10
- OLED pins: SDA=17, SCL=18, RST=21, Vext=GPIO36
- USB-C — appears as CP210x COM port (COM3 on dev rig)

WiFi is **not** used by the firmware. All host communication is USB-serial.
