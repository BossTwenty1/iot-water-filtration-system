#pragma once

//  BLUETOOTH CONTROL (phone app "Water Monitor Control")
//
//  A Nordic-UART-style Bluetooth LE service. Both directions carry JSON lines ending in '\n'.
//  Everything runs in the MAIN task (bleService() is called from networkService()), so it can
//  safely use the calibration and Wi-Fi code; the Bluetooth callbacks only move bytes.
//
//  PIN: nothing works until the phone sends {"c":"auth","pin":"..."} with BLE_PIN (secrets.h).
//  3 wrong tries lock it for 30 s. An empty BLE_PIN keeps Bluetooth control locked.
//
//  Phone -> board (write)                     Board -> phone (notify)
//    {"c":"auth","pin"}                         {"t":"auth","ok","need","lock","msg"}
//    {"c":"hello"}                              {"t":"hello","name","id","fw","pos"}
//    {"c":"wifi"}                               {"t":"wifi","state","ssid","ip","rssi","time"}
//    {"c":"wifi","ssid","pass","save"}          {"t":"ok"} / {"t":"err","msg"}
//    {"c":"wifi_off"} {"c":"wifi_forget"}       {"t":"ok"}
//    {"c":"scan"}                               {"t":"scan","n":[{"s","r","o"}]}
//    {"c":"live","s":"ph|turb|tds|temp"}        {"t":"live","s","v"}      (probe voltage)
//    {"c":"cal"}                                {"t":"cal","ph":{"ok","p":[[ref,V]],"q":[[ref,V]]},...}
//    {"c":"cap","s":"ph|turb|tds|temp","ref"}   {"t":"cap","s","ok","v","n","msg"}
//    {"c":"save","s":"ph|turb"}                 {"t":"ok"} / {"t":"err","msg"}   (curve -> flash)
//    {"c":"clear","s":"ph|turb"}                {"t":"ok"}
//    (every 2 s)                                {"t":"r","ph","tds","ntu","temp","flow","tot","s":{..}}
//
//  Calibration: pH / turbidity points are collected in a pending curve ("q") and only saved,
//  with final2.3 fixed-reference validity checks, when the phone sends "save". TDS and
//  temperature save immediately. TDS requires the 1382 ppm standard. While a pending curve exists, database downloads wait
//  (gCalBusy), so nothing changes under your hands.
//
//  Needs the library "NimBLE-Arduino" (Library Manager; v1.4.x or v2.x) and ArduinoJson v7.
//  Include in main.ino AFTER telemetry.h; call bleBegin() once in setup() and bleService()
//  from networkService() (forward-declare it before networkService).

#include <Arduino.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>
#include <WiFi.h>
#include <string>
#include "net_config.h"

#if __has_include(<NimBLEConnInfo.h>)
  #define BLE_NIMBLE_V2 1
#else
  #define BLE_NIMBLE_V2 0
#endif

#ifndef BLE_PIN
  #define BLE_PIN ""
#endif

#define BLE_SVC_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define BLE_RX_UUID  "6e400002-b5a3-f393-e0a9-e50e24dcca9e"   // phone writes here
#define BLE_TX_UUID  "6e400003-b5a3-f393-e0a9-e50e24dcca9e"   // board notifies here

constexpr size_t   BLE_CHUNK        = 20;      // works with the default 23-byte Bluetooth packet
constexpr uint32_t BLE_READ_EVERY   = 2000;
constexpr size_t   BLE_TX_LINES     = 24;

static NimBLECharacteristic *gBleTx = nullptr;
static volatile bool   gBleConnected = false;
static portMUX_TYPE    gBleMux = portMUX_INITIALIZER_UNLOCKED;
static std::string     gBleRx;                       // bytes from the phone (filled by the Bluetooth task)
static std::string     gBleTxQ[BLE_TX_LINES];        // lines waiting to go out (main task only)
static uint8_t         gBleTxHead = 0, gBleTxCount = 0;
static std::string     gBleSending;                  // line being sent in chunks
static size_t          gBleSendPos = 0;
static bool            gBleEditing[2] = {false, false};
static int             gBleLiveSensor = -1;
static uint32_t        gBleLastLiveMs = 0;
static std::string     gBleLine;
static CalCurve        gBlePend[2];                  // pending pH / turbidity curves
static bool            gBleAuthed = false, gBleLocked = false;
static uint8_t         gBleFails = 0;
static uint32_t        gBleLockUntil = 0;
static bool            gBleSaveWifi = false;         // remember the network once it connects
static char            gBleSsid[33], gBlePass[65];

