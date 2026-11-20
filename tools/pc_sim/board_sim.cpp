// =============================================================================
//  board_sim.cpp - run ONE ESP32 board's upload code on a PC (no Wi-Fi)
// =============================================================================
//  Uses the real firmware files from firmware/esp32/FF/, unchanged:
//    secrets_select.h -> secrets.h   credentials: API_BASE_URL, API_DEVICE_KEY,
//                                    API_DEVICE_ID, API_ROOT_CA_PEM
//    net_config.h                    route, timeouts, board position (pre/post)
//    api_client.cpp / .h             ApiClient::begin() + postReadings() (HTTPS,
//                                    X-Device-Key, error messages)
//    telemetry.h                     TelemetrySnapshot + telemetryBuildPayload()
//  Only the ESP32-only pieces (HTTPClient, WiFiClientSecure, Serial, ESP) are
//  PC stand-ins in ./shim. HTTPS goes through curl, verified against the same
//  API_ROOT_CA_PEM the board uses. No Wi-Fi: the PC is always "online".
//
//  The board is chosen at COMPILE time, exactly like the firmware:
//    -DCONFIG_IDF_TARGET_ESP32=1    -> pre-filtration  (Device 0001 in secrets.h)
//    -DCONFIG_IDF_TARGET_ESP32S3=1  -> post-filtration (Device 0005 in secrets.h)
//  run_both.sh builds both and runs them at the same time.
//
//  SENSOR VALUES ARE MADE UP. With the real device IDs they appear in the real
//  boards' history. Each upload is appended to the --log file (device id +
//  measuredAt + HTTP code) so the rows can be found and removed later.
//
//  Options:
//    -i <s>          seconds between uploads (default 60 = kTelemetryIntervalMs)
//    -n <count>      uploads before stopping (default 10, 0 = until Ctrl+C)
//    --sim           use the simulated Device 0006 / 0007 instead of the real IDs
//    --fault <cat>   that sensor failed its self test   (ph|tds|turbidity|temperature|flow_rate)
//    --uncal <cat>   that sensor is not calibrated      (ph|turbidity)
//    --log <file>    upload log (default board_sim.log)
// =============================================================================

#include <Arduino.h>
#include <csignal>
#include <string>

// ---- credentials: the same files the firmware uses ----
#include "secrets_select.h"
#include "net_config.h"
#include "api_client.h"
#include "time_sync.h"
#include "wifi_manager.h"

WifiManager gWifi;     // not started on PC; telemetry.h only references it
TimeSync    gTimeSync;
ApiClient   gApi;

// ---- PC clock instead of SNTP (the PC clock is already synced) ----
void TimeSync::loop(bool) {}
bool TimeSync::isSynced() const { return true; }
bool TimeSync::formatUtcIso8601(char *buffer, size_t bufferSize) const
{
  if (buffer == nullptr || bufferSize < kIso8601BufferSize) return false;
  time_t now = time(nullptr);
  struct tm utc;
  if (gmtime_r(&now, &utc) == nullptr) return false;
  return strftime(buffer, bufferSize, "%Y-%m-%dT%H:%M:%SZ", &utc) == kIso8601BufferSize - 1;
}

// ---- globals telemetry.h reads from post.h / calibration.h / device_info.h ----
bool phSensorOK = true, tdsSensorOK = true, turbSensorOK = true, tempSensorOK = true;   // post.h
bool phCalibrated = true, turbidityCalibrated = true;                                 // calibration.h
enum CalSensor : uint8_t { CAL_PH, CAL_TDS, CAL_TURB, CAL_TEMP, CAL_COUNT };
char gCalDownload[512];
volatile bool gCalDownloadReady = false;
volatile bool gCalSyncRequest = false;
bool calParamsJson(CalSensor, char *, size_t) { return false; }
void calMarkSent(CalSensor, uint32_t) {}
void deviceIdentifier(char *out, size_t cap) { snprintf(out, cap, "pc-sim"); }

#include "telemetry.h"   // TelemetrySnapshot, telemetryBuildPayload(), JsonWriter

// ---- simulation ----

static const char *SIM_DEVICE_ID =
#if CONFIG_IDF_TARGET_ESP32S3
    "95c3cf20-7c16-4fc5-b85c-d92a0cca52b9";   // Device 0007 (simulated, post)
#else
    "00a14b1d-1b8a-4368-be56-46bd8c7a65a5";   // Device 0006 (simulated, pre)
#endif

static volatile sig_atomic_t gStop = 0;
static void onSigint(int) { gStop = 1; }

