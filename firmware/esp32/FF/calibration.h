#pragma once

// CALIBRATION: final2.3 fixed references and guided serial wizard.
// Newer Wi-Fi, telemetry and BLE interfaces are retained. Serial export/import uses
// the final2.3 key=value format; database/BLE JSON envelopes remain unchanged.

// Fixed pH: 4.01 / 6.86 / 9.18; turbidity: legacy 0 / 5 / 10 NTU references.
// These are supplied legacy assumptions, not laboratory validation.
// Calibration is saved locally; reading uploads do not upload calibration records.
// Optional database downloads only accept these fixed reference sets.
// Existing unsent local calibration keeps priority over downloads.
//
//  Needs the ArduinoJson library (version 7) from the Library Manager.
//  Include order in main.ino: AFTER post.h, BEFORE menu.h and telemetry.h.

#include <Arduino.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include "net_config.h"

void readAllSensors();                                 // main.ino
float tdsRawPPM(float moduleVolts, float tempC);       // main.ino

// ---------------- LIMITS (only limits: the reference VALUES are always yours) ----------------
constexpr uint8_t  CAL_MAX_POINTS        = 5;
constexpr float    PH_MIN_GAP_V          = 0.03f;   // two points closer than this = the sensor did not respond
constexpr float    TURB_MIN_GAP_V        = 0.02f;
constexpr float    CAL_MAX_VOLTS         = 5.2f;
constexpr float    CAL_UNSTABLE_V        = 0.02f;   // warn when 5 readings spread more than this
constexpr float    TURB_NTU_MAX          = 3000.0f; // upper end of the TS-300B range
constexpr float    TDS_FACTOR_MIN        = 0.1f;
constexpr float    TDS_FACTOR_MAX        = 3.0f;
constexpr float    TDS_SUGGESTED_PPM     = 1382.0f; // only a suggestion at the prompt
constexpr float    TEMP_OFFSET_LIMIT_C   = 20.0f;
constexpr uint32_t CAL_PROMPT_MISSING_MS = 15000;   // wait (database may answer), then run uncalibrated
constexpr uint32_t CAL_INPUT_TIMEOUT_MS  = 120000;
constexpr size_t   CAL_DOWNLOAD_SIZE     = 2048;

// Order = sensors.category list used by telemetry.h
enum CalSensor : uint8_t { CAL_PH, CAL_TDS, CAL_TURB, CAL_TEMP, CAL_COUNT };
constexpr const char *CAL_CATEGORY[CAL_COUNT] = { "pH", "TDS", "Turbidity", "Temperature" };

struct CalPoint { float ref; float volts; };
struct CalCurve { uint8_t n; CalPoint p[CAL_MAX_POINTS]; };   // p[] sorted by volts, ascending

// ---------------- STATE ----------------
// pH curves use the voltage at the ESP32 pin, turbidity curves the voltage at the sensor module.

CalCurve phCurve   = {0, {}};
CalCurve turbCurve = {0, {}};
float tdsCalFactor = 0.0f;               // final2.3 default; calibrate TDS before using its readings
float tdsRefPpm    = TDS_SUGGESTED_PPM;  // standard used for the saved factor
float tempOffsetC  = 0.0f;

bool phCalibrated        = false;
bool turbidityCalibrated = false;
bool tdsCalibrated       = false;
bool tempCalibrated      = false;

Preferences prefs;
portMUX_TYPE gCalMux = portMUX_INITIALIZER_UNLOCKED;   // the network task reads calibration too

uint32_t gCalSentSig[CAL_COUNT] = {0, 0, 0, 0};   // signature of what the database already has
volatile bool gCalSigDirty     = false;           // gCalSentSig changed: save it in flash
volatile bool gCalBusy         = false;           // a manual session is open: do not apply downloads
volatile bool gCalSyncRequest  = false;           // menu asked for an immediate database check
char gCalDownload[CAL_DOWNLOAD_SIZE];             // JSON from the database (filled by the network task)
volatile bool gCalDownloadReady = false;


// Reference Values
constexpr float TURB_NTU_DI        = 0.0f;    // Deionized water
constexpr float TURB_NTU_TAP       = 5.0f;    // Tap water (~1-5 NTU)
constexpr float TURB_NTU_CLOUDY    = 10.0f;   // Cloudy water reference (must match the REAL NTU of your sample)
constexpr float TDS_CAL_TARGET_PPM = 1382.0f; // Standard TDS solution @ 25 C

// Sanity limits used to reject bad calibration data
constexpr float   TURB_MAX_MODULE_V   = 5.2f;    // module can't output more than its 5 V supply
constexpr float   TURB_MIN_MODULE_V   = 0.05f;
constexpr float   TURB_MIN_SPAN_V     = 0.05f;   // clear -> cloudy must drop at least this much (raise it
                                                 // if you use a stronger cloudy reference)
constexpr float   TURB_MIN_SEGMENT_V  = 0.02f;   // two points closer than this = same point (ADC noise)
constexpr float   PH_MIN_POINT_GAP_V  = 0.03f;   // min voltage gap between pH points

// Prompt shown before running when calibration is missing (F = file, C = calibrate)
constexpr uint32_t IMPORT_WAIT_MS         = 60000;  // wait for the calibration file to start arriving
constexpr uint32_t IMPORT_LINE_TIMEOUT_MS = 5000;   // max silence between lines of the file



// Steps of the startup calibration 
enum CalStep : uint8_t
{
  STEP_TEMP,
  STEP_PH4,
  STEP_PH7,
  STEP_PH9,
  STEP_TURB_DI,
  STEP_TURB_TAP,
  STEP_TURB_CLD,
  STEP_TDS,
  STEP_COUNT
};

enum StepAction : uint8_t { ACTION_GO, ACTION_SKIP, ACTION_QUIT };

// ---------------- CALIBRATION DATA ----------------

// pH Calibration (GPIO level)
float ph4PinVolts = NAN;
float ph7PinVolts = NAN;
float ph9PinVolts = NAN;

// Turbidity Calibration (Module voltage level)
float turbDIVolts     = NAN;
float turbTapVolts    = NAN;
float turbCloudyVolts = NAN;

// TDS Calibration Factor

// Temperature Offset (deg C)



bool gCalSerialBusy = false;
bool gCalPhoneLive = false;
int gCalLiveSerialSensor = -1;
constexpr uint32_t CAL_LIVE_INTERVAL_MS = 1000;
struct CalLiveSample { float value = NAN; uint32_t atMs = 0; bool valid = false; };
CalLiveSample gCalLiveSamples[CAL_COUNT];
void refreshCalFlags();

// ---------------- CURVE MATHS ----------------

float calRound(float x, float scale) { return roundf(x * scale) / scale; }   // 4 decimals = what is stored/uploaded
float calMinGap(CalSensor s)         { return s == CAL_PH ? PH_MIN_GAP_V : TURB_MIN_GAP_V; }

void calSort(CalCurve &c)
{
  for (uint8_t i = 1; i < c.n; i++)
  {
    CalPoint k = c.p[i];
    int j = (int)i - 1;
    while (j >= 0 && c.p[j].volts > k.volts) { c.p[j + 1] = c.p[j]; j--; }
    c.p[j + 1] = k;
  }
}

