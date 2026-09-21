// IoT Water Filtration System — ESP32-WROOM-32 firmware entry point.
//
// Current scope (foundation only): boot diagnostics, non-blocking Wi-Fi with
// auto-reconnect, NTP time sync (UTC), and an HTTPS client skeleton.
//
// Not implemented yet, by design — all TBD in docs/PENDING_DECISIONS.md:
//   - GPIO assignments (§1), sensor drivers (§1, §3), actuator control (§2),
//     thresholds (§4), calibration (§12), filtration-cycle logic (§5),
//     sampling/transmission intervals (§6), offline buffering (§7).
//
// Rule for everything added later: critical local control must keep running
// when Wi-Fi, NTP, or the backend is unavailable (AGENTS.md).

#include <Arduino.h>
#include <WiFi.h>

#include "api_client.h"
#include "boot_diagnostics.h"
#include "config.h"
#include "secrets_select.h"
#include "time_sync.h"
#include "wifi_manager.h"

namespace {

WifiManager gWifi;
TimeSync gTimeSync;
ApiClient gApi;

uint32_t gLastStatusLogMs = 0;

void logStatus() {
  char now[TimeSync::kIso8601BufferSize];
  const bool haveTime = gTimeSync.formatUtcIso8601(now, sizeof(now));

  Serial.printf("[status] uptime=%lus wifi=%s", static_cast<unsigned long>(millis() / 1000),
                WifiManager::stateName(gWifi.state()));
  if (gWifi.isConnected()) {
    Serial.printf(" ip=%s rssi=%d", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  }
  Serial.printf(" utc=%s heap=%lu\n", haveTime ? now : "unsynced",
                static_cast<unsigned long>(ESP.getFreeHeap()));
}

}  // namespace

void setup() {
  Serial.begin(config::kSerialBaud);

  const bool wifiCredentialsPresent = WIFI_SSID[0] != '\0';
  gApi.begin(API_BASE_URL, API_ROOT_CA_PEM);
  boot_diagnostics::print(SECRETS_ARE_PLACEHOLDERS, wifiCredentialsPresent,
                          gApi.isConfigured());

  gWifi.begin(WIFI_SSID, WIFI_PASSWORD, millis());

  // TODO(TBD): power-up default states for pump / UV-C / relays
  // (docs/PENDING_DECISIONS.md §2). Nothing is driven until approved.
}

void loop() {
  const uint32_t nowMs = millis();

  gWifi.loop(nowMs);
  gTimeSync.loop(gWifi.isConnected());

  // TODO(TBD): sensor sampling — sensor drivers, failure rules, and sampling
  // interval are undecided (docs/PENDING_DECISIONS.md §1, §3, §6).

  // TODO(TBD): local control and safety logic — must run here, independent of
  // Wi-Fi/backend state, and must never wait on gApi (PENDING_DECISIONS §2, §5).
  // Before adding it, move blocking network I/O (gApi) to its own FreeRTOS task.

  // TODO(TBD): telemetry transmission — payload fields (API_CONTRACT §5),
  // route, interval (PENDING_DECISIONS §6), retry/buffering (§7), and device
  // auth (§8) are undecided. gApi.postTelemetry() exists but is not called.

  if (nowMs - gLastStatusLogMs >= config::kStatusLogIntervalMs) {
    gLastStatusLogMs = nowMs;
    logStatus();
  }
}
