# BlackBoxMesh vs Meshtastic

A technical comparison of the two LoRa mesh protocols.

## At a Glance

| | BlackBoxMesh | Meshtastic |
|---|---|---|
| Hardware | Heltec WiFi LoRa 32 V3 | Many (T-Beam, Heltec, RAK, T-Echo, etc.) |
| Firmware | Custom (PlatformIO/Arduino) | Meshtastic (open source, large community) |
| Radio | SX1262, 868 MHz ISM | SX1262/SX1276, 868/915 MHz ISM |
| Protocol | Custom binary, 16-byte header | Protobuf over AES-CTR encrypted frames |
| Encryption | Optional per-message (AES-256-GCM via host) | Always-on AES-128-CTR (default key is public) |
| Host link | USB serial only (no WiFi) | BLE, WiFi, USB serial |
| App | React webapp (browser) | Native Android/iOS + web client |
| Community | You and Simon (soon) | Thousands globally |

## Radio Parameters

| Parameter | BlackBoxMesh | Meshtastic LongFast |
|-----------|-------------|---------------------|
| Frequency | 868.0 MHz (g1) | 869.525 MHz (g3) |
| Spreading Factor | 7 | 11 |
| Bandwidth | 125 kHz | 250 kHz |
| Coding Rate | 4/5 | 4/5 |
| Sync Word | 0x12 | 0x2B |
| Preamble | 8 symbols | 16 symbols |
| Max TX Power | 14 dBm (25 mW) | 27 dBm (500 mW) |
| Duty Cycle Limit | 1% (g1) | 10% (g3) |

## Airtime & Capacity

| Metric | BlackBoxMesh | Meshtastic LongFast |
|--------|-------------|---------------------|
| Airtime per packet (typical) | ~50–100 ms | ~1–2 s |
| Max messages/hour (duty limit) | ~360–720 | ~18–36 |
| Effective data rate | ~5.5 kbps | ~0.5 kbps |
| Max payload | 220 bytes | 237 bytes |
| Time on air (200-byte payload) | ~150 ms | ~2.5 s |

BlackBoxMesh can send **10–20x more messages per hour** within legal duty
cycle limits. The tradeoff is range.

## Range

| Scenario | BlackBoxMesh (SF7) | Meshtastic (SF11) |
|----------|-------------------|-------------------|
| Urban (buildings, streets) | 1–3 km | 3–8 km |
| Suburban (mixed) | 3–5 km | 5–15 km |
| Line of sight (hilltop) | 5–10 km | 10–30+ km |
| Link budget advantage | — | +12 dB |

SF11 has ~12 dB more sensitivity than SF7, which roughly doubles to triples
the range. For neighbourhood use (< 2 km), SF7 is more than adequate and
gives far better throughput.

## Security

| Aspect | BlackBoxMesh | Meshtastic |
|--------|-------------|------------|
| On-air encryption | None by default | AES-128-CTR (always on) |
| Default key | N/A (plaintext) | Public (`1PG7OiApB1nwvP+rz05pAQ==`) |
| Effective security (default) | **None** | **None** (key is well-known) |
| Private channels | Per-message AES-256-GCM (host-side) | Custom PSK per channel |
| Key exchange | Out-of-band (shared password) | Out-of-band (QR code / manual) |
| Metadata visible | Header (from, to, type) always visible | Header always visible |
| Observer resistance | Different frequency/sync word | Anyone with default key can read |

**Neither is secure by default.** Both require explicit configuration for
private communication. BlackBoxMesh's advantage is that it operates on
different radio parameters, so Meshtastic users won't accidentally see your
traffic (and vice versa) — security through separation rather than encryption.

## Protocol Design

### BlackBoxMesh

```
[Magic 0xB0E1][Ver][Type][From u32][To u32][Hops][Flags][PayloadLen][Payload]
```

- Simple fixed header, easy to parse on microcontroller
- Message types: BEACON, TEXT, POSITION, TELEMETRY, ACK, ROUTE
- No fragmentation (220-byte max)
- Fire-and-forget (no ACK/retry by default)
- Hop limit: 3

### Meshtastic

```
[To u32][From u32][PacketID u32][Flags][ChannelHash][Reserved][AES-CTR encrypted protobuf]
```

- Protobuf-encoded payload (flexible but heavier)
- 70+ port numbers (position, text, telemetry, admin, traceroute, etc.)
- Reliable delivery with ACK/retry
- Hop limit: configurable (default 3)
- Store-and-forward capability
- Fragmentation support

## Mesh Routing

| Feature | BlackBoxMesh | Meshtastic |
|---------|-------------|------------|
| Routing | Simple flood + route table | Managed flood + next-hop |
| Relay | All nodes relay by default | Configurable per node role |
| Duplicate detection | Packet ID + from | Packet ID + from |
| Route discovery | Passive (learn from traffic) | Passive + traceroute |
| Node roles | Single role | Router, Client, Router_Client, Repeater |

## Ecosystem

| Feature | BlackBoxMesh | Meshtastic |
|---------|-------------|------------|
| Mobile app | Webapp (any browser) | Native Android + iOS |
| Desktop | Webapp + Web Serial | Python CLI + web client |
| Map | MapLibre / Google Maps | Built-in map in app |
| MQTT | Local bridge | Built-in MQTT gateway |
| Community | Small / private | Large global community |
| Firmware updates | Manual (PlatformIO) | OTA via BLE/WiFi |
| Device support | Heltec V3 only | 20+ boards |
| GPS | Host-provided (phone/browser) | On-board (T-Beam) or phone |

## When to Use Which

**BlackBoxMesh is better when:**
- You want high message throughput (chat-heavy use)
- Your nodes are close together (neighbourhood, event, building)
- You want full control over the protocol
- You don't want/need a phone app
- You want to avoid the "default key = no security" problem by being on a different frequency entirely
- You're building something custom on top

**Meshtastic is better when:**
- You need maximum range (rural, mountain, cross-city)
- You want a polished mobile app experience
- You need a large existing community to talk to
- You want plug-and-play with many hardware options
- You need store-and-forward for offline nodes
- You want BLE connectivity from phone without USB

## Coexistence

The two protocols **do not interfere** with each other in normal operation:
- Different frequencies (868.0 vs 869.525 MHz)
- Different sync words (0x12 vs 0x2B)
- Different spreading factors (SF7 vs SF11)

BlackBoxMesh can passively **observe** Meshtastic traffic by switching to
their radio parameters (observer mode). This is receive-only — no
transmission on the Meshtastic channel.

## Summary

Meshtastic optimises for **range and ecosystem** — it's the established
choice with a big community, phone apps, and long-distance links.

BlackBoxMesh optimises for **throughput and sovereignty** — more messages,
faster delivery, full protocol control, and no dependency on a public
default key that everyone knows.

They're complementary. Run both.