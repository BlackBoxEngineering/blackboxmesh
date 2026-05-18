#include <Arduino.h>
#include <RadioLib.h>
#include "hal/display.h"
#include "protocols/blackboxmesh_protocol.h"
#include "protocols/meshtastic_observer.h"
#include "core/message_handler.h"
#include "core/mesh_router.h"
#include "core/gps_handler.h"

using namespace BlackBoxMesh;

// Networking is handled by the USB host (services/serial-bridge.ts).
// The firmware only speaks LoRa + USB serial. The host pushes GPS down
// (`BN GPS <lat> <lon> <acc>`) and receives mesh events up (`BN RX ...`).

extern uint32_t nodeId;
extern SX1262 radio;

// Helper: hex-encode a byte buffer to a String
static String hexEncode(const uint8_t* data, size_t len) {
  static const char* H = "0123456789ABCDEF";
  String s;
  s.reserve(len * 2);
  for (size_t i = 0; i < len; i++) {
    s += H[(data[i] >> 4) & 0xF];
    s += H[data[i] & 0xF];
  }
  return s;
}

static int hexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

static size_t hexDecode(const String& hex, uint8_t* out, size_t maxLen) {
  size_t n = hex.length() / 2;
  if (n > maxLen) n = maxLen;
  for (size_t i = 0; i < n; i++) {
    int hi = hexNibble(hex[i*2]);
    int lo = hexNibble(hex[i*2+1]);
    if (hi < 0 || lo < 0) return 0;
    out[i] = (uint8_t)((hi << 4) | lo);
  }
  return n;
}

static size_t expectedPayloadLen(uint8_t type) {
  switch (type) {
    case MSG_BEACON: return 0;
    case MSG_TEXT: return sizeof(TextMessage);
    case MSG_POSITION: return sizeof(PositionMessage);
    case MSG_TELEMETRY: return sizeof(TelemetryMessage);
    case MSG_ACK: return 0;
    case MSG_ROUTE: return 0;
    default: return SIZE_MAX;
  }
}

static bool isValidPacket(const uint8_t* buffer, size_t len) {
  if (len < sizeof(BlackBoxMeshHeader)) return false;
  const BlackBoxMeshHeader* header = (const BlackBoxMeshHeader*)buffer;
  if (header->magic != BLACKBOXMESH_MAGIC) return false;
  if (header->version != BLACKBOXMESH_VERSION) return false;
  if (header->payloadLen > len - sizeof(BlackBoxMeshHeader)) return false;

  size_t expected = expectedPayloadLen(header->type);
  if (expected == SIZE_MAX) return false;
  if (header->payloadLen < expected) return false;
  return true;
}

static bool transmitPacket(uint32_t to, uint8_t type, const uint8_t* payload, size_t payloadLen) {
  if (payloadLen > 220) return false;

  uint8_t buffer[256];
  BlackBoxMeshHeader* header = (BlackBoxMeshHeader*)buffer;
  header->magic = BLACKBOXMESH_MAGIC;
  header->version = BLACKBOXMESH_VERSION;
  header->type = type;
  header->from = nodeId;
  header->to = to;
  header->hopCount = 3;
  header->flags = 0;
  header->payloadLen = payloadLen;

  if (payloadLen > 0 && payload != nullptr) {
    memcpy(buffer + sizeof(BlackBoxMeshHeader), payload, payloadLen);
  }

  int state = radio.transmit(buffer, sizeof(BlackBoxMeshHeader) + payloadLen);
  radio.startReceive();
  return state == RADIOLIB_ERR_NONE;
}

static bool transmitTypedHex(uint32_t to, uint8_t type, const String& hex) {
  uint8_t decoded[220];
  size_t decodedLen = hexDecode(hex, decoded, sizeof(decoded));
  if (decodedLen == 0 && type != MSG_BEACON && type != MSG_ACK && type != MSG_ROUTE) return false;

  if (type == MSG_TEXT) {
    TextMessage msg;
    memset(&msg, 0, sizeof(msg));
    size_t textLen = min(decodedLen, sizeof(msg.text) - 1);
    memcpy(msg.text, decoded, textLen);
    return transmitPacket(to, type, (const uint8_t*)&msg, sizeof(msg));
  }

  return transmitPacket(to, type, decoded, decodedLen);
}