void calCanon(CalCurve &c)
{
  for (uint8_t i = 0; i < c.n; i++) { c.p[i].ref = calRound(c.p[i].ref, 10000.0f); c.p[i].volts = calRound(c.p[i].volts, 10000.0f); }
}

// nullptr = usable curve, otherwise the reason (c must be sorted)
bool calFixedPoints(CalSensor s, const CalCurve &c, float (&v)[3])
{
  if (c.n != 3 || (s != CAL_PH && s != CAL_TURB)) return false;
  const float refs[2][3] = {{4.01f, 6.86f, 9.18f}, {TURB_NTU_DI, TURB_NTU_TAP, TURB_NTU_CLOUDY}};
  bool seen[3] = {};
  for (uint8_t i = 0; i < c.n; i++)
  {
    int found = -1;
    for (uint8_t j = 0; j < 3; j++)
      if (isfinite(c.p[i].ref) && fabsf(c.p[i].ref - refs[s == CAL_PH ? 0 : 1][j]) < 0.00005f) found = j;
    if (found < 0 || seen[found] || !isfinite(c.p[i].volts)) return false;
    float volts = c.p[i].volts;
    if (s == CAL_PH ? (volts <= 0.01f || volts >= 3.3f)
                    : (volts <= TURB_MIN_MODULE_V || volts >= TURB_MAX_MODULE_V)) return false;
    seen[found] = true;
    v[found] = volts;
  }
  return true;
}

const char *calCurveProblem(CalSensor s, const CalCurve &c)
{
  float v[3];
  if (!calFixedPoints(s, c, v))
    return s == CAL_PH ? "need pH 4.01, 6.86 and 9.18 with valid GPIO voltages"
                       : "need the legacy 0, 5 and 10 NTU references with valid module voltages";
  if (s == CAL_PH)
  {
    float a = v[0] - v[1], b = v[2] - v[1];
    return fabsf(a) >= PH_MIN_POINT_GAP_V && fabsf(b) >= PH_MIN_POINT_GAP_V && ((a > 0) != (b > 0))
      ? nullptr : "pH points are inconsistent or too close";
  }
  return v[0] - v[2] >= TURB_MIN_SPAN_V && v[1] <= v[0] + 0.10f && v[1] >= v[2] - TURB_MIN_SPAN_V
    ? nullptr : "turbidity points are inconsistent: cloudy must read below clear water";
}

// Retained curve helper for compatibility. Runtime pH/turbidity use final2.3 calculations in the sketch.
float calEvalCurve(const CalCurve &c, float v)
{
  uint8_t i = 0;
  while (i + 2 < c.n && v > c.p[i + 1].volts) i++;
  float t = (v - c.p[i].volts) / (c.p[i + 1].volts - c.p[i].volts);
  return c.p[i].ref + t * (c.p[i + 1].ref - c.p[i].ref);
}

// ---------------- THREAD-SAFE COPY, SIGNATURE, JSON ----------------

struct CalSnap { bool ok; CalCurve c; float x; float y; };   // TDS: x=factor y=standard ppm; temperature: x=offset

CalSnap calSnapshot(CalSensor s)
{
  CalSnap z = {};
  portENTER_CRITICAL(&gCalMux);
  switch (s)
  {
    case CAL_PH:   z.ok = phCalibrated;        z.c = phCurve;   break;
    case CAL_TURB: z.ok = turbidityCalibrated; z.c = turbCurve; break;
    case CAL_TDS:  z.ok = tdsCalibrated;       z.x = tdsCalFactor; z.y = tdsRefPpm; break;
    default:       z.ok = tempCalibrated;      z.x = tempOffsetC;  break;
  }
  portEXIT_CRITICAL(&gCalMux);
  return z;
}

uint32_t calMix(uint32_t h, float v, float scale) { return (h ^ (uint32_t)(int32_t)lroundf(v * scale)) * 16777619u; }

// Same values -> same number on the device and on the server side (4-decimal values).
uint32_t calSigOf(CalSensor s, const CalSnap &z)
{
  uint32_t h = 2166136261u;
  if (s == CAL_PH || s == CAL_TURB)
  {
    h = calMix(h, z.c.n, 1.0f);
    for (uint8_t i = 0; i < z.c.n; i++) { h = calMix(h, z.c.p[i].ref, 10000.0f); h = calMix(h, z.c.p[i].volts, 10000.0f); }
  }
  else if (s == CAL_TDS) { h = calMix(h, z.x, 10000.0f); h = calMix(h, z.y, 100.0f); }
  else                   { h = calMix(h, z.x, 10000.0f); }
  return h ? h : 1;
}

bool calSignature(CalSensor s, uint32_t &sig)
{
  CalSnap z = calSnapshot(s);
  if (!z.ok) return false;
  sig = calSigOf(s, z);
  return true;
}

// {"points":[...]} / {"factor":..,"ref_ppm":..} / {"offset_c":..}  = calibration_records.parameters
bool calParamsJson(CalSensor s, char *out, size_t cap)
{
  CalSnap z = calSnapshot(s);
  if (!z.ok) return false;

  int n;
  if (s == CAL_PH || s == CAL_TURB)
  {
    n = snprintf(out, cap, "{\"points\":[");
    for (uint8_t i = 0; i < z.c.n && n > 0 && (size_t)n < cap; i++)
      n += snprintf(out + n, cap - n, "%s{\"ref\":%.4f,\"v\":%.4f}", i ? "," : "", z.c.p[i].ref, z.c.p[i].volts);
    if (n > 0 && (size_t)n < cap) n += snprintf(out + n, cap - n, "]}");
  }
  else if (s == CAL_TDS) n = snprintf(out, cap, "{\"factor\":%.4f,\"ref_ppm\":%.2f}", z.x, z.y);
  else                   n = snprintf(out, cap, "{\"offset_c\":%.4f}", z.x);

  return n > 0 && (size_t)n < cap;
}

// Called by the network task after a successful upload.
void calMarkSent(CalSensor s, uint32_t sig) { gCalSentSig[s] = sig; gCalSigDirty = true; }

// ---------------- SAVE / SET (main thread only) ----------------

void calSaveFlash(CalSensor s)
{
  switch (s)
  {
    case CAL_PH:
      prefs.putBytes("ph_curve", &phCurve, sizeof(CalCurve));
      prefs.putFloat("ph4pin", ph4PinVolts); prefs.putFloat("ph7pin", ph7PinVolts); prefs.putFloat("ph9pin", ph9PinVolts); break;
    case CAL_TURB:
      prefs.putBytes("tb_curve", &turbCurve, sizeof(CalCurve));
      prefs.putFloat("turb_di", turbDIVolts); prefs.putFloat("turb_tap", turbTapVolts); prefs.putFloat("turb_cld", turbCloudyVolts); break;
    case CAL_TDS:
      prefs.putFloat("tds_f", tdsCalFactor); prefs.putFloat("tds_ref", tdsRefPpm); prefs.putFloat("tds_factor", tdsCalFactor); break;
    default:
      prefs.putFloat("tmp_off", tempOffsetC); prefs.putFloat("temp_offset", tempOffsetC); break;
  }
}

