#pragma once

    // Network settings for Wi-Fi, time sync and the backend API.
    // Everything here is a provisional default - tune it during integration testing.
    // Secrets (SSID, password, URL, CA certificate) do NOT go here: see secrets.h.

    // Arduino.h defines the chip macros (CONFIG_IDF_TARGET_*) used for the board check below.
    #include <Arduino.h>
    #include <stddef.h>
    #include <stdint.h>

    namespace config {

    // --- Wi-Fi -------------------------------------------------------------------
    constexpr uint32_t kWifiConnectTimeoutMs      = 15000;  // give up on one attempt after this long
    constexpr uint32_t kWifiRetryBackoffInitialMs = 2000;
    constexpr uint32_t kWifiRetryBackoffMaxMs     = 60000;

    // --- Time (NTP) --------------------------------------------------------------
    // HTTPS needs correct time to verify the server certificate, so uploads wait for this.
    constexpr char     kNtpServerPrimary[]   = "pool.ntp.org";
    constexpr char     kNtpServerSecondary[] = "time.nist.gov";
    constexpr uint32_t kTimeSyncWarnAfterMs  = 60000;  // warn once if SNTP is still silent after this

    // --- Backend API -------------------------------------------------------------
    constexpr char kApiBasePath[] = "/api/v1";

    // Route that receives the readings: POST <base URL>/api/v1/devices/{device-uuid}/readings
    // The single "%s" is replaced by API_DEVICE_ID (this device's UUID, see secrets.h).
    // Leave EMPTY to switch uploads off.
    constexpr char kApiReadingsPathFormat[] = "/devices/%s/readings";

    // Route that serves the saved calibration (GET) - the website writes it, the device downloads it.
    // Starts with "/" (example: "/calibration"). Leave EMPTY to turn database calibration off.
    constexpr char     kApiCalibrationPath[] = "";
    constexpr uint32_t kCalibrationPollMs    = 300000;  // check the database every 5 minutes

    constexpr uint32_t kHttpConnectTimeoutMs  = 5000;
    constexpr uint16_t kHttpResponseTimeoutMs = 5000;

    // Upper bound for base URL + prefix + path, including the terminator.
    constexpr size_t kMaxUrlLength = 256;

    // --- Telemetry (background upload, see telemetry.h) ---------------------------
    // Where this board's sensors sit, sent as "position" on every reading.
    // The API accepts only "pre_filtration" or "post_filtration".
    // Chosen at compile time from the board, like the pins in board_config.h:
    //   ESP32 DevKit V1 = PRE-filtration board,  ESP32-S3 = POST-filtration board.
    // Keep this in step with API_DEVICE_ID in secrets.h (same board -> same position).
    #if CONFIG_IDF_TARGET_ESP32S3
      constexpr char   kTelemetryPosition[] = "post_filtration";   // ESP32-S3
    #elif CONFIG_IDF_TARGET_ESP32 || defined(ARDUINO_ESP32_DEV)
      constexpr char   kTelemetryPosition[] = "pre_filtration";    // ESP32 DevKit V1
    #else
      #error "Unconfigured ESP board: set kTelemetryPosition for it in net_config.h"
    #endif

    constexpr uint32_t kTelemetryIntervalMs = 60000;  // one upload per minute
    constexpr uint32_t kTelemetryMaxAgeMs   = 10000;  // readings older than this are not sent
    constexpr size_t   kTelemetryBodySize   = 4096;   // JSON buffer (the payload is about 0.5 KB)

    }  // namespace config