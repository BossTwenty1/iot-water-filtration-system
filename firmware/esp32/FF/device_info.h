#pragma once

//  DEVICE INFO  (main menu -> 4)
//
//  Prints identity, hardware, runtime, sensor/calibration, Wi-Fi, time and backend
//  status to the Serial Monitor, and cycles the same facts on the LCD until 0/ESC.
//  Read-only: nothing here changes any setting. The API token is never printed.
//
//  Include order in main.ino: AFTER wifi_menu.h (gWifiSource) and calibration.h,
//  BEFORE menu.h and telemetry.h.

#include <Arduino.h>
#include <WiFi.h>
#include <esp_system.h>
#include <stdarg.h>
#include <stdio.h>
#include <time.h>
#include "net_config.h"

#ifndef FW_VERSION
#define FW_VERSION "1.0.0"
#endif

#if CONFIG_IDF_TARGET_ESP32S3
  #define DEVICE_BOARD_NAME "ESP32-S3"
#else
  #define DEVICE_BOARD_NAME "ESP32 DevKit V1"
#endif

// Defined later in main.ino / telemetry.h
const char *resetReasonName(esp_reset_reason_t reason);
extern bool gNetworkStarted;
extern bool gTelemetryRunning;

// ---------------- IDENTITY ----------------

// The identifier the backend knows this device by (devices.device_identifier).
// telemetry.h uses this same function, so what you see here is what is uploaded.
void deviceIdentifier(char *out, size_t cap)
{
  uint64_t mac = ESP.getEfuseMac();
  snprintf(out, cap, "esp32-%04X%08X", (unsigned)((mac >> 32) & 0xFFFF), (unsigned)(mac & 0xFFFFFFFFu));
}

// The usual aa:bb:cc:dd:ee:ff form of the Wi-Fi MAC (what your router lists).
void deviceMacString(char *out, size_t cap)
{
  uint64_t mac = ESP.getEfuseMac();   // first MAC byte is the lowest byte
  snprintf(out, cap, "%02X:%02X:%02X:%02X:%02X:%02X",
           (unsigned)(mac & 0xFF), (unsigned)((mac >> 8) & 0xFF), (unsigned)((mac >> 16) & 0xFF),
           (unsigned)((mac >> 24) & 0xFF), (unsigned)((mac >> 32) & 0xFF), (unsigned)((mac >> 40) & 0xFF));
}

// ---------------- HELPERS ----------------

void infoSection(const char *title) { Serial.printf("\n-- %s --\n", title); }

void infoRow(const char *label, const char *fmt, ...)
{
  char value[160];
  va_list args;
  va_start(args, fmt);
  vsnprintf(value, sizeof value, fmt, args);
  va_end(args);
  Serial.printf("  %-18s %s\n", label, value);
}

void formatUptime(char *out, size_t cap, uint32_t ms)
{
  uint32_t s = ms / 1000;
  snprintf(out, cap, "%lud %02lu:%02lu:%02lu", (unsigned long)(s / 86400), (unsigned long)((s / 3600) % 24),
           (unsigned long)((s / 60) % 60), (unsigned long)(s % 60));
}

const char *signalQuality(int rssi)
{
  if (rssi >= -60) return "good";
  if (rssi >= -75) return "fair";
  return "weak";
}

const char *calText(bool sensorOK, bool calibrated)
{
  if (!sensorOK) return "sensor fault";
  return calibrated ? "calibrated" : "NOT calibrated";
}

// ---------------- SERIAL REPORT ----------------

