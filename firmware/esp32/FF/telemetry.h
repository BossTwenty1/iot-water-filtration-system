#pragma once

// TELEMETRY (background upload to the backend)
//
// Sensors, menus and the LCD must never wait on the network, because a single
// HTTPS request can block for seconds. So uploads run in their own FreeRTOS task:
//
//   main loop --telemetryUpdate()--> latest readings (snapshot)
//   telemetry task: every kTelemetryIntervalMs, if Wi-Fi is up AND the clock is
//   synced AND the snapshot is fresh -> build JSON -> gApi.postReadings()
//
// Nothing is sent while:
//   - the backend URL / root CA are not configured (secrets.h), or
//   - config::kApiReadingsPathFormat (net_config.h) or API_DEVICE_ID (secrets.h) is empty, or
//   - the menu / calibration is open (the snapshot goes stale and is skipped).
//
// ---------------------------------------------------------------------------
// REQUEST
// ---------------------------------------------------------------------------
//   POST <API_BASE_URL>/api/v1/devices/<API_DEVICE_ID>/readings
//   X-Device-Key: <API_DEVICE_KEY>
//   Content-Type: application/json
//
// ---------------------------------------------------------------------------
// PAYLOAD  (exactly as documented in backend/docs/API_REFERENCE.md, "Devices")
// ---------------------------------------------------------------------------
// {
//   "measuredAt": "2026-11-02T12:00:00Z",          required, ISO-8601 UTC
//   "readings": [
//     { "category": "ph", "position": "pre_filtration", "value": 7.01, "status": "valid" },
//     ... tds, turbidity, temperature, flow_rate
//   ]
// }
// category: ph | tds | turbidity | temperature | flow_rate
// position: pre_filtration | post_filtration   (config::kTelemetryPosition, net_config.h)
// value:    number, or null when there is no reading
// status:   "valid" | "invalid" | "fault" | "uncalibrated"  (free text; the backend raises a
//           sensor-fault alert for invalid / fault)
// The device is identified by the UUID in the URL (API_DEVICE_ID). This route accepts no
// calibration, alert or device-state fields, so none are sent. Reply: 201 with
// {"deviceId","inserted","skipped":[...]}; 400 if every reading was skipped.
//
// CALIBRATION SYNC (same task): downloads GET kApiCalibrationPath?device=<identifier>
//   { "calibrations": [ { "category": "pH", "parameters": { ...same shape as above... } } ] }
// and hands it to calibration.h, which applies it on the main thread. See calibration.h
// for the rules (database fills missing calibration; your un-uploaded change is never overwritten).
//
// calibration_records.parameters shapes:
//   pH, Turbidity : {"points":[{"ref":4.01,"v":1.8421}, ...]}   2-5 points, any standards
//   TDS           : {"factor":1.0213,"ref_ppm":1382}
//   Temperature   : {"offset_c":-0.30}
//
// Include in main.ino AFTER gWifi, gTimeSync, gApi, post.h and calibration.h.

#include <Arduino.h>
#include <WiFi.h>
#include <math.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include "net_config.h"

#ifndef FW_VERSION
#define FW_VERSION "1.0.0"
#endif

#if CONFIG_IDF_TARGET_ESP32S3
  #define TELEMETRY_CONTROLLER_NAME "ESP32-S3"
#else
  #define TELEMETRY_CONTROLLER_NAME "ESP32 DevKit V1"
#endif

// ---------------- DATABASE VOCABULARY ----------------

constexpr const char *kStConnOnline   = "Online";
constexpr const char *kStWifiOk       = "Connected";
constexpr const char *kStFailSafeOk   = "Normal";
constexpr const char *kStFailSafeFlt  = "Sensor Fault";

constexpr const char *kRsOk           = "OK";
constexpr const char *kRsFault        = "Fault";
constexpr const char *kRsInvalid      = "Invalid";
constexpr const char *kRsUncal        = "Uncalibrated";

constexpr const char *kAlCategory     = "Sensor Fault";
constexpr const char *kAlSeverity     = "Critical";
constexpr const char *kAlStatus       = "Active";
constexpr const char *kAlSource       = "Device";