// Live: existing command subscribes to 1 Hz raw preview; {"c":"live","s":"off"}
// stops it. Capture/clear also start preview. Save/disconnect stop it.
// Each pH/turbidity session collects three fresh points; clear never reloads saved points.
// Serial and Bluetooth can both display live data, but only one owns capture at a time.

// ---------------- sending ----------------

static void bleQueue(JsonDocument &d)
{
  if (!gBleConnected || gBleTxCount >= BLE_TX_LINES) return;
  std::string line;
  serializeJson(d, line);
  line += '\n';
  gBleTxQ[(gBleTxHead + gBleTxCount++) % BLE_TX_LINES] = line;
}

static void bleReply(const char *type, const char *msg = nullptr)
{
  JsonDocument d;
  d["t"] = type;
  if (msg) d["msg"] = msg;
  bleQueue(d);
}

// One chunk per call keeps the main loop fast and never floods the radio.
static void blePump()
{
  if (!gBleConnected || !gBleTx) return;
  if (gBleSendPos >= gBleSending.length())
  {
    if (!gBleTxCount) return;
    gBleSending = gBleTxQ[gBleTxHead];
    gBleTxQ[gBleTxHead].clear();
    gBleTxHead = (gBleTxHead + 1) % BLE_TX_LINES;
    gBleTxCount--;
    gBleSendPos = 0;
  }
  size_t n = min(BLE_CHUNK, gBleSending.length() - gBleSendPos);
  gBleTx->setValue((const uint8_t *)gBleSending.c_str() + gBleSendPos, n);
#if BLE_NIMBLE_V2
  if (!gBleTx->notify()) return; // retry this chunk when the stack cannot queue it yet
#else
  gBleTx->notify();             // v1 API returns void
#endif
  gBleSendPos += n;
}

// ---------------- helpers ----------------

static const char *bleStatus(bool sensorOK, float v, bool calibrated)
{
  if (!sensorOK) return "fault";
  if (isfinite(v)) return "ok";
  return calibrated ? "bad" : "uncal";
}

static bool bleSensor(const char *s, CalSensor &out)
{
  if (!strcmp(s, "ph"))   { out = CAL_PH;   return true; }
  if (!strcmp(s, "turb")) { out = CAL_TURB; return true; }
  if (!strcmp(s, "tds"))  { out = CAL_TDS;  return true; }
  if (!strcmp(s, "temp")) { out = CAL_TEMP; return true; }
  return false;
}

static const char *bleSensorName(CalSensor s)
{
  return s == CAL_PH ? "ph" : s == CAL_TURB ? "turb" : s == CAL_TDS ? "tds" : "temp";
}

static void bleStopLive()
{
  gBleLiveSensor = -1;
  gCalPhoneLive = false;
}

static void bleSendLive(CalSensor s)
{
  gBleLastLiveMs = millis();
  // The serial wizard owns capture; a phone can observe its current sensor.
  bool serialOther = gCalSerialBusy && gCalLiveSerialSensor != s;
  if (!gCalSerialBusy) { calReadLive(s); calDisplayLive(s, true); }
  const CalLiveSample &sample = gCalLiveSamples[s];
  bool fresh = !serialOther && sample.valid && millis() - sample.atMs <= CAL_LIVE_INTERVAL_MS + 1000;
  JsonDocument d;
  d["t"] = "live"; d["s"] = bleSensorName(s);
  if (fresh) d["v"] = sample.value; else d["v"] = nullptr;
  d["valid"] = fresh;
  if (serialOther) d["msg"] = "Serial wizard is previewing a different sensor.";
  bleQueue(d);
}

static void bleAddNum(JsonObject o, const char *k, float v) { if (isfinite(v)) o[k] = v; else o[k] = nullptr; }