void printDeviceInfo()
{
  char id[24], mac[20], up[24], iso[TimeSync::kIso8601BufferSize];
  deviceIdentifier(id, sizeof id);
  deviceMacString(mac, sizeof mac);
  formatUptime(up, sizeof up, millis());

  Serial.println("\n=============== DEVICE INFO ===============");

  infoSection("Identity");
  infoRow("Device ID", "%s", id);
  infoRow("MAC address", "%s", mac);
  infoRow("Firmware", "%s", FW_VERSION);
  infoRow("Built", "%s %s", __DATE__, __TIME__);

  infoSection("Hardware");
  infoRow("Board", "%s", DEVICE_BOARD_NAME);
  infoRow("Chip", "%s rev %u, %u core(s) @ %lu MHz", ESP.getChipModel(), (unsigned)ESP.getChipRevision(),
          (unsigned)ESP.getChipCores(), (unsigned long)ESP.getCpuFreqMHz());
  infoRow("Flash", "%lu KB", (unsigned long)(ESP.getFlashChipSize() / 1024));
  if (ESP.getPsramSize() > 0) infoRow("PSRAM", "%lu KB", (unsigned long)(ESP.getPsramSize() / 1024));
  else                        infoRow("PSRAM", "none");
  infoRow("SDK", "%s", ESP.getSdkVersion());
  infoRow("LCD", "%s (I2C 0x%02X)", lcd.ok ? "OK" : "not found", LCD_ADDR);

  infoSection("Runtime");
  infoRow("Uptime", "%s", up);
  infoRow("Last reset", "%s", resetReasonName(esp_reset_reason()));
  infoRow("Free heap", "%lu KB of %lu KB (lowest %lu KB)", (unsigned long)(ESP.getFreeHeap() / 1024),
          (unsigned long)(ESP.getHeapSize() / 1024), (unsigned long)(ESP.getMinFreeHeap() / 1024));

  infoSection("Sensors (power-on self test)");
  infoRow("pH", "%s, %s", phSensorOK ? "OK" : "FAULT", calText(phSensorOK, phCalibrated));
  infoRow("TDS", "%s, %s", tdsSensorOK ? "OK" : "FAULT", calText(tdsSensorOK, tdsCalibrated));
  infoRow("Turbidity", "%s, %s", turbSensorOK ? "OK" : "FAULT", calText(turbSensorOK, turbidityCalibrated));
  infoRow("Temperature", "%s, %s", tempSensorOK ? "OK" : "FAULT", calText(tempSensorOK, tempCalibrated));
  infoRow("Flow meter", "not tested (only pulses while water moves)");

  infoSection("Wi-Fi");
  const WifiManager::State st = gWifi.state();
  if (st == WifiManager::State::kDisabled)
  {
    const bool pending = !gWifiInitDone && WIFI_SSID[0] != '\0';
    infoRow("State", "%s", pending ? "off for now (starts when Run is chosen)" : "off");
  }
  else
  {
    infoRow("State", "%s", WifiManager::stateName(st));
  }
  infoRow("Network source", "%s", gWifiSource);
  if (st == WifiManager::State::kConnected)
  {
    infoRow("SSID", "%s", WiFi.SSID().c_str());
    infoRow("BSSID (router)", "%s", WiFi.BSSIDstr().c_str());
    infoRow("IP address", "%s", WiFi.localIP().toString().c_str());
    infoRow("Subnet mask", "%s", WiFi.subnetMask().toString().c_str());
    infoRow("Gateway", "%s", WiFi.gatewayIP().toString().c_str());
    infoRow("DNS", "%s", WiFi.dnsIP().toString().c_str());
    infoRow("Signal", "%d dBm (%s), channel %d", WiFi.RSSI(), signalQuality(WiFi.RSSI()), (int)WiFi.channel());
    infoRow("Hostname", "%s", WiFi.getHostname());
  }
  else if (gWifi.ssid()[0] != '\0')
  {
    infoRow("Target SSID", "%s", gWifi.ssid());
  }

  infoSection("Time");
  if (gTimeSync.formatUtcIso8601(iso, sizeof iso)) infoRow("UTC clock", "%s (synced)", iso);
  else                                             infoRow("UTC clock", "not synced yet (needs Wi-Fi + internet)");

  infoSection("Backend");
  if (!gNetworkStarted)
  {
    infoRow("API client", "not started yet (starts when Run is chosen)");
  }
  else
  {
    infoRow("API client", "%s", gApi.isConfigured() ? "configured" : "OFF (URL or root CA missing)");
  }
  infoRow("Base URL", "%s", API_BASE_URL[0] ? API_BASE_URL : "(not set)");
  infoRow("Device UUID", "%s", API_DEVICE_ID[0] ? API_DEVICE_ID : "(not set - uploads off)");
  infoRow("Device key", "%s", API_DEVICE_KEY[0] ? "set (hidden)" : "not set");
  infoRow("Telemetry", "%s", (config::kApiReadingsPathFormat[0] && API_DEVICE_ID[0])
              ? (gTelemetryRunning ? "uploading" : "ready, not running")
              : "off (API_DEVICE_ID or readings route empty)");
  infoRow("Calibration sync", "%s", config::kApiCalibrationPath[0] ? "on" : "off (kApiCalibrationPath empty)");

  Serial.println("\n===========================================");
}

// ---------------- LCD PAGES ----------------

static void infoLcdLine(uint8_t row, const char *text)
{
  char line[21];
  snprintf(line, sizeof line, "%s", text);
  lcd.setCursor(0, row);
  lcd.print(line);
}

void showDeviceInfoLcdPage(uint8_t page)
{
  char id[24], buf[48];
  lcd.clear();

  if (page == 0)
  {
    deviceIdentifier(id, sizeof id);
    infoLcdLine(0, "DEVICE INFO");
    infoLcdLine(1, id);
    snprintf(buf, sizeof buf, "FW %s", FW_VERSION);
    infoLcdLine(2, buf);
    infoLcdLine(3, DEVICE_BOARD_NAME);
  }
  else if (page == 1)
  {
    infoLcdLine(0, "CONNECTIVITY");
    snprintf(buf, sizeof buf, "WiFi: %s", WifiManager::stateName(gWifi.state()));
    infoLcdLine(1, buf);
    if (gWifi.isConnected())
    {
      infoLcdLine(2, WiFi.SSID().c_str());
      infoLcdLine(3, WiFi.localIP().toString().c_str());
    }
    else
    {
      infoLcdLine(2, gWifi.ssid()[0] ? gWifi.ssid() : "(no network set)");
      infoLcdLine(3, gTimeSync.isSynced() ? "Time: synced" : "Time: not synced");
    }
  }
  else
  {
    char up[24];
    formatUptime(up, sizeof up, millis());
    infoLcdLine(0, "SYSTEM");
    snprintf(buf, sizeof buf, "Up %s", up);
    infoLcdLine(1, buf);
    snprintf(buf, sizeof buf, "Heap %lu KB free", (unsigned long)(ESP.getFreeHeap() / 1024));
    infoLcdLine(2, buf);
    infoLcdLine(3, resetReasonName(esp_reset_reason()));
  }
}

// ---------------- SCREEN ----------------

void deviceInfoScreen()
{
  printDeviceInfo();
  Serial.println("Showing it on the LCD too. Press 0 or ESC to go back, R to print it again.");
  Serial.println(">>> DEVICE INFO READY");

  uint8_t page = 0;
  uint32_t lastPage = millis() - 3000;   // draw the first page immediately

  while (true)
  {
    if (millis() - lastPage >= 3000)
    {
      showDeviceInfoLcdPage(page);
      page = (page + 1) % 3;
      lastPage = millis();
    }

    int k = pollKey();
    if (k == '0' || k == KEY_ESC) return;
    if (k == 'r' || k == 'R') printDeviceInfo();
    delay(10);
  }
}