void calSetCurve(CalSensor s, const CalCurve &c)
{
  float v[3];
  if (calCurveProblem(s, c) || !calFixedPoints(s, c, v)) return;
  portENTER_CRITICAL(&gCalMux);
  if (s == CAL_PH)
  {
    phCurve = c; phCalibrated = true;
    ph4PinVolts = v[0]; ph7PinVolts = v[1]; ph9PinVolts = v[2];
  }
  else
  {
    turbCurve = c; turbidityCalibrated = true;
    turbDIVolts = v[0]; turbTapVolts = v[1]; turbCloudyVolts = v[2];
  }
  portEXIT_CRITICAL(&gCalMux);
  calSaveFlash(s);
}

void calSetScalar(CalSensor s, float x, float y)
{
  portENTER_CRITICAL(&gCalMux);
  if (s == CAL_TDS) { tdsCalFactor = x; tdsRefPpm = y; tdsCalibrated = true; }
  else              { tempOffsetC = x;                 tempCalibrated = true; }
  portEXIT_CRITICAL(&gCalMux);
  calSaveFlash(s);
}

void calStoreSnap(CalSensor s, const CalSnap &z)
{
  if (s == CAL_PH || s == CAL_TURB) calSetCurve(s, z.c);
  else                              calSetScalar(s, z.x, z.y);
}

// ---------------- JSON IN (database download / import) ----------------

bool calParseParams(CalSensor s, JsonObjectConst p, CalSnap &z)
{
  if (s == CAL_PH || s == CAL_TURB)
  {
    JsonArrayConst a = p["points"].as<JsonArrayConst>();
    if (a.size() < 2 || a.size() > CAL_MAX_POINTS) return false;
    z.c.n = 0;
    for (JsonObjectConst pt : a)
    {
      if (!pt["ref"].is<float>() || !pt["v"].is<float>()) return false;
      z.c.p[z.c.n].ref   = pt["ref"].as<float>();
      z.c.p[z.c.n].volts = pt["v"].as<float>();
      z.c.n++;
    }
    calCanon(z.c);
    calSort(z.c);
    return calCurveProblem(s, z.c) == nullptr;
  }
  if (s == CAL_TDS)
  {
    if (!p["factor"].is<float>()) return false;
    z.x = calRound(p["factor"].as<float>(), 10000.0f);
    z.y = p["ref_ppm"].is<float>() ? calRound(p["ref_ppm"].as<float>(), 100.0f) : TDS_SUGGESTED_PPM;
    return isfinite(z.x) && isfinite(z.y) && z.x > TDS_FACTOR_MIN && z.x < TDS_FACTOR_MAX && fabsf(z.y - TDS_CAL_TARGET_PPM) < 0.01f;
  }
  if (!p["offset_c"].is<float>()) return false;
  z.x = calRound(p["offset_c"].as<float>(), 10000.0f);
  return fabsf(z.x) < TEMP_OFFSET_LIMIT_C;
}

// {"calibrations":[{"category":"pH","parameters":{...}}, ...]}
// fromServer = true : database data. Skipped when you changed that sensor here and it is
//                     not uploaded yet; adopted when nothing is calibrated or only the database changed.
// fromServer = false: a manual JSON import. Always applied and saved locally.
uint8_t calApplyDocument(const char *json, bool fromServer)
{
  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok)
  {
    Serial.println("[calibration] data is not valid JSON - ignored.");
    return 0;
  }

  uint8_t applied = 0;
  for (JsonObjectConst e : doc["calibrations"].as<JsonArrayConst>())
  {
    const char *cat = e["category"] | "";
    int idx = -1;
    for (uint8_t i = 0; i < CAL_COUNT; i++) if (strcmp(cat, CAL_CATEGORY[i]) == 0) idx = i;
    if (idx < 0) continue;
    CalSensor s = (CalSensor)idx;

    CalSnap cand = {};
    cand.ok = true;
    if (!calParseParams(s, e["parameters"].as<JsonObjectConst>(), cand))
    {
      Serial.printf("[calibration] %s: invalid values in the data - ignored.\n", cat);
      continue;
    }

    uint32_t serverSig = calSigOf(s, cand);
    uint32_t localSig = 0;
    bool hasLocal = calSignature(s, localSig);

    if (fromServer)
    {
      if (hasLocal && localSig == serverSig) { gCalSentSig[s] = serverSig; gCalSigDirty = true; continue; }   // already identical
      if (hasLocal && localSig != gCalSentSig[s]) continue;                                                 // preserve local calibration that the server has not confirmed
    }

    calStoreSnap(s, cand);
    if (fromServer) { gCalSentSig[s] = serverSig; gCalSigDirty = true; }
    Serial.printf("[calibration] %s: %s\n", cat, fromServer ? "updated from the database" : "imported locally");
    applied++;
  }
  return applied;
}

// ---------------- LOAD ----------------

bool calLoadCurve(const char *key, CalSensor s, CalCurve &out)
{
  if (prefs.getBytesLength(key) != sizeof(CalCurve)) return false;
  CalCurve c;
  prefs.getBytes(key, &c, sizeof(c));
  if (c.n > CAL_MAX_POINTS) return false;
  calSort(c);
  if (calCurveProblem(s, c)) return false;
  out = c;
  return true;
}


bool calSensorOK(CalSensor s)
{
  switch (s) { case CAL_PH: return phSensorOK; case CAL_TDS: return tdsSensorOK; case CAL_TURB: return turbSensorOK; default: return tempSensorOK; }
}

void calPrintOne(CalSensor s)
{
  Serial.printf("  %-11s ", CAL_CATEGORY[s]);
  if (!calSensorOK(s)) { Serial.println("SENSOR FAULT"); return; }

  uint32_t sig = 0;
  if (!calSignature(s, sig))
  {
    Serial.println(s == CAL_TDS ? "not calibrated (legacy factor 0.000; calibrate before use)" : s == CAL_TEMP ? "not calibrated (offset 0.00 C)" : "NOT CALIBRATED");
    return;
  }

  if (s == CAL_PH || s == CAL_TURB)
  {
    const CalCurve &c = (s == CAL_PH) ? phCurve : turbCurve;
    Serial.printf("%u points:", c.n);
    for (uint8_t i = 0; i < c.n; i++) Serial.printf("  %.2f @ %.3f V", c.p[i].ref, c.p[i].volts);
  }
  else if (s == CAL_TDS) Serial.printf("factor %.4f (standard %.0f ppm)", tdsCalFactor, tdsRefPpm);
  else                   Serial.printf("offset %+.2f C", tempOffsetC);

  Serial.println(gCalSentSig[s] == sig ? "   [in database]" : "   [local; calibration upload unavailable]");
}

void printCalibrationStatus()
{
  Serial.println("\n----- Calibration -----");
  for (uint8_t i = 0; i < CAL_COUNT; i++) calPrintOne((CalSensor)i);
  Serial.println("-----------------------");
}

// A working pH or turbidity sensor has no calibration
bool calibrationMissing()
{
  return (phSensorOK && !phCalibrated) || (turbSensorOK && !turbidityCalibrated);
}

