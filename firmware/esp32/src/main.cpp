// Temperature-only integration test. No actuator/control changes.
#include <Arduino.h>
#include <WiFi.h>
#include <ctype.h>
#include <math.h>
#include <string.h>

#include "api_client.h"
#include "boot_diagnostics.h"
#include "config.h"
#include "secrets_select.h"
#include "temperature_sensor.h"
#include "time_sync.h"
#include "wifi_manager.h"

namespace {
WifiManager gWifi;
TimeSync gTimeSync;
ApiClient gApi;
TemperatureSensor gTemperature;
uint32_t gLastStatusLogMs = 0;
uint32_t gLastTemperatureMs = 0;
bool gTelemetryEnabled = false;
char gMeasuredAt[TimeSync::kIso8601BufferSize] = {};

bool isUuid(const char* value) {
  if (strlen(value) != 36) return false;
  for (size_t i = 0; i < 36; ++i) {
    if (i == 8 || i == 13 || i == 18 || i == 23) {
      if (value[i] != '-') return false;
    } else if (!isxdigit(static_cast<unsigned char>(value[i]))) {
      return false;
    }
  }
  return strcmp(value, "00000000-0000-0000-0000-000000000000") != 0;
}

// Never bind a stage by discovery index: the named ROM must be present.
int selectedProbe() {
  for (uint8_t i = 0; i < gTemperature.deviceCount(); ++i) {
    char rom[TemperatureSensor::kAddressBufferSize];
    if (gTemperature.formatAddress(i, rom, sizeof(rom)) &&
        strcmp(rom, TEMPERATURE_PROBE_ROM) == 0) return i;
  }
  return -1;
}

void sampleTemperature() {
  const int probe = selectedProbe();
  float celsius = NAN;
  const bool valid = probe >= 0 &&
                     gTemperature.readCelsius(static_cast<uint8_t>(probe), celsius) &&
                     isfinite(celsius);
  if (valid) Serial.printf("[temp] selected=%.2fC\n", celsius);
  else Serial.println(F("[temp] selected probe absent/fault/unconfirmed - no numeric value"));

  // Wi-Fi/time failures never prevent local sampling. No stale replay/queue.
  if (!gTelemetryEnabled || !gWifi.isConnected() || gMeasuredAt[0] == '\0') return;

  char value[24];
  if (valid) snprintf(value, sizeof(value), "%.4f", celsius);
  else strcpy(value, "null");
  char body[256];
  const int length = snprintf(body, sizeof(body),
      "{\"measuredAt\":\"%s\",\"readings\":[{\"category\":\"temperature\","
      "\"position\":\"%s\",\"value\":%s,\"status\":\"%s\"}]}",
      gMeasuredAt, TEMPERATURE_POSITION, value, valid ? "valid" : "fault");
  if (length < 0 || static_cast<size_t>(length) >= sizeof(body)) return;

  // Synchronous, bounded test I/O only. Move off loop before adding local control.
  const auto result = gApi.postTelemetry(DEVICE_ID, body, true);
  Serial.printf("[telemetry] %s HTTP=%d (expected 201)\n",
                ApiClient::statusName(result.status), result.httpCode);
  // Authentication/registration/contract failures require operator correction.
  if (result.httpCode >= 400 && result.httpCode < 500) gTelemetryEnabled = false;
}

void logStatus() {
  char now[TimeSync::kIso8601BufferSize];
  const bool haveTime = gTimeSync.formatUtcIso8601(now, sizeof(now));
  Serial.printf("[status] uptime=%lus wifi=%s utc=%s telemetry=%s heap=%lu\n",
                static_cast<unsigned long>(millis() / 1000),
                WifiManager::stateName(gWifi.state()), haveTime ? now : "unsynced",
                gTelemetryEnabled ? "armed" : "disabled",
                static_cast<unsigned long>(ESP.getFreeHeap()));
}
}  // namespace

void setup() {
  Serial.begin(config::kSerialBaud);
  gApi.begin(API_BASE_URL, API_ROOT_CA_PEM, DEVICE_KEY);
  boot_diagnostics::print(SECRETS_ARE_PLACEHOLDERS, WIFI_SSID[0] != '\0',
                          gApi.isConfigured());
  gWifi.begin(WIFI_SSID, WIFI_PASSWORD, millis());
  gTemperature.begin(config::kTemperaturePin);
  for (uint8_t i = 0; i < gTemperature.deviceCount(); ++i) {
    char rom[TemperatureSensor::kAddressBufferSize];
    if (gTemperature.formatAddress(i, rom, sizeof(rom))) Serial.printf("[temp] rom=%s\n", rom);
  }
  const bool confirmedPosition = strcmp(TEMPERATURE_POSITION, "pre_filtration") == 0 ||
                                 strcmp(TEMPERATURE_POSITION, "post_filtration") == 0;
  gTelemetryEnabled = TEMPERATURE_TELEMETRY_ENABLED == 1 &&
      !SECRETS_ARE_PLACEHOLDERS && gApi.isConfigured() && isUuid(DEVICE_ID) &&
      DEVICE_MAC[0] != '\0' && WiFi.macAddress().equalsIgnoreCase(DEVICE_MAC) &&
      confirmedPosition && selectedProbe() >= 0 && !gTemperature.isParasitePowered();
  Serial.printf("[telemetry] %s - requires confirmed UUID/MAC/ROM/stage, key, HTTPS CA and opt-in\n",
                gTelemetryEnabled ? "armed" : "disabled");
  gLastTemperatureMs = millis();
  // Pump / UV-C / relay defaults and all critical control remain TBD; nothing driven.
}

void loop() {
  const uint32_t nowMs = millis();
  gWifi.loop(nowMs);
  gTimeSync.loop(gWifi.isConnected());
  // Timestamp the completed read, including faults; never replay an old sample.
  if (gTemperature.update()) {
    gTimeSync.formatUtcIso8601(gMeasuredAt, sizeof(gMeasuredAt));
  }
  if (nowMs - gLastTemperatureMs >= config::kTemperatureTestIntervalMs) {
    gLastTemperatureMs = nowMs;
    sampleTemperature();
  }
  if (nowMs - gLastStatusLogMs >= config::kStatusLogIntervalMs) {
    gLastStatusLogMs = nowMs;
    logStatus();
  }
}
