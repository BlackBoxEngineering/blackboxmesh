# Deployment (AWS)

Guide for deploying BlackBoxMesh as a public-facing webapp backed by AWS.

## Overview

The local bridge stack relays mesh data to AWS. Visitors see a live map with
node positions, Meshtastic observations, and decoded messages — no hardware
required on their end.

```
+---------------------+        USB         +---------------------+
|  Heltec WiFi LoRa   | <================> |  serial-bridge.ts   |
|  32 V3 (firmware)   |  BN line protocol  |  (your PC)          |
+---------------------+                    +----------+----------+
                                                      |
                                                      | HTTP POST
                                                      v
                                           +---------------------+
                                           |  API Gateway (HTTP) |
                                           |  /report endpoint   |
                                           +----------+----------+
                                                      |
                                                      v
                                           +---------------------+
                                           |  Lambda (ingest)    |
                                           |  • store in DynamoDB|
                                           |  • push via WS API  |
                                           +----------+----------+
                                                      |
                                        +-------------+-------------+
                                        |                           |
                                        v                           v
                             +------------------+        +---------------------+
                             |  DynamoDB        |        |  API Gateway (WS)   |
                             |  • nodes table   |        |  wss://...          |
                             |  • messages table|        +----------+----------+
                             +------------------+                   |
                                                                    v
                                                         +---------------------+
                                                         |  S3 + CloudFront    |
                                                         |  (webapp)           |
                                                         |  https://mesh.xyz   |
                                                         +---------------------+
                                                                    |
                                                                    v
                                                            Any browser
                                                         (phone, desktop)
```

## AWS Services

| Service | Purpose | Estimated cost |
|---------|---------|----------------|
| S3 + CloudFront | Static webapp hosting + CDN | ~$1/mo |
| API Gateway (HTTP) | Ingest endpoint for bridge | ~$1/mo |
| API Gateway (WebSocket) | Real-time push to browsers | ~$1/mo |
| Lambda | Ingest handler + WS broadcast | Free tier covers it |
| DynamoDB | Node state + message log | Free tier (25GB) |
| Route 53 (optional) | Custom domain | $0.50/mo per zone |
| ACM | TLS cert for CloudFront | Free |

Total: **~$3–5/month** at low traffic.

## DynamoDB Tables

### `blackboxmesh-nodes`

| Key | Type | Description |
|-----|------|-------------|
| `id` (PK) | String | Node ID, e.g. `0x9E9D6244` |
| `type` | String | `blackboxmesh` or `meshtastic` |
| `longName` | String | Meshtastic long name |
| `shortName` | String | Meshtastic short name |
| `hwModel` | String | Hardware model |
| `latitude` | Number | Last known latitude |
| `longitude` | Number | Last known longitude |
| `altitude` | Number | Altitude in metres |
| `rssi` | Number | Last RSSI |
| `snr` | Number | Last SNR |
| `lastSeen` | Number | Unix timestamp (ms) |
| `ttl` | Number | DynamoDB TTL — auto-expire stale nodes |

### `blackboxmesh-messages`

| Key | Type | Description |
|-----|------|-------------|
| `id` (PK) | String | Packet ID |
| `timestamp` (SK) | Number | Unix timestamp (ms) |
| `from` | String | Sender node ID |
| `to` | String | Destination (`broadcast` or node ID) |
| `text` | String | Decoded message text |
| `rssi` | Number | RSSI at capture |
| `snr` | Number | SNR at capture |
| `ttl` | Number | DynamoDB TTL — auto-expire old messages (7 days) |

## API Endpoints

### HTTP API (ingest — called by your bridge)

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/report` | API key header | Same shape as local mqtt-bridge `/report` |
| GET | `/nodes` | None | Returns active nodes |
| GET | `/meshtastic/nodes` | None | Returns Meshtastic nodes |
| GET | `/meshtastic/messages` | None | Returns message log |

### WebSocket API (real-time — browsers connect here)

| Route | Direction | Payload |
|-------|-----------|---------|
| `$connect` | Client → Server | Connection established |
| `$disconnect` | Client → Server | Connection closed |
| `node_report` | Server → Client | `{type, data: {id, lat, lon, ...}}` |
| `meshtastic_node` | Server → Client | `{type, data: {id, longName, ...}}` |
| `meshtastic_message` | Server → Client | `{type, data: {from, text, ...}}` |

## Lambda Functions

### `ingest`

Triggered by HTTP POST `/report`. Responsibilities:
1. Validate and parse the report payload
2. Write/update DynamoDB (nodes or messages table)
3. Broadcast to all connected WebSocket clients via API Gateway Management API

### `wsConnect` / `wsDisconnect`

Manage a connections table (or in-memory via Lambda global) to track
active WebSocket connection IDs for broadcast.

### `getNodes` / `getMessages`

Simple DynamoDB scans with TTL filter. Served via HTTP GET endpoints.

## Webapp Changes

Minimal changes required:

1. Set `VITE_MQTT_BRIDGE_URL` to the HTTP API Gateway URL
2. The WebSocket URL derives from it (same as current logic)
3. No code changes — the webapp already talks REST + WS

```env
# webapp/.env.production
VITE_MQTT_BRIDGE_URL=https://abc123.execute-api.eu-west-2.amazonaws.com
```

## Bridge Changes

The local `mqtt-bridge.ts` gains an upstream relay. When a report comes in,
it both stores locally AND forwards to the cloud:

```ts
// In mqtt-bridge.ts POST /report handler:
if (UPSTREAM_URL) {
  fetch(`${UPSTREAM_URL}/report`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': UPSTREAM_API_KEY,
    },
    body: JSON.stringify(data),
  }).catch(() => { /* offline — local still works */ });
}
```

Environment variables:
- `BLACKBOXMESH_UPSTREAM_URL` — API Gateway HTTP endpoint
- `BLACKBOXMESH_UPSTREAM_API_KEY` — API key for auth

## Deployment Steps

1. **Webapp** — build and deploy to S3:
   ```bash
   cd webapp
   npm run build
   aws s3 sync dist/ s3://blackboxmesh-webapp --delete
   aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"
   ```

2. **Infrastructure** — deploy via CDK or Terraform:
   - DynamoDB tables
   - Lambda functions
   - API Gateway (HTTP + WebSocket)
   - S3 bucket + CloudFront distribution
   - Route 53 record (optional)

3. **Bridge relay** — set env vars and restart:
   ```bash
   export BLACKBOXMESH_UPSTREAM_URL=https://abc123.execute-api.eu-west-2.amazonaws.com
   export BLACKBOXMESH_UPSTREAM_API_KEY=your-api-key
   npm run dev
   ```

## Security Considerations

- **Ingest endpoint** — protected by API key (only your bridge can POST)
- **Read endpoints** — public (anyone can view the map)
- **WebSocket** — public (read-only push)
- **No PII** — node IDs are hardware-derived hashes, not personal
- **DynamoDB TTL** — stale data auto-expires (nodes: 30 min, messages: 7 days)
- **Rate limiting** — API Gateway throttling prevents abuse
- **CORS** — CloudFront serves the webapp, API Gateway allows the CloudFront origin

## Future Enhancements

- **Cognito auth** — require login to view, or tiered access (public map, private messages)
- **IoT Core** — replace HTTP POST with MQTT for lower latency + offline queuing
- **Multi-node** — multiple people run bridges, all feed the same cloud backend
- **Historical playback** — store time-series in DynamoDB, replay node movements
- **Alerts** — Lambda triggers SNS/SES when specific nodes appear or messages match patterns