// Heltec V3 LoRa pins
#define LORA_SCK  9
#define LORA_MISO 11
#define LORA_MOSI 10
#define LORA_CS   8
#define LORA_RST  12
#define LORA_DIO1 14
#define LORA_BUSY 13

// Heltec V3 OLED pins
#define OLED_SDA 17
#define OLED_SCL 18
#define OLED_RST 21

// Button
#define BUTTON_PIN 0

SX1262 radio = new Module(LORA_CS, LORA_DIO1, LORA_RST, LORA_BUSY);

uint32_t nodeId = 0;
volatile bool receivedFlag = false;
uint32_t messageCount = 0;
uint32_t lastRssi = 0;
float lastSnr = 0;
String lastMessage = "";
unsigned long lastActivity = 0;
uint8_t currentScreen = 0;
#define NUM_SCREENS 4

void IRAM_ATTR setFlag() {
  receivedFlag = true;
}

void updateDisplay() {
  switch(currentScreen) {
    case 0: Display::drawStatus(nodeId, messageCount, MeshRouter::routeCount, millis() / 60000); break;
    case 1: Display::drawSignal(lastRssi, lastSnr); break;
    case 2: Display::drawMessage(lastMessage.c_str(), messageCount); break;
    case 3: {
      uint32_t ids[4];
      uint8_t hops[4];
      uint8_t cnt = min(MeshRouter::routeCount, (uint8_t)4);
      for (uint8_t i = 0; i < cnt; i++) {
        ids[i] = MeshRouter::routeTable[i].nodeId;
        hops[i] = MeshRouter::routeTable[i].hopCount;
      }
      Display::drawRoutes(ids, hops, cnt);
      break;
    }
  }
  
  OLEDDisplay* disp = Display::getDevice();
  for (uint8_t i = 0; i < NUM_SCREENS; i++) {
    if (i == currentScreen) disp->fillCircle(54 + (i * 8), 62, 2);
    else disp->drawCircle(54 + (i * 8), 62, 2);
  }
  Display::show();
}

void sendTextMessage(const char* text, uint32_t to = 0xFFFFFFFF) {
  if (MeshtasticObserver::isActive()) {
    Serial.println("[TX] blocked: observer mode");
    return;
  }
  uint8_t buffer[256];
  BlackBoxMeshHeader* header = (BlackBoxMeshHeader*)buffer;
  TextMessage* msg = (TextMessage*)(buffer + sizeof(BlackBoxMeshHeader));
  
  header->magic = BLACKBOXMESH_MAGIC;
  header->version = BLACKBOXMESH_VERSION;
  header->type = MSG_TEXT;
  header->from = nodeId;
  header->to = to;
  header->hopCount = 3;
  header->flags = 0;
  header->payloadLen = sizeof(TextMessage);
  
  strncpy(msg->text, text, 199);
  msg->text[199] = '\0';
  
  size_t totalLen = sizeof(BlackBoxMeshHeader) + sizeof(TextMessage);
  
  Display::drawSending(text);
  
  int state = radio.transmit(buffer, totalLen);
  
  if (state == RADIOLIB_ERR_NONE) {
    Serial.print("[TX] ");
    Serial.println(text);
    messageCount++;
  } else {
    Serial.print("[TX FAIL] ");
    Serial.println(state);
  }
  
  radio.startReceive();
  updateDisplay();
}

void sendBeacon() {
  if (MeshtasticObserver::isActive()) return;
  BlackBoxMeshHeader header;
  header.magic = BLACKBOXMESH_MAGIC;
  header.version = BLACKBOXMESH_VERSION;
  header.type = MSG_BEACON;
  header.from = nodeId;
  header.to = 0xFFFFFFFF;
  header.hopCount = 3;
  header.flags = 0;
  header.payloadLen = 0;
  
  radio.transmit((uint8_t*)&header, sizeof(header));
  radio.startReceive();
  
  Serial.println("[Beacon] Sent");
}