void loadCalibration()
{
  prefs.begin("waterfw", false);
  ph4PinVolts = prefs.getFloat("ph4pin", NAN);
  ph7PinVolts = prefs.getFloat("ph7pin", NAN);
  ph9PinVolts = prefs.getFloat("ph9pin", NAN);
  turbDIVolts = prefs.getFloat("turb_di", NAN);
  turbTapVolts = prefs.getFloat("turb_tap", NAN);
  turbCloudyVolts = prefs.getFloat("turb_cld", NAN);
  if (!(ph4PinVolts > 0.01f && ph4PinVolts < 3.3f)) ph4PinVolts = NAN;
  if (!(ph7PinVolts > 0.01f && ph7PinVolts < 3.3f)) ph7PinVolts = NAN;
  if (!(ph9PinVolts > 0.01f && ph9PinVolts < 3.3f)) ph9PinVolts = NAN;
  if (!(turbDIVolts > TURB_MIN_MODULE_V && turbDIVolts < TURB_MAX_MODULE_V)) turbDIVolts = NAN;
  if (!(turbTapVolts > TURB_MIN_MODULE_V && turbTapVolts < TURB_MAX_MODULE_V)) turbTapVolts = NAN;
  if (!(turbCloudyVolts > TURB_MIN_MODULE_V && turbCloudyVolts < TURB_MAX_MODULE_V)) turbCloudyVolts = NAN;

  CalCurve c;
  bool legacyPH = prefs.isKey("ph4pin") || prefs.isKey("ph7pin") || prefs.isKey("ph9pin");
  bool legacyTurb = prefs.isKey("turb_di") || prefs.isKey("turb_tap") || prefs.isKey("turb_cld");
  if (!legacyPH && calLoadCurve("ph_curve", CAL_PH, c)) calSetCurve(CAL_PH, c);
  if (!legacyTurb && calLoadCurve("tb_curve", CAL_TURB, c)) calSetCurve(CAL_TURB, c);
  if ((!legacyPH && prefs.isKey("ph_curve") && !phCalibrated) ||
      (!legacyTurb && prefs.isKey("tb_curve") && !turbidityCalibrated))
    Serial.println("Saved flexible curve is incompatible with final2.3 references; kept in flash. Recalibrate or import a legacy file.");

  float f = prefs.getFloat(prefs.isKey("tds_factor") ? "tds_factor" : "tds_f", NAN);
  if (isfinite(f) && f > TDS_FACTOR_MIN && f < TDS_FACTOR_MAX)
  {
    tdsCalFactor = f; tdsCalibrated = true;
    tdsRefPpm = prefs.isKey("tds_factor") ? TDS_CAL_TARGET_PPM : prefs.getFloat("tds_ref", TDS_CAL_TARGET_PPM);
  }
  float o = prefs.getFloat(prefs.isKey("temp_offset") ? "temp_offset" : "tmp_off", NAN);
  if (isfinite(o) && fabsf(o) < TEMP_OFFSET_LIMIT_C) { tempOffsetC = o; tempCalibrated = true; }
  refreshCalFlags();
  char k[8];
  for (uint8_t i = 0; i < CAL_COUNT; i++) { snprintf(k, sizeof k, "sig%u", i); gCalSentSig[i] = prefs.getUInt(k, 0); }
  printCalibrationStatus();
}

// ---------------- BACKGROUND SERVICE (called from networkService) ----------------

void calibrationSyncService()
{
  if (gCalDownloadReady && !gCalBusy && !gCalSerialBusy)
  {
    calApplyDocument(gCalDownload, true);
    gCalDownloadReady = false;
  }

  if (gCalSigDirty)
  {
    gCalSigDirty = false;
    char k[8];
    for (uint8_t i = 0; i < CAL_COUNT; i++) { snprintf(k, sizeof k, "sig%u", i); prefs.putUInt(k, gCalSentSig[i]); }
  }
}

void calibrationSyncNow()
{
  if (config::kApiCalibrationPath[0] == '\0') { Serial.println("Database sync is off: kApiCalibrationPath is empty in net_config.h."); return; }
  if (!gWifi.isConnected())                   { Serial.println("Wi-Fi is not connected (yet), so the database cannot be reached."); return; }
  gCalSyncRequest = true;
  Serial.println("Checking the database now. Local calibration stays in flash; reading uploads do not upload it.");
}

// Raw preview units match capture: pH at GPIO, turbidity/TDS at module, temperature raw C.
bool calReadLive(CalSensor s)
{
  CalLiveSample sample;
  if (calSensorOK(s))
  {
    if (s == CAL_TEMP)
    {
      ds18b20.requestTemperatures();
      float t = ds18b20.getTempCByIndex(0);
      sample.valid = t != DEVICE_DISCONNECTED_C && isfinite(t);   // only "no sensor answered" counts as no data
      sample.value = sample.valid ? t : NAN;
      temperatureConnected = sample.valid;
      rawTemperatureC = sample.value;
      temperatureC = sample.valid ? t + tempOffsetC : NAN;
    }
    else
    {
      AnalogReading r = readAnalog(s == CAL_PH ? PH_PIN : s == CAL_TURB ? TURB_PIN : TDS_PIN);
      float multiplier = s == CAL_TURB ? TURB_DIVIDER_MULTIPLIER : s == CAL_TDS ? TDS_DIVIDER_MULTIPLIER : 1.0f;
      sample.value = r.pinVolts * multiplier;       // exactly what the sensor reads, 0 included
      sample.valid = isfinite(sample.value);
    }
  }
  sample.atMs = millis();
  gCalLiveSamples[s] = sample;
  return sample.valid;
}

void calDisplayLive(CalSensor s, bool phone)
{
  const CalLiveSample &sample = gCalLiveSamples[s];
  const char *units = s == CAL_TEMP ? "C raw" : s == CAL_PH ? "V GPIO" : "V module";
  char line[32], padded[21];
  if (sample.valid) snprintf(line, sizeof line, "Live: %.3f %s", sample.value, units);
  else snprintf(line, sizeof line, "Live: NO SENSOR DATA");
  Serial.printf("  live %s: %s\n", CAL_CATEGORY[s], line + 6);
  if (phone)
  {
    lcd.setCursor(0, 0); lcd.print("BLUETOOTH CAL       ");
    snprintf(padded, sizeof padded, "%-20.20s", CAL_CATEGORY[s]);
    lcd.setCursor(0, 1); lcd.print(padded);
    lcd.setCursor(0, 3); lcd.print("Capture on phone    ");
  }
  snprintf(padded, sizeof padded, "%-20.20s", line);
  lcd.setCursor(0, 2); lcd.print(padded);
}

void calTemperatureLiveIdle()
{
  gCalLiveSerialSensor = CAL_TEMP;
  if (millis() - gCalLiveSamples[CAL_TEMP].atMs < CAL_LIVE_INTERVAL_MS) return;
  calReadLive(CAL_TEMP);
  calDisplayLive(CAL_TEMP, false);
}

// ---------------- MANUAL CALIBRATION (serial) ----------------

struct CalBusyGuard
{
  CalBusyGuard() { gCalSerialBusy = true; }
  ~CalBusyGuard() { gCalSerialBusy = false; gCalLiveSerialSensor = -1; }
};

