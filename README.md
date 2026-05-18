# BlackBoxMesh

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

Sovereign LoRa mesh network. Open firmware for the Heltec WiFi LoRa 32 V3,
a desktop bridge layer in TypeScript, and a React webapp for monitoring.
Includes passive Meshtastic observation with AES decryption of default-channel
traffic (positions, node info, text messages).

## Repo layout

```
.
├── firmware/    ESP32-S3 firmware (PlatformIO, Arduino framework, RadioLib)
├── services/    USB-serial / GPS / MQTT bridges + Meshtastic decoder (TypeScript)
├── webapp/      Vite + React UI (MapLibre + optional Google Maps)
└── docs/        Architecture, firmware, services and webapp docs
```

## Quick start

```bash
# 1. Flash the firmware (COM3 must be free)
cd firmware
python -m platformio run -t upload --upload-port COM3

# 2. Install workspace deps
cd ..
npm install
cd services && npm install && cd ..
cd webapp   && npm install && cd ..

# 3. Run everything (mqtt + gps + serial + decoder + webapp)
npm run dev

# Without serial-bridge (COM3 free for reflashing):
npm run dev:noserial

# Webapp only — no bridges, Web Serial direct connect:
npm run webapp
```

Open <http://localhost:3000>.

## Meshtastic decoder

The firmware's observer mode captures nearby Meshtastic traffic. The
`meshtastic-decoder.ts` service decrypts frames using the default LongFast
PSK (AES-128-CTR) and extracts positions, node names, and text messages.
Decoded nodes appear as green markers on the map.

```bash
# Decode a captured frame manually:
cd services
npx ts-node meshtastic-decoder.ts FFFFFFFF3C72C604A68E8B6E6308003C53BF...

# Live decode (connects to MQTT bridge WebSocket):
npm run decoder
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Firmware](docs/FIRMWARE.md)
- [Services](docs/SERVICES.md)
- [Webapp](docs/WEBAPP.md)
- [Deployment (AWS)](docs/DEPLOYMENT.md)
- [BlackBoxMesh vs Meshtastic](docs/COMPARISON.md)

## License

GPL v3. See [LICENSE](LICENSE).