// sensors.category / sensors.unit. The category is the key the backend uses to find
// the sensor row, so it must never change once data exists.
enum TelemetrySensor : uint8_t { TS_PH, TS_TDS, TS_TURB, TS_TEMP, TS_FLOW, TS_COUNT };

struct TelemetrySensorMeta { const char *category; const char *unit; uint8_t decimals; };

constexpr TelemetrySensorMeta kTelemetrySensors[TS_COUNT] =
{
  { "pH",          "pH",    2 },
  { "TDS",         "ppm",   1 },
  { "Turbidity",   "NTU",   1 },
  { "Temperature", "°C",    2 },
  { "Flow Rate",   "L/min", 2 },
};

// ---------------- SNAPSHOT ----------------

struct TelemetrySnapshot
{
  float ph = NAN;
  float tdsPpm = NAN;
  float turbidityNtu = NAN;
  float temperatureC = NAN;
  float flowLMin = NAN;
  float totalLiters = NAN;
  uint32_t updatedMs = 0;
  bool hasData = false;
};

TelemetrySnapshot gTelemetrySnapshot;
portMUX_TYPE gTelemetryMux = portMUX_INITIALIZER_UNLOCKED;
bool gTelemetryRunning = false;

// Called from the main loop after each sensor read. Cheap, and a no-op while disabled.
void telemetryUpdate(float ph, float tdsPpm, float turbidityNtu,
                     float temperatureC, float flowLMin, float totalLiters)
{
  if (!gTelemetryRunning) return;

  portENTER_CRITICAL(&gTelemetryMux);
  gTelemetrySnapshot.ph           = ph;
  gTelemetrySnapshot.tdsPpm       = tdsPpm;
  gTelemetrySnapshot.turbidityNtu = turbidityNtu;
  gTelemetrySnapshot.temperatureC = temperatureC;
  gTelemetrySnapshot.flowLMin     = flowLMin;
  gTelemetrySnapshot.totalLiters  = totalLiters;
  gTelemetrySnapshot.updatedMs    = millis();
  gTelemetrySnapshot.hasData      = true;
  portEXIT_CRITICAL(&gTelemetryMux);
}

// ---------------- SENSOR STATE (read from post.h / calibration.h globals) ----------------

static bool telemetrySensorOK(uint8_t i)
{
  switch (i)
  {
    case TS_PH:   return phSensorOK;
    case TS_TDS:  return tdsSensorOK;
    case TS_TURB: return turbSensorOK;
    case TS_TEMP: return tempSensorOK;
    default:      return true;          // the flow meter is not tested by POST
  }
}

// "Needs a calibration to produce a value at all". TDS and temperature have usable
// defaults and flow uses a fixed constant, so they never count as uncalibrated.
static bool telemetryCalibrated(uint8_t i)
{
  switch (i)
  {
    case TS_PH:   return phCalibrated;
    case TS_TURB: return turbidityCalibrated;
    default:      return true;
  }
}

static float telemetryValue(const TelemetrySnapshot &s, uint8_t i)
{
  switch (i)
  {
    case TS_PH:   return s.ph;
    case TS_TDS:  return s.tdsPpm;
    case TS_TURB: return s.turbidityNtu;
    case TS_TEMP: return s.temperatureC;
    default:      return s.flowLMin;
  }
}

static const char *telemetryReadingStatus(const TelemetrySnapshot &s, uint8_t i)
{
  if (!telemetrySensorOK(i))              return kRsFault;
  if (!isfinite(telemetryValue(s, i)))    return telemetryCalibrated(i) ? kRsInvalid : kRsUncal;
  return kRsOk;
}

// ---------------- CALIBRATION CHANGE DETECTION ----------------

static uint32_t gCalSigInFlight[TS_COUNT];     // signatures inside the payload being uploaded
static uint8_t  gFaultSentMask = 0;            // sensors whose fault alert was already delivered this boot

// ---------------- JSON WRITER ----------------
// Every string written here is a fixed ASCII/UTF-8 constant without quotes or
// backslashes, so no escaping is needed. Do not feed user text through it.

struct JsonWriter
{
  char  *buf;
  size_t cap;
  size_t len = 0;
  bool   overflow = false;

  JsonWriter(char *b, size_t c) : buf(b), cap(c) { if (cap) buf[0] = '\0'; }