static void bleSendReadings()
{
  JsonDocument d;
  d["t"] = "r";
  bleAddNum(d.as<JsonObject>(), "ph", phValue);
  bleAddNum(d.as<JsonObject>(), "tds", tdsPPM);
  bleAddNum(d.as<JsonObject>(), "ntu", turbidityNTU);
  bleAddNum(d.as<JsonObject>(), "temp", (tempSensorOK && temperatureConnected) ? temperatureC : NAN);
  bleAddNum(d.as<JsonObject>(), "flow", flowRateLMin);
  bleAddNum(d.as<JsonObject>(), "tot", totalLiters);
  JsonObject s = d["s"].to<JsonObject>();
  s["ph"]   = bleStatus(phSensorOK, phValue, phCalibrated);
  s["tds"]  = bleStatus(tdsSensorOK, tdsPPM, true);
  s["ntu"]  = bleStatus(turbSensorOK, turbidityNTU, turbidityCalibrated);
  s["temp"] = bleStatus(tempSensorOK, (tempSensorOK && temperatureConnected) ? temperatureC : NAN, true);
  s["flow"] = "ok";
  bleQueue(d);
}

static void bleAddPoints(JsonArray a, const CalCurve &c)
{
  for (uint8_t i = 0; i < c.n; i++) { JsonArray p = a.add<JsonArray>(); p.add(c.p[i].ref); p.add(c.p[i].volts); }
}

static void bleSendCal()
{
  JsonDocument d;
  d["t"] = "cal";
  JsonObject ph = d["ph"].to<JsonObject>();
  ph["ok"] = phCalibrated;   bleAddPoints(ph["p"].to<JsonArray>(), phCurve);   bleAddPoints(ph["q"].to<JsonArray>(), gBlePend[0]);
  JsonObject tb = d["turb"].to<JsonObject>();
  tb["ok"] = turbidityCalibrated; bleAddPoints(tb["p"].to<JsonArray>(), turbCurve); bleAddPoints(tb["q"].to<JsonArray>(), gBlePend[1]);
  JsonObject td = d["tds"].to<JsonObject>();
  td["ok"] = tdsCalibrated;  td["f"] = tdsCalFactor; td["r"] = tdsRefPpm;
  JsonObject tp = d["temp"].to<JsonObject>();
  tp["ok"] = tempCalibrated; tp["o"] = tempOffsetC;
  bleQueue(d);
}

static void bleSendWifi()
{
  JsonDocument d;
  d["t"] = "wifi";
  WifiManager::State st = gWifi.state();
  d["state"] = (st == WifiManager::State::kDisabled) ? "off" : WifiManager::stateName(st);
  d["ssid"] = gWifi.ssid();
  if (gWifi.isConnected()) { std::string ip = WiFi.localIP().toString().c_str(); d["ip"] = ip; d["rssi"] = WiFi.RSSI(); }
  d["time"] = gTimeSync.isSynced();
  bleQueue(d);
}

static bool bleBusyPending() { return gBlePend[0].n || gBlePend[1].n; }

// ---------------- commands ----------------

