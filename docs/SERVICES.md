# Services

Four Node/TypeScript bridges run alongside the webapp. Each is a standalone
process in `services/`, executed through `ts-node`.

| Service              | File                                | Port | Holds COM3 |
| -------------------- | ----------------------------------- | ---- | ---------- |
| MQTT bridge          | `services/mqtt-bridge.ts`           | 8081 | no         |
| GPS bridge           | `services/gps-bridge.ts`            | 8080 | no         |
| Serial bridge        | `services/serial-bridge.ts`         | —    | **yes**    |
| Meshtastic decoder   | `services/meshtastic-decoder.ts`    | —    | no         |

```bash
cd services
npm install
npm run all          # mqtt + gps + serial + decoder
```

Or run them individually: `npm run mqtt`, `npm run gps`, `npm run serial`,
`npm run decoder`.

## MQTT bridge (`:8081`)

| Method | Path                    | Purpose                                                                |
| ------ | ----------------------- | ---------------------------------------------------------------------- |
| POST   | `/report`               | Receive a node report (merged with prior state, broadcast over WS)     |
| POST   | `/send`                 | Queue an outgoing message for the mesh                                 |
| GET    | `/nodes`                | Snapshot of known BlackBoxMesh nodes `[{id, latitude, ...}, ...]`      |
| GET    | `/meshtastic/nodes`     | Observed Meshtastic nodes (30-min TTL) with decoded names/positions    |
| GET    | `/meshtastic/messages`  | Decoded Meshtastic TEXT_MESSAGE log (up to 200)                        |
| GET    | `/status`               | Bridge liveness                                                        |
| WS     | `/ws`                   | Push channel (see events below)                                        |

WebSocket event types:

| `type`                 | Payload                                                              |
| ---------------------- | -------------------------------------------------------------------- |
| `node_report`          | `{id, latitude, longitude, rssi, snr, lastSeen, routes}`             |
| `meshtastic_node`      | `{id, longName, shortName, hwModel, latitude, longitude, rssi, snr}` |
| `meshtastic_message`   | `{id, from, to, text, timestamp, rssi, snr}`                         |

Reports stored internally use `nodeId` as the key but every value emitted to
the webapp goes through `toClientNode()` which renames it to `id`. This is the
contract the webapp depends on.

## GPS bridge (`:8080`)

Reads the phone GPS via `adb shell dumpsys location` and exposes the latest
fix.

```bash
adb devices               # phone must be authorised, USB debugging on
```

| Method | Path     | Returns                                                       |
| ------ | -------- | ------------------------------------------------------------- |
| GET    | `/gps`   | `{coords:{latitude,longitude,accuracy}, timestamp}`           |
| GET    | `/status`| Bridge liveness                                               |

## Serial bridge

No HTTP surface. Opens the configured COM port, parses BN line protocol from
the firmware and forwards events to the MQTT bridge:

- `BN STATUS {...}` → `POST /report`
- `BN RX ...`        → `POST /report` (as `recent_message`)
- `BN MTRX ...`      → decoded via `meshtastic-decoder.ts` → `POST /report` (as `meshtastic_observed` with enriched `meshtastic` object)

It also polls the GPS bridge every 10s and writes `BN GPS <lat> <lon> <acc>` to
the firmware.

## Meshtastic decoder

Decrypts and parses observed Meshtastic frames. Can run in two modes:

1. **Inline** — imported by `serial-bridge.ts`, called on every `BN MTRX` frame
2. **Standalone CLI** — `npm run decode <hex> [<hex> ...]` for manual analysis
3. **Live listener** — `npm run decoder` connects to the MQTT bridge WebSocket
   and prints decoded frames in real-time

### Crypto details

- AES-128-CTR for 16-byte keys (default), AES-256-CTR for 32-byte keys
- Nonce: `[packetId LE64][fromNodeId LE32][0x00000000]`
- Default LongFast PSK: `1PG7OiApB1nwvP+rz05pAQ==` (16 bytes, channel hash `0x08`)
- Legacy 1-byte PSK: `AQ==` (zero-padded to 16 bytes)
- Channel hash: XOR-fold of channel name bytes XOR key[0]

### Decoded portnums

| Portnum       | ID | Parsed fields                                    |
| ------------- | -- | ------------------------------------------------ |
| TEXT_MESSAGE  | 1  | UTF-8 text                                       |
| POSITION      | 3  | latitude, longitude, altitude, time              |
| NODEINFO      | 4  | id, longName, shortName, hwModel, role           |
| TELEMETRY     | 67 | raw payload hex (inner parsing TBD)              |

Frames that cannot be decrypted (private PSK / unknown channel) are still
forwarded with `decrypted: false` so the webapp can show them as observed
but unreadable.

Environment variables:

| Variable                          | Default                          |
| --------------------------------- | -------------------------------- |
| `BLACKBOXMESH_SERIAL_PORT`        | `COM3`                           |
| `BLACKBOXMESH_SERIAL_BAUD`        | `115200`                         |
| `BLACKBOXMESH_GPS_URL`            | `http://localhost:8080/gps`      |
| `BLACKBOXMESH_MQTT_URL`           | `http://localhost:8081`          |
| `BLACKBOXMESH_GPS_POLL_MS`        | `10000`                          |
| `BLACKBOXMESH_MQTT_HOST`          | `127.0.0.1`                      |
| `BLACKBOXMESH_MQTT_PORT`          | `8081`                           |
| `BLACKBOXMESH_MQTT_CORS_ORIGIN`   | `http://localhost:3000` (+ dev ports) |
| `BLACKBOXMESH_GPS_HOST`           | `127.0.0.1`                      |
| `BLACKBOXMESH_GPS_PORT`           | `8080`                           |
| `BLACKBOXMESH_GPS_CORS_ORIGIN`    | `http://localhost:3000` (+ dev ports) |