  void raw(const char *fmt, ...)
  {
    if (overflow) return;
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(buf + len, cap - len, fmt, ap);
    va_end(ap);
    if (n < 0 || (size_t)n >= cap - len) { overflow = true; return; }
    len += (size_t)n;
  }

  void number(float v, int decimals)
  {
    if (isfinite(v)) raw("%.*f", decimals, v);
    else             raw("null");
  }
};

static bool telemetryFormatUtc(time_t t, char *out, size_t cap)
{
  struct tm tmv;
  if (cap < TimeSync::kIso8601BufferSize || gmtime_r(&t, &tmv) == nullptr) return false;
  return strftime(out, cap, "%Y-%m-%dT%H:%M:%SZ", &tmv) == TimeSync::kIso8601BufferSize - 1;
}

// calibration_records.parameters (jsonb): points / factor / offset, built by calibration.h
static void telemetryWriteCalParams(JsonWriter &w, uint8_t i)
{
  char params[420];
  if (i < CAL_COUNT && calParamsJson((CalSensor)i, params, sizeof(params))) w.raw("%s", params);
  else                                                                     w.raw("{}");
}

static void telemetryDeviceIdentifier(char *out, size_t cap)
{
  deviceIdentifier(out, cap);   // device_info.h: same value the Device Info screen shows
}

// API vocabulary (backend API_REFERENCE.md), in TelemetrySensor order.
constexpr const char *kApiCategory[TS_COUNT] = { "ph", "tds", "turbidity", "temperature", "flow_rate" };

static const char *telemetryApiStatus(const TelemetrySnapshot &s, uint8_t i)
{
  if (!telemetrySensorOK(i))           return "fault";
  if (!isfinite(telemetryValue(s, i))) return telemetryCalibrated(i) ? "invalid" : "uncalibrated";
  return "valid";
}

// Builds the body for POST /api/v1/devices/{id}/readings (see the PAYLOAD comment above).
// The endpoint has no calibration or alert fields, so calMask / faultMask stay 0 and
// nothing is marked as delivered. nowIso is unused here.
bool telemetryBuildPayload(const TelemetrySnapshot &s, time_t measuredAt, const char *nowIso,
                           char *out, size_t cap, uint8_t &calMask, uint8_t &faultMask)
{
  (void)nowIso;
  calMask = 0;
  faultMask = 0;

  char measuredIso[TimeSync::kIso8601BufferSize];
  if (!telemetryFormatUtc(measuredAt, measuredIso, sizeof(measuredIso))) return false;

  JsonWriter w(out, cap);
  w.raw("{\"measuredAt\":\"%s\",\"readings\":[", measuredIso);
  for (uint8_t i = 0; i < TS_COUNT; i++)
  {
    w.raw("%s{\"category\":\"%s\",\"position\":\"%s\",\"value\":", i ? "," : "",
          kApiCategory[i], config::kTelemetryPosition);
    w.number(telemetryValue(s, i), kTelemetrySensors[i].decimals);
    w.raw(",\"status\":\"%s\"}", telemetryApiStatus(s, i));
  }
  w.raw("]}");

  return !w.overflow;
}

// ---------------- TASK ----------------

static bool gCalPollEnabled = false;

// Downloads the calibration saved in the database into gCalDownload. The MAIN thread
// applies it (calibrationSyncService), so the network task never touches calibration state.
static void telemetryFetchCalibration()
{
  char ident[24];
  telemetryDeviceIdentifier(ident, sizeof(ident));

  char path[96];
  snprintf(path, sizeof(path), "%s?device=%s", config::kApiCalibrationPath, ident);

  ApiClient::Result result = gApi.getJson(path, gCalDownload, sizeof(gCalDownload), true, true);
  if (result.status == ApiClient::Status::kOk)
  {
    __sync_synchronize();            // data first, then the flag
    gCalDownloadReady = true;
  }
  else
  {
    Serial.printf("[calibration] database check failed: %s (code %d)\n",
                  ApiClient::statusName(result.status), result.httpCode);
  }
}