static void bleCapture(CalSensor s, float ref)
{
  JsonDocument d;
  d["t"] = "cap";
  d["s"] = (s == CAL_PH) ? "ph" : (s == CAL_TURB) ? "turb" : (s == CAL_TDS) ? "tds" : "temp";
  d["ok"] = false;

  if (gCalSerialBusy) { d["msg"] = "Serial calibration is open. Finish it first."; bleQueue(d); return; }
  gBleLiveSensor = s;
  gCalPhoneLive = true;
  if (!calSensorOK(s)) { d["msg"] = "That sensor failed the self-test."; bleQueue(d); return; }

  if (s == CAL_PH || s == CAL_TURB)
  {
    if (!isfinite(ref) || ref < 0 || (s == CAL_PH && ref > 14) || ref > TURB_NTU_MAX) { d["msg"] = "Standard value is out of range."; bleQueue(d); return; }
    float v, spread;
    if (!calCaptureVolts(s, v, spread)) { d["msg"] = "Signal out of range. Check the wiring."; bleQueue(d); return; }
    if (v <= 0.0f || v > CAL_MAX_VOLTS) { d["msg"] = "Probe voltage is out of range."; bleQueue(d); return; }
    CalCurve &pend = gBlePend[s == CAL_PH ? 0 : 1];
    uint8_t index = s == CAL_PH ? 0 : 1;
    if (!gBleEditing[index]) { pend.n = 0; gBleEditing[index] = true; }
    if (!calAddPoint(s, pend, ref, v)) { d["msg"] = "Use pH 4.01/6.86/9.18 or the legacy turbidity 0/5/10 references."; bleQueue(d); return; }
    gCalBusy = true;
    d["ok"] = true; d["v"] = v; d["n"] = pend.n;
    if (spread > CAL_UNSTABLE_V) d["msg"] = "Reading was still moving. Wait longer and capture again.";
  }
  else if (s == CAL_TDS)
  {
    if (!isfinite(ref) || fabsf(ref - TDS_CAL_TARGET_PPM) > 0.01f) { d["msg"] = "Legacy TDS calibration requires the 1382 ppm standard."; bleQueue(d); return; }
    calReadLive(CAL_TEMP);
    if (!calReadLive(CAL_TDS)) { d["msg"] = "Signal out of range."; bleQueue(d); return; }
    float temp = temperatureConnected ? temperatureC : 25.0f;
    float raw = tdsRawPPM(gCalLiveSamples[CAL_TDS].value, temp);
    if (!isfinite(raw) || raw <= 1.0f) { d["msg"] = "Reading too low. Is the probe in the solution?"; bleQueue(d); return; }
    float f = TDS_CAL_TARGET_PPM / raw;
    if (!isfinite(f) || f <= TDS_FACTOR_MIN || f >= TDS_FACTOR_MAX) { d["msg"] = "Factor out of range: wrong standard, or probe not in it."; bleQueue(d); return; }
    calSetScalar(CAL_TDS, f, TDS_CAL_TARGET_PPM);
    d["ok"] = true; d["v"] = f;
  }
  else
  {
    if (!isfinite(ref) || ref < -10 || ref > 100) { d["msg"] = "Temperature must be -10 to 100 C."; bleQueue(d); return; }
    if (!calReadLive(CAL_TEMP) || !isfinite(rawTemperatureC)) { d["msg"] = "Temperature sensor is not responding."; bleQueue(d); return; }
    float off = ref - rawTemperatureC;
    if (fabsf(off) >= TEMP_OFFSET_LIMIT_C) { d["msg"] = "Offset too large. Check the reference thermometer."; bleQueue(d); return; }
    calSetScalar(CAL_TEMP, off, 0.0f);
    d["ok"] = true; d["v"] = off;
  }
  bleQueue(d);
  bleSendCal(); // return pending/saved state after every successful capture
}

static void bleAuth(const char *pin)
{
  JsonDocument d;
  d["t"] = "auth";
  d["ok"] = false;
  if (!BLE_PIN[0])                                   { d["lock"] = true; d["msg"] = "No PIN is set on this board (BLE_PIN in secrets.h)."; }
  else if (gBleLocked && (int32_t)(millis() - gBleLockUntil) < 0) { d["lock"] = true; d["msg"] = "Too many wrong PINs. Wait 30 seconds."; }
  else if (!strcmp(pin, BLE_PIN))                    { gBleAuthed = true; gBleFails = 0; gBleLocked = false; d["ok"] = true; }
  else
  {
    if (++gBleFails >= 3) { gBleLocked = true; gBleLockUntil = millis() + 30000; gBleFails = 0; }
    d["msg"] = gBleLocked ? "Too many wrong PINs. Wait 30 seconds." : "Wrong PIN.";
    if (gBleLocked) d["lock"] = true;
  }
  bleQueue(d);
}