void calFlushInput() { while (Serial.available()) { Serial.read(); delay(2); } }

void calLcd(const char *l1, const char *l2)
{
  lcd.clear(); lcd.setCursor(0, 0); lcd.print(l1); lcd.setCursor(0, 1); lcd.print(l2);
}

// One typed line (Enter). false = timeout or ESC. Wi-Fi keeps running while waiting.
bool calReadLine(char *buf, size_t cap, bool allowEmpty = false, void (*onIdle)() = nullptr)
{
  size_t len = 0;
  uint32_t last = millis();
  while (millis() - last < CAL_INPUT_TIMEOUT_MS)
  {
    networkService();
    if (onIdle) onIdle();
    while (Serial.available())
    {
      int c = Serial.read();
      last = millis();
      if (c == KEY_ESC) { calFlushInput(); return false; }
      if (c == '\r' || c == '\n')
      {
        delay(5);                                                    // swallow the second half of CR+LF
        if (Serial.available() && (Serial.peek() == '\r' || Serial.peek() == '\n')) Serial.read();
        if (len || allowEmpty) { buf[len] = '\0'; return true; }
        continue;
      }
      if (len + 1 < cap) buf[len++] = (char)c;
    }
    delay(2);
  }
  return false;
}

// One averaged ADC capture, matching final2.3; the sketch averages SAMPLE_COUNT samples.
bool calCaptureVolts(CalSensor s, float &volts, float &spread)
{
  if (!calReadLive(s)) return false;
  volts = gCalLiveSamples[s].value;
  spread = 0.0f;
  return true;
}

// Replaces the point measured with the same standard, otherwise adds one.
bool calAddPoint(CalSensor s, CalCurve &c, float ref, float volts)
{
  const float refs[2][3] = {{4.01f, 6.86f, 9.18f}, {TURB_NTU_DI, TURB_NTU_TAP, TURB_NTU_CLOUDY}};
  bool allowed = false;
  for (uint8_t j = 0; j < 3; j++)
    if (isfinite(ref) && fabsf(ref - refs[s == CAL_PH ? 0 : 1][j]) < 0.00005f) { ref = refs[s == CAL_PH ? 0 : 1][j]; allowed = true; }
  if (!allowed || !isfinite(volts) || c.n > 3) return false;
  for (uint8_t i = 0; i < c.n; i++)
    if (fabsf(c.p[i].ref - ref) < 0.00005f) { c.p[i].volts = volts; calSort(c); return true; }
  if (c.n == 3) return false;
  c.p[c.n++] = {ref, volts};
  calSort(c);
  return true;
}


bool phPointsValid()
{
  if (!isfinite(ph4PinVolts) || !isfinite(ph7PinVolts) || !isfinite(ph9PinVolts)) return false;

  float d4 = ph4PinVolts - ph7PinVolts;
  float d9 = ph9PinVolts - ph7PinVolts;

  return fabsf(d4) >= PH_MIN_POINT_GAP_V &&
         fabsf(d9) >= PH_MIN_POINT_GAP_V &&
         ((d4 > 0.0f) != (d9 > 0.0f));
}

bool turbidityPointsValid()
{
  if (!isfinite(turbDIVolts) || !isfinite(turbTapVolts) || !isfinite(turbCloudyVolts)) return false;

  return (turbDIVolts - turbCloudyVolts) >= TURB_MIN_SPAN_V &&
         turbTapVolts <= turbDIVolts + 0.10f &&                  // tap far ABOVE DI = bad DI reading
         turbTapVolts >= turbCloudyVolts - TURB_MIN_SPAN_V;      // tap far BELOW cloudy = bad reading
}

bool phSetInconsistent()
{
  return isfinite(ph4PinVolts) && isfinite(ph7PinVolts) && isfinite(ph9PinVolts) && !phPointsValid();
}

bool turbSetInconsistent()
{
  return isfinite(turbDIVolts) && isfinite(turbTapVolts) && isfinite(turbCloudyVolts) && !turbidityPointsValid();
}

struct CalItem
{
  const char *key;    // flash key AND key used in the export file
  float      *var;    // where the value lives
  float       lo;     // accepted range (exclusive)
  float       hi;
  bool       *flag;   // set when loaded/imported (nullptr: "saved" simply means finite)
};

CalItem calItems[] =
{
  { "ph4pin",      &ph4PinVolts,     0.01f,   3.3f, nullptr        },
  { "ph7pin",      &ph7PinVolts,     0.01f,   3.3f, nullptr        },
  { "ph9pin",      &ph9PinVolts,     0.01f,   3.3f, nullptr        },
  { "turb_di",     &turbDIVolts,     TURB_MIN_MODULE_V, TURB_MAX_MODULE_V, nullptr },
  { "turb_tap",    &turbTapVolts,    TURB_MIN_MODULE_V, TURB_MAX_MODULE_V, nullptr },
  { "turb_cld",    &turbCloudyVolts, TURB_MIN_MODULE_V, TURB_MAX_MODULE_V, nullptr },
  { "tds_factor",  &tdsCalFactor,    0.1f,    3.0f, &tdsCalibrated },
  { "temp_offset", &tempOffsetC,   -TEMP_OFFSET_LIMIT_C, TEMP_OFFSET_LIMIT_C, &tempCalibrated },
};

constexpr uint8_t CAL_ITEM_COUNT = sizeof(calItems) / sizeof(calItems[0]);

bool calItemInRange(const CalItem &c, float v)
{
  return isfinite(v) && v > c.lo && v < c.hi;
}

bool calItemSaved(const CalItem &c)
{
  return c.flag ? *c.flag : isfinite(*c.var);
}

// Recompute the "complete set" flags after values changed
void refreshCalFlags()
{
  phCalibrated = phPointsValid();
  turbidityCalibrated = turbidityPointsValid();
  if (phCalibrated)
  {
    CalCurve c = {3, {{4.01f, ph4PinVolts}, {6.86f, ph7PinVolts}, {9.18f, ph9PinVolts}}};
    calSort(c); calSetCurve(CAL_PH, c);
  }
  if (turbidityCalibrated)
  {
    CalCurve c = {3, {{TURB_NTU_DI, turbDIVolts}, {TURB_NTU_TAP, turbTapVolts}, {TURB_NTU_CLOUDY, turbCloudyVolts}}};
    calSort(c); calSetCurve(CAL_TURB, c);
  }
}


// ---------------- pH CALIBRATION ----------------

bool capturePHPoint(float targetPH, const char* label, const char* prefKey, float &storageVar)
{
  if (!phSensorOK)
  {
    Serial.println("ERROR: pH sensor failed POST - calibration unavailable.");
    return false;
  }

  Serial.printf("\nCapturing pH %.2f reference (%s)...\n", targetPH, label);

  AnalogReading r = readAnalog(PH_PIN);


  storageVar = r.pinVolts;
  prefs.putFloat(prefKey, storageVar);

  refreshCalFlags();
  if (phSetInconsistent())
  {
    Serial.println("WARNING: pH points are inconsistent (wrong buffer, or points too close together).");
  }

  Serial.printf("pH %.2f reference saved.\n", targetPH);
  Serial.printf("Raw ADC: %d | GPIO Voltage: %.3f V\n", r.raw, r.pinVolts);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("pH Cal Target:");
  lcd.setCursor(0, 1);
  lcd.print(label);
  lcd.setCursor(0, 2);
  lcd.print("Saved successfully");
  delay(1200);
  return true;
}

