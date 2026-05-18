# Firmware

ESP32-S3 firmware for the Heltec WiFi LoRa 32 V3.

## Source layout

```
firmware/
├── platformio.ini
└── src/
    ├── main.cpp                         # entry, line protocol, scheduler
    ├── hal/
    │   ├── display.h / display.cpp      # SSD1306 OLED
    ├── core/
    │   ├── gps_handler.h                # passive position store
    │   ├── mesh_router.h                # route table + relay
    │   └── message_handler.h            # per-type handlers
    └── protocols/
        ├── blackboxmesh_protocol.h           # packet structs + magic
        └── meshtastic_observer.h        # observer mode radio reconfig
```

## Toolchain

```bash
pip install platformio              # one-time
cd firmware
python -m platformio run            # build only
python -m platformio run -t upload --upload-port COM3
python -m platformio device monitor # 115200 baud
```

PlatformIO is invoked through Python because it isn't on PATH in this environment.

## Radio defaults (BlackBoxMesh native)

| Parameter        | Value      |
| ---------------- | ---------- |
| Frequency        | 868.0 MHz  |
| Spreading Factor | 7          |
| Bandwidth        | 125 kHz    |
| Coding Rate      | 4/5        |
| Output power     | 14 dBm     |
| Sync word        | 0x12       |
| Preamble         | 8 symbols  |

When `BN MESH ON` is issued the radio is reconfigured to Meshtastic LongFast EU868
(SF11 / BW250 / CR4-5 / sync 0x2B / freq 869.525 MHz / preamble 16) for read-only
observation only. `BN MESH OFF` restores the BlackBoxMesh defaults.

## USB line protocol

All host ↔ firmware communication is plain ASCII over the USB serial port at
115200 baud. Lines are `\n` terminated. Binary payloads are lower-case hex.

### Host → firmware

| Command                            | Description                                       |
| ---------------------------------- | ------------------------------------------------- |
| `BN GPS <lat> <lon> <acc>`         | Push a GPS fix (decimal degrees, metres)          |
| `BN TX <to> <type> <hexpayload>`   | Send a unicast packet                             |
| `BN BCAST <text>`                  | Broadcast a plain-text message                    |
| `BN BEACON`                        | Send a beacon now                                 |
| `BN STATUS?`                       | Request an immediate status line                  |
| `BN MESH ON` / `BN MESH OFF`       | Toggle Meshtastic observer mode                   |
| `BN RELAY ON` / `BN RELAY OFF`     | Enable / disable packet relay (default: on)       |

The firmware also accepts the human-friendly aliases `/mesh`, `/routes`,
`/beacon` for interactive serial use.

### Firmware → host

| Line                                                                  | Description                              |
| --------------------------------------------------------------------- | ---------------------------------------- |
| `BN READY 0x<id>`                                                     | Boot complete, reports node id           |
| `BN RX <from> <to> <type> <hops> <rssi> <snr> <hex>`                  | Decoded BlackBoxMesh packet                   |
| `BN MTRX <rssi> <snr> <hex>`                                          | Observed Meshtastic packet (raw)         |
| `BN STATUS {"nodeId":...,"routes":...,"latitude":...,"mode":"..."}`   | Emitted every 60s and on demand          |

Status JSON keys:

- `nodeId` — 32-bit ESP32 MAC-derived id (hex string)
- `routes` — current routing table size
- `messages` — total messages handled since boot
- `rssi`, `snr` — last RX signal stats
- `latitude`, `longitude` — last applied GPS fix (omitted if no fix)
- `mode` — `"blackboxmesh"` or `"mesh"`

## BlackBoxMesh packet (on-air)

```
[Header: 16 bytes][Payload: 0..240 bytes]
```

Header (little-endian):

```c
uint16_t magic;         // 0xB0E1
uint8_t  version;       // 0x01
uint8_t  type;          // see message types
uint32_t from;          // source node id
uint32_t to;            // destination, 0xFFFFFFFF = broadcast
uint8_t  hopCount;      // remaining TTL
uint8_t  flags;         // reserved
uint16_t payloadLen;    // bytes
```

| Type      | Value | Payload                         |
| --------- | ----- | ------------------------------- |
| BEACON    | 0x01  | none                            |
| TEXT      | 0x02  | UTF-8, up to 200 bytes          |
| POSITION  | 0x03  | `int32 lat,lon,alt; uint8 sats` |
| TELEMETRY | 0x04  | `u16 mv; i8 rssi; i8 snr; u16 uptime` |
| ACK       | 0x05  | none                            |
| ROUTE     | 0x06  | route announcement              |

Node id is derived from the ESP32 efuse MAC:
`uint32_t nodeId = (uint32_t) ESP.getEfuseMac();`

## Display

Four screens cycled with the GPIO0 button:

1. **Status** — node id, route count, uptime, band/SF/power
2. **Signal** — RSSI, SNR, signal bar
3. **Messages** — last received text, total count
4. **Routes** — up to four known route entries

## Meshtastic observer mode

`meshtastic_observer.h` flips the SX1262 to LongFast EU868 parameters and the
RX path emits `BN MTRX <rssi> <snr> <hex>` for every captured frame. The
firmware never transmits while in observer mode.

The `serial-bridge` decodes these frames in real-time using
`meshtastic-decoder.ts` (AES-128-CTR with the default LongFast PSK). Decoded
position, node info, and text messages are forwarded to the MQTT bridge and
appear in the webapp:

- **Map** — Meshtastic nodes shown as green markers with long name, hardware model, and altitude
- **Messages** — Decoded TEXT_MESSAGE packets displayed in the Network view message feed
- **Node list** — Meshtastic nodes tracked separately with 30-minute TTL (they beacon every 6–15 min)

Nodes using a private/custom PSK will appear as "observed but unreadable" —
the header (from, to, RSSI, SNR) is still visible but the payload cannot be
decrypted.

## Build footprint

Approximate after the USB-only refactor:

- RAM:   ~6.4 %
- Flash: ~11.3 %

## Known limitations

- No ACK / retry — fire-and-forget
- Hop limit fixed at 3
- 220-byte payload max (no fragmentation)
- GPS sourced from host; no on-board GNSS on the Heltec V3