static void bleHandle(const char *line)
{
  JsonDocument m;
  if (deserializeJson(m, line)) return;
  const char *c = m["c"] | "";

  if (!strcmp(c, "auth")) { bleAuth(m["pin"] | ""); return; }
  if (!gBleAuthed)                                   // everything else needs the PIN first
  {
    JsonDocument d; d["t"] = "auth"; d["ok"] = false; d["need"] = true;
    bleQueue(d);
    return;
  }
  const char *sName = m["s"] | "";
  CalSensor s = CAL_PH;

  if (!strcmp(c, "hello"))
  {
    JsonDocument d; char id[24]; deviceIdentifier(id, sizeof id);
    d["t"] = "hello"; d["name"] = DEVICE_BOARD_NAME; d["id"] = id; d["fw"] = FW_VERSION; d["pos"] = config::kTelemetryPosition;
    bleQueue(d);
  }
  else if (!strcmp(c, "wifi") && m["ssid"].isNull()) bleSendWifi();
  else if (!strcmp(c, "wifi"))
  {
    const char *ssid = m["ssid"] | "", *pass = m["pass"] | "";
    if (!ssid[0] || strlen(ssid) > 32 || strlen(pass) > 63 || (pass[0] && strlen(pass) < 8)) { bleReply("err", "Name must be 1-32 characters; a password has 8-63."); return; }
    gWifiInitDone = true;
    gWifiSource = "manual (Bluetooth)";
    gWifi.connectTo(ssid, pass);
    gBleSaveWifi = m["save"] | false;
    strlcpy(gBleSsid, ssid, sizeof gBleSsid); strlcpy(gBlePass, pass, sizeof gBlePass);
    bleReply("ok", "Connecting…");
  }
  else if (!strcmp(c, "wifi_off"))    { gWifiInitDone = true; gWifi.stop(); bleReply("ok", "Wi-Fi is off."); bleSendWifi(); }
  else if (!strcmp(c, "wifi_forget")) { wifiForgetSaved(); gWifiSource = "secrets.h"; bleReply("ok", "Saved network forgotten."); }
  else if (!strcmp(c, "scan"))
  {
    if (WiFi.getMode() == WIFI_OFF) WiFi.mode(WIFI_STA);
    int n = WiFi.scanNetworks();
    JsonDocument d; d["t"] = "scan"; JsonArray a = d["n"].to<JsonArray>();
    for (int i = 0; i < n && a.size() < 10; i++)
    {
      if (WiFi.SSID(i).length() == 0) continue;
      std::string nm = WiFi.SSID(i).c_str(); JsonObject o = a.add<JsonObject>(); o["s"] = nm; o["r"] = WiFi.RSSI(i); o["o"] = WiFi.encryptionType(i) == WIFI_AUTH_OPEN;
    }
    WiFi.scanDelete();
    bleQueue(d);
  }
  else if (!strcmp(c, "cal")) bleSendCal();
  else if (!strcmp(c, "live") && (!strcmp(sName, "off") || !sName[0]))
  {
    bleStopLive(); bleReply("ok", "Live calibration preview stopped.");
  }
  else if (!strcmp(c, "live") && bleSensor(sName, s))
  {
    bool changed = gBleLiveSensor != s;
    gBleLiveSensor = s; gCalPhoneLive = true;
    if (changed || millis() - gBleLastLiveMs >= CAL_LIVE_INTERVAL_MS)
      bleSendLive(s); // repeated app polls cannot flood the notification queue
  }
  else if (!strcmp(c, "cap") && bleSensor(sName, s)) bleCapture(s, m["ref"] | NAN);
  else if (!strcmp(c, "save") && (!strcmp(sName, "ph") || !strcmp(sName, "turb")))
  {
    s = !strcmp(sName, "ph") ? CAL_PH : CAL_TURB;
    CalCurve &pend = gBlePend[s == CAL_PH ? 0 : 1];
    if (gCalSerialBusy) { bleReply("err", "Serial calibration is open. Finish it first."); return; }
    const char *why = calCurveProblem(s, pend);
    if (pend.n != 3) why = "Capture all 3 fixed reference points first.";
    if (why) { bleReply("err", why); return; }
    calSetCurve(s, pend);
    pend.n = 0;
    gBleEditing[s == CAL_PH ? 0 : 1] = false;
    bleStopLive();
    gCalBusy = bleBusyPending();
    bleReply("ok", "Calibration saved on the board."); bleSendCal();
  }
  else if (!strcmp(c, "clear") && (!strcmp(sName, "ph") || !strcmp(sName, "turb")))
  {
    if (gCalSerialBusy) { bleReply("err", "Serial calibration is open. Finish it first."); return; }
    uint8_t index = !strcmp(sName, "ph") ? 0 : 1;
    gBlePend[index].n = 0;
    gBleEditing[index] = true; // distinguish an intentionally empty set from saved points
    gBleLiveSensor = index == 0 ? CAL_PH : CAL_TURB;
    gCalPhoneLive = true;
    gBleLastLiveMs = millis() - CAL_LIVE_INTERVAL_MS;
    gCalBusy = bleBusyPending();
    bleReply("ok", "Points cleared."); bleSendCal();
  }
  else bleReply("err", "Unknown command.");
}

// ---------------- Bluetooth callbacks (only move bytes) ----------------