// ---------------- TURBIDITY CALIBRATION ----------------

bool captureTurbidityPoint(const char* label, const char* prefKey, float &storageVar)
{
  if (!turbSensorOK)
  {
    Serial.println("ERROR: Turbidity sensor failed POST - calibration unavailable.");
    return false;
  }

  Serial.printf("\nCapturing Turbidity point: %s...\n", label);

  AnalogReading r = readAnalog(TURB_PIN);


  float moduleVolts = r.pinVolts * TURB_DIVIDER_MULTIPLIER;

  if (moduleVolts > TURB_MAX_MODULE_V || moduleVolts < TURB_MIN_MODULE_V)
  {
    // Saved as read. Only a note, in case the wiring or divider is wrong.
    Serial.printf("NOTE: module voltage %.3f V is outside the usual %.2f-%.2f V range; saved as read.\n",
                  moduleVolts, TURB_MIN_MODULE_V, TURB_MAX_MODULE_V);
  }

  storageVar = moduleVolts;
  prefs.putFloat(prefKey, storageVar);

  refreshCalFlags();
  if (turbSetInconsistent())
  {
    Serial.printf("WARNING: turbidity points are inconsistent: cloudy must read at least %.2f V\n", TURB_MIN_SPAN_V);
    Serial.println("below clear water. If it doesn't move, the sensor isn't responding (check the");
    Serial.println("A pin, cable and supply) or the cloudy sample isn't cloudy enough.");
  }

  Serial.printf("Turbidity [%s] saved.\n", label);
  Serial.printf("Raw ADC: %d | GPIO: %.3f V | Module Volts: %.3f V\n",
                r.raw, r.pinVolts, storageVar);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Turbidity Cal:");
  lcd.setCursor(0, 1);
  lcd.print(label);
  lcd.setCursor(0, 2);
  lcd.print("Saved successfully");
  delay(1200);
  return true;
}

// ---------------- TDS CALIBRATION (1382 PPM) ----------------

bool captureTDSCalibration()
{
  if (!tdsSensorOK)
  {
    Serial.println("ERROR: TDS sensor failed POST - calibration unavailable.");
    return false;
  }

  Serial.println("\nCapturing TDS 1382 ppm solution reference...");

  AnalogReading r = readAnalog(TDS_PIN);


  float moduleVolts = r.pinVolts;
  float temp = temperatureConnected ? temperatureC : 25.0f;
  float compensation = 1.0f + 0.02f * (temp - 25.0f);

  if (compensation <= 0.1f) 
  {
    Serial.println("ERROR: Temperature compensation out of bounds.");
    return false;
  }

  float vComp = moduleVolts / compensation;

  float rawPPM = (133.42f * vComp * vComp * vComp
                  - 255.86f * vComp * vComp
                  + 857.39f * vComp) * 0.5f;

  if (rawPPM <= 1.0f) 
  {
    Serial.printf("ERROR: the probe reads %.1f ppm, so no calibration factor can be worked out. Is it in the 1382 ppm solution?\n", rawPPM);
    return false;
  }

  float factor = TDS_CAL_TARGET_PPM / rawPPM;
  if (!isfinite(factor) || factor <= TDS_FACTOR_MIN || factor >= TDS_FACTOR_MAX)
  {
    Serial.println("ERROR: TDS factor outside the saved calibration range. Not saved.");
    return false;
  }
  calSetScalar(CAL_TDS, factor, TDS_CAL_TARGET_PPM);

  Serial.println("TDS 1382 ppm calibration successful!");
  Serial.printf("Uncorrected PPM: %.1f | Cal Factor: %.3f\n", rawPPM, tdsCalFactor);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("TDS Calibration");
  lcd.setCursor(0, 1);
  lcd.print("Target: 1382 ppm");
  lcd.setCursor(0, 2);
  lcd.print("Saved successfully");
  delay(1200);
  return true;
}

// ---------------- TEMPERATURE CALIBRATION ----------------

bool captureTemperatureCalibration()
{
  if (!tempSensorOK) { Serial.println("ERROR: Temperature sensor failed POST."); return false; }
  Serial.println("\nEnter reference thermometer C (-10 to 100), then Enter; Q cancels.");
  Serial.println("Live raw temperature continues while you enter the reference.");
  calFlushInput();
  char input[24];
  if (!calReadLine(input, sizeof input, false, calTemperatureLiveIdle) ||
      ((input[0] == 'q' || input[0] == 'Q') && input[1] == '\0')) return false;
  char *end;
  float target = strtof(input, &end);
  bool numeric = end != input;
  while (*end == ' ' || *end == '\t') end++;
  if (!numeric || *end != '\0' || !isfinite(target) || target < -10.0f || target > 100.0f)
  {
    Serial.println("ERROR: Enter one valid reference temperature."); return false;
  }
  if (!calReadLive(CAL_TEMP)) { Serial.println("ERROR: the temperature sensor is not responding. Nothing saved."); return false; }
  float offset = target - gCalLiveSamples[CAL_TEMP].value;
  if (!isfinite(offset) || fabsf(offset) >= TEMP_OFFSET_LIMIT_C)
  {
    Serial.println("ERROR: Offset outside calibration limit. Nothing saved."); return false;
  }
  calSetScalar(CAL_TEMP, offset, 0.0f);
  temperatureC = rawTemperatureC + tempOffsetC;
  Serial.printf("Temperature offset saved: %+.2f C; corrected %.2f C\n", offset, temperatureC);
  lcd.setCursor(0, 2); lcd.print("Temperature saved   ");
  return true;
}

// ---------------- EXPORT / IMPORT ----------------
//
// The calibration travels as plain text:
//
//   ---BEGIN WATER CAL---
//   v=1
//   ph4pin=1.234567
//   ...
//   ---END WATER CAL---
//
// Save the block in a .txt file (waterlog.py export does it for you) and send
// it back later (waterlog.py import FILE, or paste it into a serial terminal).

constexpr const char *CAL_BEGIN_LINE = "---BEGIN WATER CAL---";
constexpr const char *CAL_END_LINE   = "---END WATER CAL---";

void exportCalibration()
{
  Serial.println("\n===== EXPORT CALIBRATION =====");

  uint8_t count = 0;
  for (uint8_t i = 0; i < CAL_ITEM_COUNT; i++)
  {
    if (calItemSaved(calItems[i])) count++;
  }

  if (count == 0)
  {
    Serial.println("Nothing to export - nothing is calibrated yet.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Nothing to export");
    delay(1500);
    return;
  }

  Serial.println("Copy everything from BEGIN to END into a text file, or run:  python waterlog.py export");
  Serial.println(CAL_BEGIN_LINE);
  Serial.println("v=1");
  for (uint8_t i = 0; i < CAL_ITEM_COUNT; i++)
  {
    const CalItem &c = calItems[i];
    if (calItemSaved(c)) Serial.printf("%s=%.6f\n", c.key, *c.var);
  }
  Serial.println(CAL_END_LINE);
  Serial.printf("Exported %u values.\n", (unsigned)count);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Calibration");
  lcd.setCursor(0, 1);
  lcd.print("exported to serial");
  delay(1500);
}

