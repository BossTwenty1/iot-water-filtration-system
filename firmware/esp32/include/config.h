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

// --- Diagnostics -------------------------------------------------------------
// Interval of the periodic serial status line (diagnostics only; unrelated to
// the TBD sensor-sampling and telemetry intervals).
// Provisional default — tune during integration testing.
constexpr uint32_t kStatusLogIntervalMs = 10000;

}  // namespace config
