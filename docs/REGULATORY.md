# Regulatory & Physical Limits: Why BlackBoxMesh Chooses SF7

Mesh networks don't fail because of software — they fail because of physics
and regulation.

Every LoRa mesh must obey the same two constraints:

- **Shannon's Law** — long range requires low bandwidth
- **ETSI 1% Duty Cycle** — you legally get 36 seconds of airtime per hour

Meshtastic's LongFast profile pushes range to the limit (SF11/BW250).
The cost is airtime: a single message can occupy the channel for hundreds of
milliseconds. A handful of messages is enough to hit the 1% duty-cycle wall
and collapse the network.

BlackBoxMesh takes the opposite approach:

- SF7 / BW125
- Short packets
- Minimal metadata
- No protobuf bloat
- No periodic NodeInfo spam
- No ACK/retry storms
- No multi-hop flooding

The result is a mesh that stays inside the physics envelope and remains
usable under load.

## Why long-range meshes collapse

Long-range LoRa settings increase airtime exponentially. More airtime →
more collisions → more retries → more airtime → total collapse.

This is why Meshtastic nodes in dense areas quickly become unusable: the
radio spends more time transmitting than listening.

```
SF7  packet (50 bytes):   ~30 ms airtime
SF11 packet (50 bytes):  ~800 ms airtime

That's 26x more channel time for the same payload.
```

In a mesh with 10 nodes each beaconing every 5 minutes:

| | BlackBoxMesh (SF7) | Meshtastic (SF11) |
|---|---|---|
| Airtime per beacon | ~30 ms | ~800 ms |
| Total airtime/hour (10 nodes) | 3.6 s | 96 s |
| Duty cycle used | 0.1% | 2.7% ⚠️ |
| Headroom for actual messages | 99.9% | 97.3% |

Add ACKs, retries, NodeInfo, telemetry, and traceroute — Meshtastic's
actual duty consumption in a busy mesh can exceed 10%.

## Why BlackBoxMesh stays stable

BlackBoxMesh is designed for throughput, not maximum range.

- Shorter airtime per packet
- Higher message capacity
- Predictable hop behaviour
- No retransmission storms
- No background chatter
- Host-pushed GPS only when needed
- Fire-and-forget routing with fixed hop limit

By keeping airtime low, the mesh remains responsive even with many nodes
and frequent messages.

## The unavoidable trade-off

All LoRa systems obey the same law:

> **You can have long range OR lots of messages — not both.**

Meshtastic chooses range.
BlackBoxMesh chooses throughput and reliability.

## The maths

### Duty cycle budget (868.0 MHz, g1 sub-band)

```
Legal limit:     1% duty cycle
Per hour:        3600 s × 0.01 = 36 seconds of TX
```

### BlackBoxMesh (SF7/BW125)

```
Symbol time:     1/125000 × 2^7 = 1.024 ms
Typical packet:  16-byte header + 50-byte payload
Airtime:         ~50 ms
Messages/hour:   36000 ms ÷ 50 ms = ~720 messages
```

### Meshtastic LongFast (SF11/BW250)

```
Symbol time:     1/250000 × 2^11 = 8.192 ms
Typical packet:  16-byte header + 50-byte payload
Airtime:         ~800 ms
Messages/hour:   36000 ms ÷ 800 ms = ~45 messages
```

Add Meshtastic's mandatory overhead (NodeInfo every 15 min, position every
5 min, telemetry every 15 min, ACKs for each) and the real-world usable
message count drops further.

## Conclusion

BlackBoxMesh operates within the physics and regulatory envelope by design.
It doesn't fight the constraints — it works with them. The result is a mesh
that can sustain real conversation, not one that collapses under its own
beacon traffic.

For neighbourhood-scale networks where nodes are within 1–3 km, SF7 provides
more than enough range while delivering 10–20x the message capacity of
higher spreading factors.
