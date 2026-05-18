#ifndef MESHTASTIC_OBSERVER_H
#define MESHTASTIC_OBSERVER_H

#include <Arduino.h>
#include <RadioLib.h>

// Meshtastic Observer - READ ONLY.
// Reconfigures the SX1262 to match Meshtastic's LongFast preset on EU868 so
// we can passively decode nearby packets. Never transmits on Meshtastic
// protocol — emits hex packets to USB ("BN MTRX <rssi> <snr> <hex>") for the
// host bridge to forward to MQTT / AWS IoT.

// Meshtastic EU_868 LongFast preset:
//   freq      = 869.525 MHz (primary slot for EU LongFast)
//   sf        = 11
//   bw        = 250 kHz
//   cr        = 4/5
//   syncword  = 0x2B (Meshtastic public)
//   preamble  = 16
#define MESH_FREQ_MHZ   869.525f
#define MESH_SF         11
#define MESH_BW_KHZ     250.0f
#define MESH_CR         5
#define MESH_SYNC       0x2B
#define MESH_PREAMBLE   16

class MeshtasticObserver {
private:
  static bool active;

public:
  static bool isActive() { return active; }

  // Switch the radio to Meshtastic LongFast EU. Returns true on success.
  static bool enable(SX1262& radio) {
    int s;
    if ((s = radio.setFrequency(MESH_FREQ_MHZ)) != RADIOLIB_ERR_NONE) {
      Serial.printf("BN ERR MESH freq=%d\n", s); return false;
    }
    if ((s = radio.setSpreadingFactor(MESH_SF)) != RADIOLIB_ERR_NONE) {
      Serial.printf("BN ERR MESH sf=%d\n", s); return false;
    }
    if ((s = radio.setBandwidth(MESH_BW_KHZ)) != RADIOLIB_ERR_NONE) {
      Serial.printf("BN ERR MESH bw=%d\n", s); return false;
    }
    if ((s = radio.setCodingRate(MESH_CR)) != RADIOLIB_ERR_NONE) {
      Serial.printf("BN ERR MESH cr=%d\n", s); return false;
    }
    if ((s = radio.setSyncWord(MESH_SYNC)) != RADIOLIB_ERR_NONE) {
      Serial.printf("BN ERR MESH sync=%d\n", s); return false;
    }
    if ((s = radio.setPreambleLength(MESH_PREAMBLE)) != RADIOLIB_ERR_NONE) {
      Serial.printf("BN ERR MESH preamble=%d\n", s); return false;
    }
    radio.startReceive();
    active = true;
    Serial.println("BN OK MESH ON  (SF11/BW250/CR4-5/sync0x2B @ 869.525)");
    return true;
  }

  // Restore BlackBoxMesh defaults (SF7/BW125/CR4-5/default sync @ 868.0).
  static bool disable(SX1262& radio) {
    int s;
    if ((s = radio.setFrequency(868.0f)) != RADIOLIB_ERR_NONE) {
      Serial.printf("BN ERR BN freq=%d\n", s); return false;
    }
    radio.setSpreadingFactor(7);
    radio.setBandwidth(125.0f);
    radio.setCodingRate(5);
    radio.setSyncWord(0x12);   // SX126x default private
    radio.setPreambleLength(8);
    radio.startReceive();
    active = false;
    Serial.println("BN OK MESH OFF (SF7/BW125 @ 868.0)");
    return true;
  }

  static bool isMeshtasticPacket(const uint8_t* /*data*/, size_t len) {
    // When in observer mode every successful decode is by definition a
    // Meshtastic-compatible frame (matched SF/BW/sync). Length sanity only.
    return active && len >= 4 && len <= 240;
  }

  static void forwardToMQTT(const uint8_t* /*data*/, size_t /*len*/) {
    // Emission happens inline in main.cpp's RX path so we have RSSI/SNR.
    // Kept for compatibility; intentionally a no-op.
  }
};

bool MeshtasticObserver::active = false;

#endif
