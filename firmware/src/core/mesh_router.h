#ifndef MESH_ROUTER_H
#define MESH_ROUTER_H

#include "../protocols/blackboxmesh_protocol.h"

#define MAX_ROUTE_TABLE 32
#define ROUTE_TIMEOUT 300000  // 5 minutes

struct RouteEntry {
  uint32_t nodeId;
  uint32_t nextHop;
  uint8_t hopCount;
  unsigned long lastSeen;
};

class MeshRouter {
public:
  static RouteEntry routeTable[MAX_ROUTE_TABLE];
  static uint8_t routeCount;
  static uint32_t seenMessages[64];
  static uint8_t seenIndex;
  static bool relayEnabled;

  static void setRelay(bool enabled) {
    relayEnabled = enabled;
  }

  static void addRoute(uint32_t nodeId, uint32_t nextHop, uint8_t hops) {
    // Update existing or add new
    for (uint8_t i = 0; i < routeCount; i++) {
      if (routeTable[i].nodeId == nodeId) {
        if (hops < routeTable[i].hopCount) {
          routeTable[i].nextHop = nextHop;
          routeTable[i].hopCount = hops;
        }
        routeTable[i].lastSeen = millis();
        return;
      }
    }
    
    // Add new route
    if (routeCount < MAX_ROUTE_TABLE) {
      routeTable[routeCount].nodeId = nodeId;
      routeTable[routeCount].nextHop = nextHop;
      routeTable[routeCount].hopCount = hops;
      routeTable[routeCount].lastSeen = millis();
      routeCount++;
    }
  }
  
  static bool shouldRelay(const BlackBoxMeshHeader* header) {
    // Don't relay if hop count exhausted
    if (header->hopCount == 0) return false;
    
    // Check if we've seen this message (simple dedup)
    uint32_t msgId = header->from ^ header->to ^ (header->type << 24);
    for (uint8_t i = 0; i < 64; i++) {
      if (seenMessages[i] == msgId) return false;
    }
    
    // Mark as seen
    seenMessages[seenIndex] = msgId;
    seenIndex = (seenIndex + 1) % 64;
    
    return true;
  }
  
  static void cleanupRoutes() {
    unsigned long now = millis();
    for (uint8_t i = 0; i < routeCount; i++) {
      if (now - routeTable[i].lastSeen > ROUTE_TIMEOUT) {
        // Remove expired route
        for (uint8_t j = i; j < routeCount - 1; j++) {
          routeTable[j] = routeTable[j + 1];
        }
        routeCount--;
        i--;
      }
    }
  }
  
  static void printRoutes() {
    Serial.println("[Router] Route table:");
    for (uint8_t i = 0; i < routeCount; i++) {
      Serial.print("  0x");
      Serial.print(routeTable[i].nodeId, HEX);
      Serial.print(" via 0x");
      Serial.print(routeTable[i].nextHop, HEX);
      Serial.print(" (");
      Serial.print(routeTable[i].hopCount);
      Serial.println(" hops)");
    }
  }
};

RouteEntry MeshRouter::routeTable[MAX_ROUTE_TABLE];
uint8_t MeshRouter::routeCount = 0;
uint32_t MeshRouter::seenMessages[64] = {0};
uint8_t MeshRouter::seenIndex = 0;
bool MeshRouter::relayEnabled = true;

#endif