// Made-up values around a fixed centre, like the sensor loop refreshing the snapshot.
static TelemetrySnapshot syntheticSnapshot()
{
  const bool pre = strcmp(config::kTelemetryPosition, "pre_filtration") == 0;
  auto wobble = [](float base, float pct) { return base * (1.0f + (float)random(-1000, 1001) / 1000.0f * pct); };

  TelemetrySnapshot s;
  s.ph           = phSensorOK   && phCalibrated        ? wobble(pre ? 7.4f : 7.1f, 0.03f)     : NAN;
  s.tdsPpm       = tdsSensorOK                         ? wobble(pre ? 310.0f : 120.0f, 0.03f) : NAN;
  s.turbidityNtu = turbSensorOK && turbidityCalibrated ? wobble(pre ? 9.0f : 1.2f, 0.05f)     : NAN;
  s.temperatureC = tempSensorOK                        ? wobble(pre ? 26.0f : 25.6f, 0.01f)   : NAN;
  s.flowLMin     = wobble(2.4f, 0.05f);
  s.totalLiters  = NAN;
  s.updatedMs    = millis();
  s.hasData      = true;
  return s;
}

static bool setFlag(const std::string &cat, bool fault)
{
  if (cat == "ph")          { (fault ? phSensorOK : phCalibrated) = false; return true; }
  if (cat == "turbidity")   { (fault ? turbSensorOK : turbidityCalibrated) = false; return true; }
  if (fault && cat == "tds")         { tdsSensorOK = false; return true; }
  if (fault && cat == "temperature") { tempSensorOK = false; return true; }
  return false;
}

int main(int argc, char **argv)
{
  uint32_t intervalS = config::kTelemetryIntervalMs / 1000;
  int count = 10;
  bool useSim = false;
  std::string logPath = "board_sim.log";

  for (int i = 1; i < argc; i++)
  {
    std::string a = argv[i];
    if      (a == "-i" && i + 1 < argc)      intervalS = (uint32_t)std::max(1, atoi(argv[++i]));
    else if (a == "-n" && i + 1 < argc)      count = std::max(0, atoi(argv[++i]));
    else if (a == "--sim")                   useSim = true;
    else if (a == "--log" && i + 1 < argc)   logPath = argv[++i];
    else if ((a == "--fault" || a == "--uncal") && i + 1 < argc)
    {
      if (!setFlag(argv[++i], a == "--fault")) { printf("cannot %s %s\n", a.c_str(), argv[i]); return 1; }
    }
    else { printf("unknown option: %s (see the top of board_sim.cpp)\n", a.c_str()); return 1; }
  }

  const char *deviceId = useSim ? SIM_DEVICE_ID : API_DEVICE_ID;
  if (strlen(API_DEVICE_KEY) == 0)
  {
    printf("API_DEVICE_KEY is empty: create firmware/esp32/FF/secrets.h (see SETUP_CHECKLIST.md)\n");
    return 1;
  }

  Serial.printf("===== PC BOARD SIM: %s | device %s (%s) | every %u s | %s =====\n",
                config::kTelemetryPosition, deviceId, useSim ? "simulated" : "REAL ID", intervalS,
                count ? (std::to_string(count) + " uploads").c_str() : "until Ctrl+C");
  signal(SIGINT, onSigint);

  gApi.begin(API_BASE_URL, API_ROOT_CA_PEM, API_DEVICE_KEY);   // same call as startNetwork() in FF.ino
  if (!gApi.isConfigured()) return 1;

  static char body[config::kTelemetryBodySize];
  int sent = 0, failed = 0;
  uint32_t lastAttemptMs = millis();   // firmware: first upload one interval after start

  while (!gStop && (count == 0 || sent + failed < count))
  {
    delay(200);
    if (millis() - lastAttemptMs < intervalS * 1000) continue;
    lastAttemptMs = millis();

    char nowIso[TimeSync::kIso8601BufferSize];
    if (!gTimeSync.formatUtcIso8601(nowIso, sizeof nowIso)) continue;

    TelemetrySnapshot snap = syntheticSnapshot();
    uint8_t calMask = 0, faultMask = 0;
    time_t measuredAt = time(nullptr);
    if (!telemetryBuildPayload(snap, measuredAt, nowIso, body, sizeof body, calMask, faultMask))
    {
      Serial.println("[telemetry] payload does not fit the buffer - not sent");
      continue;
    }

    ApiClient::Result result = gApi.postReadings(deviceId, body, true, true);
    if (result.status == ApiClient::Status::kOk)
    {
      sent++;
      Serial.printf("[telemetry] sent (%u bytes)\n", (unsigned)strlen(body));
    }
    else
    {
      failed++;
      Serial.printf("[telemetry] upload failed: %s (code %d)\n", ApiClient::statusName(result.status), result.httpCode);
    }

    char measuredIso[TimeSync::kIso8601BufferSize];
    telemetryFormatUtc(measuredAt, measuredIso, sizeof measuredIso);
    if (FILE *log = fopen(logPath.c_str(), "a"))
    {
      fprintf(log, "%s %s %d\n", deviceId, measuredIso, result.httpCode);
      fclose(log);
    }
  }

  Serial.printf("===== %s stopped: %d sent, %d failed =====\n", config::kTelemetryPosition, sent, failed);
  return failed ? 2 : 0;
}