// Removes leading/trailing whitespace in place and returns the start of the text
char *trimInPlace(char *s)
{
  while (*s == ' ' || *s == '\t') s++;
  size_t n = strlen(s);
  while (n > 0 && (s[n - 1] == ' ' || s[n - 1] == '\t')) s[--n] = '\0';
  return s;
}

// Reads one line from serial (without the line ending).
// Returns 1 = got a line, 0 = timed out with nothing, -1 = ESC pressed.
// timeoutMs is the allowed silence; it restarts with every received character.
int readLine(char *buf, size_t cap, uint32_t timeoutMs)
{
  size_t n = 0;
  uint32_t last = millis();

  while (millis() - last < timeoutMs)
  {
    int k = pollKey();
    if (k < 0) { delay(2); continue; }

    last = millis();
    if (k == KEY_ESC) return -1;
    if (k == '\r') continue;
    if (k == '\n') { buf[n] = '\0'; return 1; }
    if (n < cap - 1) buf[n++] = (char)k;
  }

  buf[n] = '\0';
  return n > 0 ? 1 : 0;   // a last line without a line ending still counts
}

// All-or-nothing: the file must arrive complete (BEGIN ... END) before anything is changed.
bool importCalibration()
{
  if (gCalBusy) { Serial.println("Finish or clear the pending Bluetooth calibration first."); return false; }
  CalBusyGuard busy;
  Serial.println("\n===== IMPORT CALIBRATION =====");
  Serial.println("Send the saved calibration file now: paste it into the serial terminal,");
  Serial.println("or run:  python waterlog.py import calibration.txt");
  Serial.printf("Waiting up to %lu s. ESC cancels.\n", (unsigned long)(IMPORT_WAIT_MS / 1000));
  Serial.println(">>> SEND FILE NOW");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("IMPORT CALIBRATION");
  lcd.setCursor(0, 1);
  lcd.print("Send file via serial");
  lcd.setCursor(0, 3);
  lcd.print("ESC = cancel");

  char line[64];

  // 1) wait for the BEGIN line (anything before it is ignored)
  bool begun = false;
  uint32_t t0 = millis();
  while (millis() - t0 < IMPORT_WAIT_MS)
  {
    int r = readLine(line, sizeof(line), 1000);
    if (r < 0) { Serial.println("Import cancelled."); return false; }
    if (r == 0) continue;
    if (strcmp(trimInPlace(line), CAL_BEGIN_LINE) == 0) { begun = true; break; }
  }
  if (!begun)
  {
    Serial.println("IMPORT FAILED: no calibration data received.");
    return false;
  }

  // 2) collect key=value lines until END
  float   newVal[CAL_ITEM_COUNT];
  bool    got[CAL_ITEM_COUNT] = { false };
  uint8_t rejected = 0;
  bool    ended = false;

  for (uint8_t n = 0; n < 40 && !ended; n++)
  {
    int r = readLine(line, sizeof(line), IMPORT_LINE_TIMEOUT_MS);
    if (r < 0) { Serial.println("Import cancelled. Nothing was changed."); return false; }
    if (r == 0) break;   // silence: file is incomplete

    char *text = trimInPlace(line);
    if (*text == '\0' || *text == '#') continue;

    if (strcmp(text, CAL_END_LINE) == 0) { ended = true; break; }

    char *eq = strchr(text, '=');
    if (!eq) { rejected++; continue; }
    *eq = '\0';
    char *key = trimInPlace(text);
    char *val = trimInPlace(eq + 1);

    if (strcmp(key, "v") == 0) continue;   // file format version

    int idx = -1;
    for (uint8_t i = 0; i < CAL_ITEM_COUNT; i++)
    {
      if (strcmp(key, calItems[i].key) == 0) { idx = i; break; }
    }

    char *endp = nullptr;
    float v = strtof(val, &endp);
    bool numeric = (endp != val) && (*endp == '\0');

    if (idx < 0 || !numeric || !calItemInRange(calItems[idx], v))
    {
      Serial.printf("  rejected: %s=%s\n", key, val);
      rejected++;
      continue;
    }

    newVal[idx] = v;
    got[idx] = true;
  }

  if (!ended)
  {
    Serial.println("IMPORT FAILED: file incomplete (no END line). Nothing was changed.");
    return false;
  }

  // 3) apply and save
  uint8_t applied = 0;
  for (uint8_t i = 0; i < CAL_ITEM_COUNT; i++)
  {
    if (!got[i]) continue;
    const CalItem &c = calItems[i];

    *c.var = newVal[i];
    prefs.putFloat(c.key, newVal[i]);
    if (c.flag) *c.flag = true;
    applied++;
  }

  if (applied == 0)
  {
    Serial.println("IMPORT FAILED: no valid values in the file.");
    return false;
  }

  refreshCalFlags();
  if (got[6]) calSetScalar(CAL_TDS, tdsCalFactor, TDS_CAL_TARGET_PPM);
  if (got[7]) calSetScalar(CAL_TEMP, tempOffsetC, 0.0f);
  Serial.printf("IMPORT OK: %u values saved, %u rejected.\n", (unsigned)applied, (unsigned)rejected);
  printCalibrationStatus();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Import OK");
  lcd.setCursor(0, 1);
  lcd.print(applied);
  lcd.print(" values saved");
  delay(1500);
  return true;
}

// ---------------- STARTUP CALIBRATION WIZARD ----------------

// true if this step already has a saved calibration
bool stepAlreadyDone(CalStep s)
{
  switch (s) {
    case STEP_TEMP:     return tempCalibrated;
    case STEP_PH4:      return isfinite(ph4PinVolts)     && !phSetInconsistent();
    case STEP_PH7:      return isfinite(ph7PinVolts)     && !phSetInconsistent();
    case STEP_PH9:      return isfinite(ph9PinVolts)     && !phSetInconsistent();
    case STEP_TURB_DI:  return isfinite(turbDIVolts)     && !turbSetInconsistent();
    case STEP_TURB_TAP: return isfinite(turbTapVolts)    && !turbSetInconsistent();
    case STEP_TURB_CLD: return isfinite(turbCloudyVolts) && !turbSetInconsistent();
    case STEP_TDS:      return tdsCalibrated;
    default:            return true;
  }
}

// true if the sensor behind this step failed POST (the wizard skips it)
bool stepSensorFailed(CalStep s)
{
  switch (s) {
    case STEP_TEMP:     return !tempSensorOK;
    case STEP_PH4:
    case STEP_PH7:
    case STEP_PH9:      return !phSensorOK;
    case STEP_TURB_DI:
    case STEP_TURB_TAP:
    case STEP_TURB_CLD: return !turbSensorOK;
    case STEP_TDS:      return !tdsSensorOK;
    default:            return false;
  }
}

