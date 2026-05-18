#ifndef GPS_HANDLER_H
#define GPS_HANDLER_H

#include <Arduino.h>

// Passive GPS store. Coordinates are pushed in from the USB host bridge
// (services/serial-bridge.ts) via the `BN GPS <lat> <lon> <acc>` line
// protocol; the firmware itself does no networking.

class GPSHandler {
private:
  static bool hasGPS;
  static int32_t latitude;
  static int32_t longitude;
  static int32_t altitude;
  static uint8_t satellites;
  static unsigned long lastUpdate;

public:
  static void init() {
    hasGPS = true;
    Serial.println("[GPS] Awaiting fix from USB host (BN GPS lat lon acc)");
  }

  static void update() {
    // No-op: position is push-driven via setPosition().
  }

  static bool hasPosition() {
    return hasGPS && satellites >= 3;
  }

  static unsigned long lastUpdateMs() {
    return lastUpdate;
  }

  static void getPosition(int32_t& lat, int32_t& lon, int32_t& alt, uint8_t& sats) {
    lat = latitude;
    lon = longitude;
    alt = altitude;
    sats = satellites;
  }

  static void setPosition(int32_t lat, int32_t lon, int32_t alt, uint8_t sats) {
    latitude = lat;
    longitude = lon;
    altitude = alt;
    satellites = sats;
    lastUpdate = millis();
  }
};

bool GPSHandler::hasGPS = false;
int32_t GPSHandler::latitude = 0;
int32_t GPSHandler::longitude = 0;
int32_t GPSHandler::altitude = 0;
uint8_t GPSHandler::satellites = 0;
unsigned long GPSHandler::lastUpdate = 0;

#endif

