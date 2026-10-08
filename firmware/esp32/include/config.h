#pragma once

// Non-secret firmware configuration.
//
// Two kinds of values live here:
//   1. Values taken from project documentation (cited inline).
//   2. Provisional engineering defaults for connectivity plumbing. These are
//      NOT project decisions — they only keep Wi-Fi/NTP/HTTP from blocking or
//      spinning. Tune them during integration testing.
//
// Project-level timing, thresholds, calibration, and GPIO assignments are TBD
// (docs/PENDING_DECISIONS.md) and intentionally have no value here.
// Search for "TODO(TBD)" to find every open item in the firmware.

#include <stddef.h>
#include <stdint.h>

namespace config {

constexpr char kFirmwareName[] = "iot-water-filtration-esp32";
constexpr char kFirmwareVersion[] = "0.1.0-dev";

constexpr uint32_t kSerialBaud = 115200;  // Must match monitor_speed in platformio.ini.

// --- Wi-Fi -------------------------------------------------------------------
// Provisional default — tune during integration testing.
constexpr uint32_t kWifiConnectTimeoutMs = 15000;
// Provisional default — tune during integration testing.
constexpr uint32_t kWifiRetryBackoffInitialMs = 2000;
// Provisional default — tune during integration testing.
constexpr uint32_t kWifiRetryBackoffMaxMs = 60000;

// --- Time (NTP) --------------------------------------------------------------
// The API contract requires UTC ISO-8601 timestamps (docs/API_CONTRACT.md §3).
// Provisional default servers — replace if the deployment network requires
// a local NTP source.
constexpr char kNtpServerPrimary[] = "pool.ntp.org";
constexpr char kNtpServerSecondary[] = "time.nist.gov";

// --- Backend API -------------------------------------------------------------
// Planned API prefix (docs/API_CONTRACT.md §2). The versioning policy itself is
// still TBD (docs/PENDING_DECISIONS.md §8).
constexpr char kApiBasePath[] = "/api/v1";

// TODO(TBD): the telemetry ingestion route is not defined in
// docs/API_CONTRACT.md. Leave empty until the contract names it;
// ApiClient::postTelemetry() refuses to send while this is empty.
constexpr char kApiTelemetryPath[] = "";

// Provisional default — tune during integration testing.
constexpr uint32_t kHttpConnectTimeoutMs = 5000;
// Provisional default — tune during integration testing.
constexpr uint16_t kHttpResponseTimeoutMs = 5000;

// Upper bound for base URL + prefix + path, including the terminator.
constexpr size_t kMaxUrlLength = 256;

// --- Sensors -----------------------------------------------------------------
// GPIO assignments are TBD (docs/PENDING_DECISIONS.md §1). -1 means
// "unassigned": PhSensor stays disabled and never samples, so the firmware
// runs on hardware without claiming a pin the hardware team has not confirmed.
//
// Constraint for whoever assigns these: a pH board must land on ADC1
// (GPIO 32-39). ADC2 is unusable while Wi-Fi is active on the ESP32, which
// this firmware needs, so an ADC2 pin would read garbage once Wi-Fi comes up.
// Pins below come from the team's point-to-point wiring diagram. They are
// provisional until physically verified against the harness: the diagram is
// AI-generated and PENDING_DECISIONS §1 is still formally open. -1 means
// unassigned, which leaves that channel disabled rather than claiming a GPIO.
//
// Every analog channel is on ADC1 (GPIO 32-39) as required — ADC2 is unusable
// while the Wi-Fi radio is active, which this firmware needs.
constexpr int kPhPinPreFiltration = 34;
constexpr int kTurbidityPin = 32;
constexpr int kTdsPin = 35;
constexpr int kFlowPin = 27;        // Digital pulse input.
constexpr int kTemperaturePin = 26; // OneWire bus.

// TODO(TBD): the wiring diagram shows only ONE of each sensor, but the system
// is specified with separate pre- and post-filtration groups and P5-02..P5-06
// call for pairs. The second probe of each pair has no pin yet.
constexpr int kPhPinPostFiltration = -1;

// Resistor dividers in front of the 5 V boards (10 kOhm top / 15 kOhm bottom
// => 15/(10+15)), so the ESP32 sees at most ~3 V. Used to recover the sensor's
// own output voltage from the pin voltage.
constexpr float kDividerRatio10kTo15k = 0.6f;
// pH is currently wired straight to the pin. If its board moves to 5 V — which
// the measured dead output suggests it must — it needs a divider too, and this
// becomes kDividerRatio10kTo15k.
constexpr float kPhDividerRatio = 1.0f;

// Samples averaged per analog reading, to suppress ADC noise.
// Provisional default — tune during integration testing.
constexpr uint8_t kAnalogSampleCount = 16;

// Worst-case DS18B20 conversion time at 12-bit resolution, from the part
// datasheet. Waited out explicitly because the library's bus-polling
// completion check proved unreliable on this harness.
constexpr uint32_t kDs18b20ConversionMs = 750;

// TODO(TBD): pulses per litre for the flow sensor. The wiring diagram labels
// the part YF-S201 while tracker task P5-05 names a ZJ-S201C; those have
// different K-factors. 0 leaves volumetric flow unreported and only raw pulse
// frequency published, rather than guessing the constant.
constexpr float kFlowPulsesPerLitre = 0.0f;

// --- Diagnostics -------------------------------------------------------------
// Interval of the periodic serial status line (diagnostics only; unrelated to
// the TBD sensor-sampling and telemetry intervals).
// Provisional default — tune during integration testing.
constexpr uint32_t kStatusLogIntervalMs = 10000;

}  // namespace config