void reportStatus() {
  // Emit a status line for the USB host to forward to MQTT/IoT Core.
  int32_t lat, lon, alt; uint8_t sats;
  GPSHandler::getPosition(lat, lon, alt, sats);
  bool hasPos = GPSHandler::hasPosition();

  Serial.print("BN STATUS {\"nodeId\":\"0x");
  Serial.print(nodeId, HEX);
  Serial.print("\",\"routes\":");
  Serial.print(MeshRouter::routeCount);
  Serial.print(",\"messages\":");
  Serial.print(messageCount);
  Serial.print(",\"rssi\":");
  Serial.print((int)lastRssi);
  Serial.print(",\"snr\":");
  Serial.print(lastSnr);
  if (hasPos) {
    Serial.print(",\"latitude\":");
    Serial.print(lat / 1e7, 6);
    Serial.print(",\"longitude\":");
    Serial.print(lon / 1e7, 6);
  }
  Serial.print(",\"mode\":\"");
  Serial.print(MeshtasticObserver::isActive() ? "mesh" : "blackboxmesh");
  Serial.println("\"}");
}

void relayMessage(const uint8_t* buffer, size_t len) {
  if (!MeshRouter::relayEnabled) return;

  BlackBoxMeshHeader* header = (BlackBoxMeshHeader*)buffer;
  
  if (!MeshRouter::shouldRelay(header)) return;
  
  header->hopCount--;
  
  Serial.print("[Relay] 0x");
  Serial.print(header->from, HEX);
  Serial.print(" -> 0x");
  Serial.println(header->to, HEX);
  
  radio.transmit(buffer, len);
  radio.startReceive();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n=== BlackBoxMesh Starting ===");
  
  Display::init();
  Serial.println("Display initialized");
  Display::drawBoot("Initializing...");
  
  Serial.println("=== BlackBoxMesh Firmware v0.1.0 ===");
  Serial.println("Protocol: BlackBoxMesh v1.0");
  Serial.println("Hardware: Heltec V3");
  Serial.println("Chip: ESP32-S3");
  Serial.println("Radio: SX1262");
  
  Serial.println("Getting node ID...");
  nodeId = (uint32_t)ESP.getEfuseMac();
  Serial.print("Node ID: 0x");
  Serial.println(nodeId, HEX);
  
  // Initialize LoRa
  Serial.print("Initializing radio... ");
  Display::drawBoot("Radio init...");
  
  int state = radio.begin(868.0);
  
  if (state == RADIOLIB_ERR_NONE) {
    Serial.println("SUCCESS!");
    
    radio.setSpreadingFactor(7);
    radio.setBandwidth(125.0);
    radio.setCodingRate(5);
    radio.setOutputPower(14);
    radio.setDio1Action(setFlag);
    radio.startReceive();
    
    Display::drawBoot("Radio OK!");
    delay(1000);
    
    Serial.println("BlackBoxMesh ready!");
    Serial.println("USB protocol: BN GPS <lat> <lon> <acc> | BN TX <to> <hex> | BN BCAST <text>");
    Serial.println("Interactive: /routes /beacon  or  free text = broadcast");
    
    Serial.println("Updating display...");
    updateDisplay();
    Serial.println("Display updated!");
  } else {
    Serial.print("FAILED: ");
    Serial.println(state);
    
    Display::drawBoot(("Radio FAIL! Code: " + String(state)).c_str());
    
    while (true) delay(1000);
  }
  
  GPSHandler::init();

  // Announce readiness to the USB host so the bridge can start polling GPS.
  Serial.print("BN READY 0x");
  Serial.println(nodeId, HEX);
}

