#include "display.h"
#include <Arduino.h>

namespace BlackBoxMesh {

SSD1306Wire* Display::display = nullptr;

void Display::init() {
    if (!display) {
        // Heltec V3: Enable Vext power for OLED (GPIO 36, active LOW)
        pinMode(36, OUTPUT);
        digitalWrite(36, LOW);
        delay(100);
        
        // Reset OLED
        pinMode(21, OUTPUT);
        digitalWrite(21, LOW);
        delay(50);
        digitalWrite(21, HIGH);
        delay(50);
        
        display = new SSD1306Wire(0x3c, 17, 18, GEOMETRY_128_64);
        display->init();
        display->flipScreenVertically();
        display->setContrast(255);
        display->setFont(ArialMT_Plain_10);
        display->clear();
        display->display();
    }
}

void Display::clear() {
    if (display) display->clear();
}

void Display::show() {
    if (display) display->display();
}

void Display::drawStatus(uint32_t nodeId, uint32_t msgCount, uint32_t routes, uint32_t uptime) {
    clear();
    display->setFont(ArialMT_Plain_16);
    display->setTextAlignment(TEXT_ALIGN_LEFT);
    display->drawString(0, 0, "BlackBoxMesh");
    display->setFont(ArialMT_Plain_10);
    display->drawString(90, 0, "#" + String(msgCount));
    display->drawLine(0, 15, 128, 15);
    display->drawString(0, 18, "ID: 0x" + String(nodeId, HEX));
    display->drawString(0, 30, "Routes: " + String(routes));
    display->drawString(0, 42, "Uptime: " + String(uptime) + "m");
    display->drawString(0, 54, "EU868 14dBm SF7");
    show();
}

void Display::drawSignal(int rssi, float snr) {
    clear();
    display->setFont(ArialMT_Plain_16);
    display->drawString(0, 0, "Signal");
    display->setFont(ArialMT_Plain_10);
    display->drawLine(0, 15, 128, 15);
    
    if (rssi != 0) {
        display->drawString(0, 20, "RSSI: " + String(rssi) + " dBm");
        display->drawString(0, 32, "SNR: " + String(snr, 1) + " dB");
        int bars = map(rssi, -120, -30, 0, 100);
        bars = constrain(bars, 0, 100);
        display->drawProgressBar(0, 48, 120, 10, bars);
    } else {
        display->drawString(0, 30, "No signal data");
    }
    show();
}

void Display::drawMessage(const char* msg, uint32_t count) {
    clear();
    display->setFont(ArialMT_Plain_16);
    display->drawString(0, 0, "Messages");
    display->setFont(ArialMT_Plain_10);
    display->drawLine(0, 15, 128, 15);
    
    if (msg && strlen(msg) > 0) {
        display->drawString(0, 20, "Last:");
        String m(msg);
        display->drawString(0, 32, m.substring(0, 21));
        if (m.length() > 21) {
            display->drawString(0, 44, m.substring(21, 42));
        }
    } else {
        display->drawString(0, 30, "No messages yet");
    }
    display->drawString(0, 54, "Total: " + String(count));
    show();
}

void Display::drawRoutes(uint32_t* nodeIds, uint8_t* hops, uint8_t count) {
    clear();
    display->setFont(ArialMT_Plain_16);
    display->drawString(0, 0, "Routes");
    display->setFont(ArialMT_Plain_10);
    display->drawLine(0, 15, 128, 15);
    
    if (count > 0) {
        int y = 18;
        for (uint8_t i = 0; i < min(count, (uint8_t)4); i++) {
            String route = "0x" + String(nodeIds[i], HEX);
            route += " (" + String(hops[i]) + ")";
            display->drawString(0, y, route);
            y += 11;
        }
    } else {
        display->drawString(0, 30, "No routes");
    }
    show();
}

void Display::drawSending(const char* text) {
    clear();
    display->drawString(0, 0, "Sending...");
    display->drawString(0, 12, text);
    show();
}

void Display::drawBoot(const char* status) {
    clear();
    display->setFont(ArialMT_Plain_10);
    display->drawString(0, 0, "BlackBoxMesh v0.1.0");
    display->drawString(0, 12, status);
    show();
}

} // namespace BlackBoxMesh
