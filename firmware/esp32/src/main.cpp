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
#include "ph_sensor.h"
#include "secrets_select.h"
#include "time_sync.h"
#include "wifi_manager.h"

namespace {

WifiManager gWifi;
TimeSync gTimeSync;
ApiClient gApi;
PhSensor gPhPre;
PhSensor gPhPost;

uint32_t gLastStatusLogMs = 0;

// Appends "<label>=<mv>mV/<counts>" plus pH only when the probe is calibrated.
// Prints nothing while the pin is unassigned (pin map TBD), so the status line
// stays quiet rather than implying a sensor that is not wired.
void logPh(const char* label, const PhSensor& sensor) {
  if (!sensor.isEnabled()) return;
  PhSensor::Reading reading;
  if (!sensor.read(reading)) return;
  Serial.printf(" %s=%lumV/%u", label, static_cast<unsigned long>(reading.milliVolts),
                static_cast<unsigned>(reading.rawCounts));
  if (reading.phValid) {
    Serial.printf("/pH%.2f", reading.ph);
  } else {
    Serial.print("/pH?");  // Uncalibrated — see PhSensor docs.
  }
}

void logStatus() {
  char now[TimeSync::kIso8601BufferSize];
  const bool haveTime = gTimeSync.formatUtcIso8601(now, sizeof(now));

  Serial.printf("[status] uptime=%lus wifi=%s", static_cast<unsigned long>(millis() / 1000),
                WifiManager::stateName(gWifi.state()));
  if (gWifi.isConnected()) {
    Serial.printf(" ip=%s rssi=%d", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  }
  Serial.printf(" utc=%s heap=%lu", haveTime ? now : "unsynced",
                static_cast<unsigned long>(ESP.getFreeHeap()));
  logPh("ph_pre", gPhPre);
  logPh("ph_post", gPhPost);
  Serial.println();
}

// Boot self-check for the only non-trivial logic here: the two-point fit.
// Runs on the real target (no host toolchain in this project) and prints one
// line, so a broken fit is visible at boot instead of surfacing as a quietly
// wrong pH during calibration.
void phSelfCheck() {
  // Representative buffer pair: pH 6.86 and 4.01 at two measured voltages.
  const PhSensor::Calibration fit = PhSensor::fitTwoPoint(1500, 6.86f, 1800, 4.01f);
  const float back6 = PhSensor::applyCalibration(fit, 1500);
  const float back4 = PhSensor::applyCalibration(fit, 1800);
  const bool recovers = fit.calibrated && fabsf(back6 - 6.86f) < 0.01f && fabsf(back4 - 4.01f) < 0.01f;
  // Two points at the same voltage define no slope and must be rejected.
  const bool rejectsDegenerate = !PhSensor::fitTwoPoint(1500, 6.86f, 1500, 4.01f).calibrated;

  Serial.printf("[ph] self-check %s (recover=%s degenerate-rejected=%s)\n",
                (recovers && rejectsDegenerate) ? "PASS" : "FAIL", recovers ? "ok" : "BAD",
                rejectsDegenerate ? "ok" : "BAD");
}

// Bring-up aid for an unknown wiring harness: surveys every ADC1 GPIO and
// reports mean millivolts plus sample spread. A pin carrying a powered sensor
// output reads mid-range and steady (small spread); a pin with nothing on it
// floats and jitters (large spread) or sits pinned near a rail. That is
// evidence for which pin a board is wired to, not proof — confirm against the
// physical harness before writing it into config::kPhPin*.
//
// Prints only while no pH pin is assigned, so it self-silences once the pin map
// (docs/PENDING_DECISIONS.md §1) is settled.
void surveyAdc1() {
  // ADC1 channels. GPIO 37/38 are not bonded out on most ESP32-WROOM-32
  // modules; they are surveyed anyway and simply read as unconnected there.
  static const int kAdc1Pins[] = {32, 33, 34, 35, 36, 37, 38, 39};
  constexpr uint8_t kSamples = 32;

  // ADC2 is surveyed too, because a harness built on a breadboard often lands
  // on these pins. They are readable here only because Wi-Fi is down; ADC2 is
  // unavailable whenever the Wi-Fi radio is active, so anything found here must
  // be rewired onto ADC1 before telemetry can work (P5-09).
  static const int kAdc2Pins[] = {4, 12, 13, 14, 15, 25, 26, 27};

  Serial.println(F("[adc1] survey - mean mV / raw / spread (steady mid-range => likely wired)"));
  for (const int pin : kAdc1Pins) {
    analogSetPinAttenuation(pin, ADC_11db);
    uint32_t total = 0;
    uint32_t rawTotal = 0;
    uint32_t minMv = UINT32_MAX;
    uint32_t maxMv = 0;
    for (uint8_t i = 0; i < kSamples; ++i) {
      const uint32_t mv = analogReadMilliVolts(pin);
      total += mv;
      rawTotal += static_cast<uint32_t>(analogRead(pin));
      if (mv < minMv) minMv = mv;
      if (mv > maxMv) maxMv = mv;
      delay(2);
    }
    const uint32_t mean = total / kSamples;
    Serial.printf("[adc1]   GPIO%-2d  %4lu mV  raw %4lu  spread %4lu mV%s\n", pin,
                  static_cast<unsigned long>(mean),
                  static_cast<unsigned long>(rawTotal / kSamples),
                  static_cast<unsigned long>(maxMv - minMv),
                  (pin == 37 || pin == 38) ? "  (usually not bonded out)" : "");
  }

  Serial.println(F("[adc2] survey - readable only while Wi-Fi is off; anything here must move to ADC1"));
  for (const int pin : kAdc2Pins) {
    analogSetPinAttenuation(pin, ADC_11db);
    uint32_t total = 0;
    uint32_t rawTotal = 0;
    uint32_t minMv = UINT32_MAX;
    uint32_t maxMv = 0;
    for (uint8_t i = 0; i < kSamples; ++i) {
      const uint32_t mv = analogReadMilliVolts(pin);
      total += mv;
      rawTotal += static_cast<uint32_t>(analogRead(pin));
      if (mv < minMv) minMv = mv;
      if (mv > maxMv) maxMv = mv;
      delay(2);
    }
    Serial.printf("[adc2]   GPIO%-2d  %4lu mV  raw %4lu  spread %4lu mV\n", pin,
                  static_cast<unsigned long>(total / kSamples),
                  static_cast<unsigned long>(rawTotal / kSamples),
                  static_cast<unsigned long>(maxMv - minMv));
  }
}

}  // namespace

void setup() {
  Serial.begin(config::kSerialBaud);

  const bool wifiCredentialsPresent = WIFI_SSID[0] != '\0';
  gApi.begin(API_BASE_URL, API_ROOT_CA_PEM);
  boot_diagnostics::print(SECRETS_ARE_PLACEHOLDERS, wifiCredentialsPresent,
                          gApi.isConfigured());

  gWifi.begin(WIFI_SSID, WIFI_PASSWORD, millis());

  // Both default to -1 (unassigned) while the pin map is TBD, which leaves
  // them disabled. Assign config::kPhPin* once the hardware team confirms
  // which ADC1 GPIOs the boards land on.
  gPhPre.begin(config::kPhPinPreFiltration);
  gPhPost.begin(config::kPhPinPostFiltration);
  phSelfCheck();
  if (!gPhPre.isEnabled() && !gPhPost.isEnabled()) {
    Serial.println(F("[ph] no pin assigned - pH sampling disabled (PENDING_DECISIONS sec. 1)"));
  }
  // Bring-up aid: survey every boot while the harness is unverified. Remove
  // this call once the pin map is confirmed and the sensors read sane values.
  surveyAdc1();

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