void telemetryTask(void *)
{
  uint32_t lastAttemptMs = millis();   // first upload one interval after start
  uint32_t lastPollMs = 0;
  bool polledOnce = false;
  static char body[config::kTelemetryBodySize];   // static: keeps the task stack free for TLS

  for (;;)
  {
    vTaskDelay(pdMS_TO_TICKS(1000));

    // Not ready yet: keep checking every second, without using up any interval.
    if (!gWifi.isConnected() || !gTimeSync.isSynced()) continue;

    // ---- calibration download: as soon as the network is ready, then periodically ----
    if (gCalPollEnabled && !gCalDownloadReady &&
        (gCalSyncRequest || !polledOnce || millis() - lastPollMs >= config::kCalibrationPollMs))
    {
      gCalSyncRequest = false;
      polledOnce = true;
      telemetryFetchCalibration();
      lastPollMs = millis();
    }

    // ---- telemetry upload ----
    if (!gTelemetryRunning) continue;
    if (millis() - lastAttemptMs < config::kTelemetryIntervalMs) continue;

    TelemetrySnapshot snap;
    portENTER_CRITICAL(&gTelemetryMux);
    snap = gTelemetrySnapshot;
    portEXIT_CRITICAL(&gTelemetryMux);

    // The menu/calibration stops the sensor loop; never upload old values as if they were live.
    uint32_t ageMs = millis() - snap.updatedMs;
    if (!snap.hasData || ageMs > config::kTelemetryMaxAgeMs) continue;

    char nowIso[TimeSync::kIso8601BufferSize];
    if (!gTimeSync.formatUtcIso8601(nowIso, sizeof(nowIso))) continue;

    lastAttemptMs = millis();

    uint8_t calMask = 0, faultMask = 0;
    time_t measuredAt = time(nullptr) - (time_t)(ageMs / 1000);

    if (!telemetryBuildPayload(snap, measuredAt, nowIso, body, sizeof(body), calMask, faultMask))
    {
      Serial.println("[telemetry] payload does not fit the buffer - not sent (raise kTelemetryBodySize)");
      continue;
    }

    ApiClient::Result result = gApi.postReadings(API_DEVICE_ID, body, true, true);
    if (result.status == ApiClient::Status::kOk)
    {
      // The backend has them now: remember, so they are not sent again
      for (uint8_t i = 0; i < CAL_COUNT; i++)
      {
        if (calMask & (1u << i)) calMarkSent((CalSensor)i, gCalSigInFlight[i]);
      }
      gFaultSentMask |= faultMask;
      Serial.printf("[telemetry] sent (%u bytes%s%s)\n", (unsigned)strlen(body),
                    calMask ? ", +calibration" : "", faultMask ? ", +alert" : "");
    }
    else
    {
      Serial.printf("[telemetry] upload failed: %s (code %d)\n",
                    ApiClient::statusName(result.status), result.httpCode);
    }
  }
}

// Call once, after gApi.begin(). Starts the task only if something can actually be sent or fetched.
void telemetryBegin()
{
  if (!gApi.isConfigured())
  {
    Serial.println("[telemetry] off: backend URL / root CA not set in secrets.h");
    return;
  }

  bool uploads = config::kApiReadingsPathFormat[0] != '\0' && API_DEVICE_ID[0] != '\0';
  if (API_DEVICE_ID[0] == '\0')
  {
    Serial.println("[telemetry] uploads off: API_DEVICE_ID (this device's UUID) is not set in secrets.h");
  }
  bool polling = config::kApiCalibrationPath[0] != '\0';
  if (!uploads && !polling)
  {
    Serial.println("[telemetry] off: no upload route (API_DEVICE_ID empty) and no calibration route (kApiCalibrationPath empty)");
    return;
  }

  gTelemetryRunning = uploads;
  gCalPollEnabled = polling;

  // 16 KB stack: the TLS handshake needs far more than the default task stack.
  if (xTaskCreatePinnedToCore(telemetryTask, "telemetry", 16384, nullptr, 1, nullptr, 0) != pdPASS)
  {
    gTelemetryRunning = false;
    gCalPollEnabled = false;
    Serial.println("[telemetry] could not start the network task");
    return;
  }

  Serial.printf("[telemetry] uploads %s (every %lu s), database calibration %s (every %lu min)\n",
                uploads ? "on" : "off", (unsigned long)(config::kTelemetryIntervalMs / 1000),
                polling ? "on" : "off", (unsigned long)(config::kCalibrationPollMs / 60000));
}