// does the wizard have to ask for this step?
bool stepNeeded(CalStep s, bool onlyMissing)
{
  return !stepSensorFailed(s) && (!onlyMissing || !stepAlreadyDone(s));
}

// texts below are kept to 20 characters so they fit the LCD
const char* stepTitle(CalStep s)
{
  switch (s)
   {
    case STEP_TEMP:     return "Temperature offset";
    case STEP_PH4:      return "pH 4.01 buffer";
    case STEP_PH7:      return "pH 6.86 buffer";
    case STEP_PH9:      return "pH 9.18 buffer";
    case STEP_TURB_DI:  return "Turbidity: DI water";
    case STEP_TURB_TAP: return "Turbidity: tap water";
    case STEP_TURB_CLD: return "Turbidity: cloudy";
    case STEP_TDS:      return "TDS 1382 ppm soln";
    default:            return "";
  }
}

const char* stepHint(CalStep s)
{
  switch (s) 
  {
    case STEP_TEMP:     return "Need ref thermometer";
    case STEP_PH4:
    case STEP_PH7:
    case STEP_PH9:      return "Probe in this buffer";
    case STEP_TURB_DI:  return "Sensor in DI water";
    case STEP_TURB_TAP: return "Sensor in tap water";
    case STEP_TURB_CLD: return "Use cloudy reference";
    case STEP_TDS:      return "Probe in 1382 soln";
    default:            return "";
  }
}

// Shows the live signal so you can see when it has settled
void printLiveValue(CalStep s)
{
  CalSensor sensor = s == STEP_TEMP ? CAL_TEMP : s == STEP_TDS ? CAL_TDS :
                     s >= STEP_TURB_DI && s <= STEP_TURB_CLD ? CAL_TURB : CAL_PH;
  gCalLiveSerialSensor = sensor;
  calReadLive(sensor);
  calDisplayLive(sensor, false);
}

// Runs the capture function that belongs to a step
bool runCaptureStep(CalStep s)
{
  switch (s) 
  {
    case STEP_TEMP:     readAllSensors(); return captureTemperatureCalibration();
    case STEP_PH4:      return capturePHPoint(4.01f, "4.01 Buffer", "ph4pin", ph4PinVolts);
    case STEP_PH7:      return capturePHPoint(6.86f, "6.86 Buffer", "ph7pin", ph7PinVolts);
    case STEP_PH9:      return capturePHPoint(9.18f, "9.18 Buffer", "ph9pin", ph9PinVolts);
    case STEP_TURB_DI:  return captureTurbidityPoint("DI Water (0 NTU)", "turb_di", turbDIVolts);
    case STEP_TURB_TAP: return captureTurbidityPoint("Tap Water", "turb_tap", turbTapVolts);
    case STEP_TURB_CLD: return captureTurbidityPoint("Cloudy Water", "turb_cld", turbCloudyVolts);
    case STEP_TDS:      readAllSensors(); return captureTDSCalibration();
    default:            return true;
  }
}

// Shows one step, then waits for G (or Enter) = capture, S = skip, Q = quit
StepAction promptStep(CalStep s, uint8_t number, uint8_t total)
{
  Serial.printf("\n--- Step %d/%d: %s ---\n", (int)number, (int)total, stepTitle(s));
  Serial.printf("%s. Wait until the signal is stable, then:\n", stepHint(s));
  Serial.println("  G (or Enter) = capture   S = skip   Q or ESC = quit calibration");

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CAL STEP ");
  lcd.print(number);
  lcd.print("/");
  lcd.print(total);
  lcd.setCursor(0, 1);
  lcd.print(stepTitle(s));
  lcd.setCursor(0, 2);
  lcd.print(stepHint(s));
  lcd.setCursor(0, 3);
  lcd.print("G=go S=skip Q=quit");

  while (Serial.available()) Serial.read();   // drop leftovers

  printLiveValue(s);
  uint32_t lastLive = millis();
  while (true) 
  {
    int k = pollKey();
    if (k >= 0)
    {
      delay(100);                                // let the rest of the line arrive
      while (Serial.available()) Serial.read();  // so a trailing newline isn't read as the next answer

      if (k == KEY_ESC) return ACTION_QUIT;
      char c = (char)tolower(k);
      if (c == 'g' || c == '\r' || c == '\n') return ACTION_GO;
      if (c == 's') return ACTION_SKIP;
      if (c == 'q') return ACTION_QUIT;
      continue;                                  // any other key: ignore
    }

    if (millis() - lastLive >= CAL_LIVE_INTERVAL_MS) 
    {
      lastLive = millis();
      printLiveValue(s);
    }
    delay(10);
  }
}

// Walks through the calibration steps (only the missing ones when onlyMissing = true)
void runCalibrationWizard(bool onlyMissing)
{
  if (gCalBusy) { Serial.println("Finish or clear the pending Bluetooth calibration first."); return; }
  CalBusyGuard busy;
  Serial.println("\n===== STARTUP CALIBRATION =====");
  Serial.println(onlyMissing ? "Asking only for items that are not saved yet.": "Recalibrating all items.");
  Serial.println("Rinse the probe between solutions.");

  readAllSensors();   // first temperature reading (used by the temperature and TDS steps)

  // Decide once, up front: a step that turns "done" while the wizard runs (e.g. an
  // inconsistent pH set becoming consistent) must not make a later step get skipped.
  bool needed[STEP_COUNT];
  uint8_t total = 0;
  for (uint8_t i = 0; i < STEP_COUNT; i++) 
  {
    needed[i] = stepNeeded((CalStep)i, onlyMissing);
    if (needed[i]) total++;
  }

  if (total == 0)
  {
    Serial.println("Nothing to calibrate (everything is saved, or the sensors failed POST).");
    Serial.println("Use \"Recalibrate everything\" to redo saved items.");
    return;
  }

  uint8_t number = 0;
  for (uint8_t i = 0; i < STEP_COUNT; i++) 
  {
    CalStep s = (CalStep)i;
    if (stepSensorFailed(s))
    {
      Serial.printf("Skipping \"%s\": sensor failed POST.\n", stepTitle(s));
      continue;
    }
    if (!needed[i]) continue;
    number++;

    StepAction action;
    bool captured;
    do {
      action = promptStep(s, number, total);
      captured = (action == ACTION_GO) && runCaptureStep(s);
    } while (action == ACTION_GO && !captured);   // capture failed -> ask again

    if (action == ACTION_SKIP) Serial.println("Skipped.");
    if (action == ACTION_QUIT) {
      Serial.println("Calibration stopped by user.");
      break;
    }
  }

  Serial.println("\n===== CALIBRATION FINISHED =====");
  printCalibrationStatus();

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Calibration done");
  lcd.setCursor(0, 1);
  lcd.print("pH:   ");
  lcd.print(!phSensorOK ? "SENSOR FAULT" : (phCalibrated ? "saved" : "MISSING"));
  lcd.setCursor(0, 2);
  lcd.print("Turb: ");
  lcd.print(!turbSensorOK ? "SENSOR FAULT" : (turbidityCalibrated ? "saved" : "MISSING"));
  lcd.setCursor(0, 3);
  lcd.print("Back to menu...");
  delay(2000);
}