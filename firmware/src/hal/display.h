#pragma once

#include <OLEDDisplay.h>
#include <SSD1306Wire.h>

namespace BlackBoxMesh {

class Display {
public:
    static void init();
    static void clear();
    static void show();
    static void drawStatus(uint32_t nodeId, uint32_t msgCount, uint32_t routes, uint32_t uptime);
    static void drawSignal(int rssi, float snr);
    static void drawMessage(const char* msg, uint32_t count);
    static void drawRoutes(uint32_t* nodeIds, uint8_t* hops, uint8_t count);
    static void drawSending(const char* text);
    static void drawBoot(const char* status);
    
    static OLEDDisplay* getDevice() { return display; }
    
private:
    static SSD1306Wire* display;
};

} // namespace BlackBoxMesh
