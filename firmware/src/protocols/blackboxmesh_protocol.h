#ifndef BLACKBOXMESH_PROTOCOL_H
#define BLACKBOXMESH_PROTOCOL_H

#include <Arduino.h>

// BlackBoxMesh Protocol v1.0
// Simple, efficient mesh protocol

#define BLACKBOXMESH_MAGIC 0xB0E1  // Protocol identifier
#define BLACKBOXMESH_VERSION 0x01

enum MessageType : uint8_t {
  MSG_BEACON = 0x01,      // Node announcement
  MSG_TEXT = 0x02,        // Text message
  MSG_POSITION = 0x03,    // GPS coordinates
  MSG_TELEMETRY = 0x04,   // Battery, signal, etc.
  MSG_ACK = 0x05,         // Acknowledgment
  MSG_ROUTE = 0x06        // Routing info
};

struct BlackBoxMeshHeader {
  uint16_t magic;         // 0xB0E1
  uint8_t version;        // Protocol version
  uint8_t type;           // MessageType
  uint32_t from;          // Source node ID
  uint32_t to;            // Destination (0xFFFFFFFF = broadcast)
  uint8_t hopCount;       // TTL/hop counter
  uint8_t flags;          // Reserved
  uint16_t payloadLen;    // Payload size
} __attribute__((packed));

struct TextMessage {
  char text[200];
} __attribute__((packed));

struct PositionMessage {
  int32_t latitude;       // * 1e7
  int32_t longitude;      // * 1e7
  int32_t altitude;       // meters
  uint8_t sats;
} __attribute__((packed));

struct TelemetryMessage {
  uint16_t batteryMv;
  int8_t rssi;
  int8_t snr;
  uint16_t uptime;        // minutes
} __attribute__((packed));

#endif