void loop() {
  // Handle received packets
  if (receivedFlag) {
    receivedFlag = false;
    
    uint8_t buffer[256];
    int state = radio.readData(buffer, sizeof(buffer));
    
    if (state == RADIOLIB_ERR_NONE) {
      size_t len = radio.getPacketLength();
      lastRssi = radio.getRSSI();
      lastSnr = radio.getSNR();
      lastActivity = millis();

      // Meshtastic observer mode: dump everything as MTRX, no BlackBoxMesh parse.
      if (MeshtasticObserver::isActive()) {
        Serial.print("BN MTRX ");
        Serial.print((int)lastRssi);
        Serial.print(" ");
        Serial.print(lastSnr);
        Serial.print(" ");
        Serial.println(hexEncode(buffer, len));
        radio.startReceive();
        return; // skip BlackBoxMesh logic
      }

      // Check if BlackBoxMesh packet
      if (isValidPacket(buffer, len)) {
        BlackBoxMeshHeader* header = (BlackBoxMeshHeader*)buffer;
        if (header->from != nodeId) {
          uint8_t* payload = buffer + sizeof(BlackBoxMeshHeader);
          
          // Update routing table
          MeshRouter::addRoute(header->from, header->from, header->hopCount);
          
          Serial.print("[RX] 0x");
          Serial.print(header->from, HEX);
          Serial.print(" RSSI:");
          Serial.print(lastRssi);
          Serial.print(" SNR:");
          Serial.println(lastSnr);

          // Machine-readable line for the USB host bridge.
          Serial.print("BN RX 0x");
          Serial.print(header->from, HEX);
          Serial.print(" 0x");
          Serial.print(header->to, HEX);
          Serial.print(" ");
          Serial.print(header->type);
          Serial.print(" ");
          Serial.print(header->hopCount);
          Serial.print(" ");
          Serial.print((int)lastRssi);
          Serial.print(" ");
          Serial.print(lastSnr);
          Serial.print(" ");
          Serial.println(hexEncode(buffer, len));
          
          // Process if for us
          bool forUs = (header->to == nodeId || header->to == 0xFFFFFFFF);
          
          if (forUs) {
            switch (header->type) {
              case MSG_BEACON:
                MessageHandler::handleBeacon(header);
                break;
                
              case MSG_TEXT: {
                MessageHandler::handleText(header, payload);
                TextMessage* msg = (TextMessage*)payload;
                lastMessage = String(msg->text);
                messageCount++;
                updateDisplay();
                break;
              }
              
              case MSG_POSITION:
                MessageHandler::handlePosition(header, payload);
                break;
                
              case MSG_TELEMETRY:
                MessageHandler::handleTelemetry(header, payload);
                break;
            }
          }
          
          // Relay if needed
          if (header->to != nodeId && header->hopCount > 0) {
            relayMessage(buffer, len);
          }
        }
      }
      
      // (Meshtastic decode now handled at top of RX block when observer mode active.)
    }
    
    radio.startReceive();
  }
  
  // Handle serial input - either interactive ('/routes' or free text)
  // or machine protocol ('BN GPS ...', 'BN TX ...', 'BN BCAST ...').
  if (Serial.available()) {
    String input = Serial.readStringUntil('\n');
    input.trim();

    if (input.length() == 0) {
      // skip
    } else if (input.startsWith("BN GPS ")) {
      // BN GPS <lat> <lon> <accuracy_m>
      float lat = 0, lon = 0, acc = 0;
      int parsed = sscanf(input.c_str() + 7, "%f %f %f", &lat, &lon, &acc);
      if (parsed >= 2 && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        GPSHandler::setPosition((int32_t)(lat * 1e7), (int32_t)(lon * 1e7), 0, 4);
        Serial.print("BN OK GPS ");
        Serial.print(lat, 6);
        Serial.print(" ");
        Serial.println(lon, 6);
      } else {
        Serial.println("BN ERR GPS bad coords");
      }
    } else if (input.startsWith("BN TX ")) {
      // BN TX <to_hex> <type> <payload_hex>, or legacy BN TX <to_hex> <packet_hex>
      if (MeshtasticObserver::isActive()) {
        Serial.println("BN ERR TX observer-mode");
      } else {
        int sp = input.indexOf(' ', 6);
        if (sp > 0) {
          String toStr = input.substring(6, sp);
          String rest = input.substring(sp + 1);
          uint32_t to = strtoul(toStr.c_str(), nullptr, 0);

          int sp2 = rest.indexOf(' ');
          bool ok = false;
          size_t n = 0;

          if (sp2 > 0) {
            uint8_t type = (uint8_t)strtoul(rest.substring(0, sp2).c_str(), nullptr, 0);
            String hex = rest.substring(sp2 + 1);
            ok = transmitTypedHex(to, type, hex);
            n = hex.length() / 2;
          } else {
            uint8_t buf[256];
            n = hexDecode(rest, buf, sizeof(buf));
            if (n > 0) {
              int state = radio.transmit(buf, n);
              radio.startReceive();
              ok = state == RADIOLIB_ERR_NONE;
            }
          }

          if (ok) {
            Serial.print("BN OK TX to=0x");
            Serial.print(to, HEX);
            Serial.print(" len=");
            Serial.println(n);
          } else {
            Serial.println("BN ERR TX bad hex");
          }
        } else {
          Serial.println("BN ERR TX syntax");
        }
      }
    } else if (input.startsWith("BN BCAST ")) {
      if (MeshtasticObserver::isActive()) {
        Serial.println("BN ERR BCAST observer-mode");
      } else {
        sendTextMessage(input.c_str() + 9);
        Serial.println("BN OK BCAST");
      }
    } else if (input.startsWith("BN MESH ON") || input == "/mesh" || input == "/mesh on") {
      MeshtasticObserver::enable(radio);
    } else if (input.startsWith("BN MESH OFF") || input == "/mesh off") {
      MeshtasticObserver::disable(radio);
    } else if (input.startsWith("BN RELAY ON")) {
      MeshRouter::setRelay(true);
      Serial.println("BN OK RELAY ON");
    } else if (input.startsWith("BN RELAY OFF")) {
      MeshRouter::setRelay(false);
      Serial.println("BN OK RELAY OFF");
    } else if (input.startsWith("BN BEACON")) {
      if (MeshtasticObserver::isActive()) {
        Serial.println("BN ERR BEACON observer-mode");
      } else {
        sendBeacon();
        Serial.println("BN OK BEACON");
      }
    } else if (input.startsWith("BN STATUS?")) {
      reportStatus();
    } else if (input.startsWith("/routes")) {
      MeshRouter::printRoutes();
    } else if (input.startsWith("/beacon")) {
      sendBeacon();
    } else {
      sendTextMessage(input.c_str());
    }
  }
  
  // Button press = cycle screens
  static bool lastButton = HIGH;
  bool button = digitalRead(BUTTON_PIN);
  if (button == LOW && lastButton == HIGH) {
    currentScreen = (currentScreen + 1) % NUM_SCREENS;
    updateDisplay();
    delay(200);
  }
  lastButton = button;
  
  // Send beacon every 2 minutes
  static unsigned long lastBeacon = 0;
  if (millis() - lastBeacon > 120000) {
    sendBeacon();
    lastBeacon = millis();
  }
  

  
  // Update display every 5 seconds
  static unsigned long lastDisplayUpdate = 0;
  if (millis() - lastDisplayUpdate > 5000) {
    updateDisplay();
    lastDisplayUpdate = millis();
  }
  
  // Emit a periodic status line over USB every 60 seconds; the host bridge
  // forwards to MQTT / AWS IoT Core.
  static unsigned long lastReport = 0;
  if (millis() - lastReport > 60000) {
    reportStatus();
    lastReport = millis();
  }
  
  // Cleanup old routes every 5 minutes
  static unsigned long lastCleanup = 0;
  if (millis() - lastCleanup > 300000) {
    MeshRouter::cleanupRoutes();
    lastCleanup = millis();
  }
  
  GPSHandler::update();
  
  delay(10);
}
