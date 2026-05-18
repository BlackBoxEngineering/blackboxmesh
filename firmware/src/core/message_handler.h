#ifndef MESSAGE_HANDLER_H
#define MESSAGE_HANDLER_H

#include "../protocols/blackboxmesh_protocol.h"

class MessageHandler {
public:
  static void handleBeacon(const BlackBoxMeshHeader* header) {
    Serial.print("[Beacon] Node 0x");
    Serial.print(header->from, HEX);
    Serial.println(" is alive");
  }
  
  static void handleText(const BlackBoxMeshHeader* header, const uint8_t* payload) {
    TextMessage* msg = (TextMessage*)payload;
    Serial.print("[Text] From 0x");
    Serial.print(header->from, HEX);
    Serial.print(": ");
    Serial.println(msg->text);
  }
  
  static void handlePosition(const BlackBoxMeshHeader* header, const uint8_t* payload) {
    PositionMessage* pos = (PositionMessage*)payload;
    float lat = pos->latitude / 1e7;
    float lon = pos->longitude / 1e7;
    Serial.print("[Position] Node 0x");
    Serial.print(header->from, HEX);
    Serial.print(" at ");
    Serial.print(lat, 6);
    Serial.print(", ");
    Serial.println(lon, 6);
  }
  
  static void handleTelemetry(const BlackBoxMeshHeader* header, const uint8_t* payload) {
    TelemetryMessage* telem = (TelemetryMessage*)payload;
    Serial.print("[Telemetry] Node 0x");
    Serial.print(header->from, HEX);
    Serial.print(" - Battery: ");
    Serial.print(telem->batteryMv);
    Serial.print("mV, RSSI: ");
    Serial.print(telem->rssi);
    Serial.print("dBm, SNR: ");
    Serial.print(telem->snr);
    Serial.println("dB");
  }
};

#endif