class BleRxCallbacks : public NimBLECharacteristicCallbacks
{
#if BLE_NIMBLE_V2
  void onWrite(NimBLECharacteristic *c, NimBLEConnInfo &) override
#else
  void onWrite(NimBLECharacteristic *c) override
#endif
  {
    auto v = c->getValue();
    portENTER_CRITICAL(&gBleMux);
    if (gBleRx.size() < 600) gBleRx.append((const char *)v.data(), v.length());
    portEXIT_CRITICAL(&gBleMux);
  }
};

class BleServerCallbacks : public NimBLEServerCallbacks
{
#if BLE_NIMBLE_V2
  void onConnect(NimBLEServer *, NimBLEConnInfo &) override { gBleConnected = true; }
  void onDisconnect(NimBLEServer *, NimBLEConnInfo &, int) override { gBleConnected = false; NimBLEDevice::startAdvertising(); }
#else
  void onConnect(NimBLEServer *) override { gBleConnected = true; }
  void onDisconnect(NimBLEServer *) override { gBleConnected = false; NimBLEDevice::startAdvertising(); }
#endif
};

// ---------------- setup + service ----------------

void bleBegin()
{
  NimBLEDevice::init(DEVICE_BOARD_NAME);                       // "ESP32-S3" or "ESP32 DevKit V1"
  NimBLEServer *server = NimBLEDevice::createServer();
  server->setCallbacks(new BleServerCallbacks());
  NimBLEService *svc = server->createService(BLE_SVC_UUID);
  NimBLECharacteristic *rx = svc->createCharacteristic(BLE_RX_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  rx->setCallbacks(new BleRxCallbacks());
  gBleTx = svc->createCharacteristic(BLE_TX_UUID, NIMBLE_PROPERTY::NOTIFY);
  svc->start();

  NimBLEAdvertising *adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SVC_UUID);
#if BLE_NIMBLE_V2
  adv->enableScanResponse(true);
#else
  adv->setScanResponse(true);
#endif
  adv->start();
  Serial.printf("[ble] advertising as \"%s\"%s\n", DEVICE_BOARD_NAME, BLE_PIN[0] ? "" : " - NO PIN SET: control stays locked (BLE_PIN in secrets.h)");
}

// Called from networkService() every loop (and inside menus): main task only.
void bleService()
{
  static bool wasConnected = false;
  static uint32_t lastRead = 0;

  if (wasConnected && !gBleConnected)
  {
    gBleAuthed = false; gBleTxHead = 0; gBleTxCount = 0; gBleSending.clear(); gBleSendPos = 0;
    gBlePend[0].n = gBlePend[1].n = 0; gBleEditing[0] = gBleEditing[1] = false;
    gCalBusy = false; bleStopLive(); gBleLine.clear();
    portENTER_CRITICAL(&gBleMux); gBleRx.clear(); portEXIT_CRITICAL(&gBleMux);
  }
  wasConnected = gBleConnected;
  if (!gBleConnected) return;

  // finished lines from the phone
  std::string rxCopy;
  portENTER_CRITICAL(&gBleMux);
  rxCopy.swap(gBleRx);
  portEXIT_CRITICAL(&gBleMux);
  std::string &acc = gBleLine;
  acc += rxCopy;
  size_t nl;
  while ((nl = acc.find('\n')) != std::string::npos)
  {
    std::string line = acc.substr(0, nl);
    acc.erase(0, nl + 1);
    if (!line.empty()) bleHandle(line.c_str());
  }
  if (acc.size() > 500) acc.clear();

  if (gBleSaveWifi && gWifi.isConnected() && gBleSsid[0])      // remember the network once it works
  {
    gBleSaveWifi = false;
    if (wifiSaveCredentials(gBleSsid, gBlePass)) { gWifiSource = "saved (Bluetooth)"; bleReply("ok", "Network saved on the board."); }
  }

  if (gBleAuthed && gBleLiveSensor >= 0 &&
      millis() - gBleLastLiveMs >= CAL_LIVE_INTERVAL_MS && gBleTxCount < 2)
    bleSendLive((CalSensor)gBleLiveSensor);

  // Keep bulk normal readings out of the calibration preview/response queue.
  if (gBleAuthed && gBleLiveSensor < 0 && !gCalSerialBusy && millis() - lastRead >= BLE_READ_EVERY && gBleTxCount < 6) { lastRead = millis(); bleSendReadings(); }
  blePump();
}
