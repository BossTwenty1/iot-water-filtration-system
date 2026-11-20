/*
  IoT EMBEDDED WATER FILTRATION SYSTEM
  Supports: ESP32 DevKit V1 and ESP32-S3

  Files in this sketch folder:
    main.ino        - this file
    board_config.h  - pin mapping per board
    post.h          - power-on self test + working/failed flags
    calibration.h   - final2.3 fixed references, flash, guided wizard and text import/export
    menu.h          - boot menu, calibration menu, run mode
    wifi_menu.h     - Wi-Fi menu: scan, connect by hand, save/forget a network
    device_info.h   - Device info screen: identifiers, system, connectivity
    wifi_manager.*  - non-blocking Wi-Fi with automatic reconnect
    time_sync.*     - UTC time over NTP (HTTPS needs it)
    api_client.*    - HTTPS POST to the backend (verified TLS, X-Device-Key header)
    telemetry.h     - background task that uploads the latest readings
    net_config.h    - network timing + the backend route
    secrets.h       - YOUR Wi-Fi + backend details (copy secrets.example.h; not shared)

  Network (optional - without an SSID in secrets.h the sketch runs offline):
   - Wi-Fi starts when Run is chosen, so calibrating from the boot menu runs with
     the radio off (less ADC noise).
   - EXCEPTION: if pH or turbidity has no saved calibration, Wi-Fi starts at boot
     to fetch the calibration saved in the database (when kApiCalibrationPath is set).
   - Calibration is saved in flash AND in the database; a changed database copy
     (edited on the website) is picked up while running.

  Boot sequence (Serial Monitor at 115200 baud):
    POST -> load saved calibration -> MAIN MENU

    1 = Run system   normal operation
    2 = Calibration  guided missing/all calibration,
                     text export and import
    3 = Wi-Fi        scan and connect by hand, disconnect, saved network
    4 = Device info  device ID, MAC, firmware, chip, Wi-Fi/IP, time, backend

    No key for 60 s -> option 1 starts by itself (if calibration is missing it
    first waits 15 s for the database copy / a key, then runs anyway).

  While running, press ESC - or send M if your terminal cannot send ESC
  (the Arduino Serial Monitor cannot) - to return to the menu.

  Fault handling (decided once, by the power-on self test):
   - LCD missing   -> lcd.ok = false, every lcd.* call is skipped.
   - Sensor failed -> its *SensorOK flag is false: it is never read, the LCD
                      and serial show SENSOR FAULT, and the calibration
                      wizard skips it. Everything else keeps running.
*/

#include <Arduino.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <LiquidCrystal_I2C.h>
#include <Preferences.h>
#include <math.h>
#include "board_config.h"
#include "types.h"
#include <esp_system.h>
#include "secrets_select.h"   // WIFI_SSID, WIFI_PASSWORD, API_BASE_URL, API_ROOT_CA_PEM

// Wi-Fi in secrets.h is optional: without it the sketch runs offline (and the Wi-Fi menu
// can still connect by hand).
#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

// Backend identity. API_DEVICE_ID = this device's UUID in the backend (goes in the URL),
// API_DEVICE_KEY = its secret (goes in the X-Device-Key header).
// An old secrets file that still says API_DEVICE_TOKEN keeps working as the key.
#ifndef API_DEVICE_KEY
  #ifdef API_DEVICE_TOKEN
    #define API_DEVICE_KEY API_DEVICE_TOKEN
  #else
    #define API_DEVICE_KEY ""
  #endif
#endif
#ifndef API_DEVICE_ID
#define API_DEVICE_ID ""
#endif
#include "wifi_manager.h"
#include "time_sync.h"
#include "api_client.h"

// ---------------- OBJECTS ----------------

constexpr uint8_t LCD_ADDR = 0x27 ;   // change to 0x3F if your LCD uses that address

// LCD wrapper: every call is silently skipped unless POST found the screen,
// so the rest of the code can call lcd.print()/setCursor()/clear() freely.
class SafeLCD
{
public:
  bool ok = false;   // set by runPOST(): true = working, false = missing/failed

  SafeLCD(uint8_t addr, uint8_t cols, uint8_t rows) : dev(addr, cols, rows) {}

  void init()                           { if (ok) dev.init(); }
  void backlight()                      { if (ok) dev.backlight(); }
  void clear()                          { if (ok) dev.clear(); }
  void setCursor(uint8_t c, uint8_t r)  { if (ok) dev.setCursor(c, r); }

  template <typename T> void print(T v)          { if (ok) dev.print(v); }
  template <typename T> void print(T v, int arg) { if (ok) dev.print(v, arg); }

private:
  LiquidCrystal_I2C dev;
};

SafeLCD lcd(LCD_ADDR, 20, 4);
OneWire oneWire(TEMP_PIN);
DallasTemperature ds18b20(&oneWire);

// ---------------- DIVIDER & SENSOR CONSTANTS ----------------

constexpr float PH_DIVIDER_MULTIPLIER   = 1.5f; // pH board output / pin voltage
constexpr float TDS_DIVIDER_MULTIPLIER  = 1.0f; // TDS signal goes straight to the pin (no divider)
constexpr float TURB_DIVIDER_MULTIPLIER = (10.0f + 5.0f) / 5.0f;   // 10k top / 5k bottom = 3.0 (inverse of the 0.3333 ratio)

constexpr float FLOW_PULSES_PER_LITER = 450.0f;

constexpr uint8_t  SAMPLE_COUNT       = 32;
constexpr uint32_t SENSOR_INTERVAL_MS = 1000;
constexpr uint32_t SERIAL_INTERVAL_MS = 2000;
constexpr uint32_t LCD_INTERVAL_MS    = 3000;

// ---------------- NETWORK ----------------

WifiManager gWifi;
TimeSync    gTimeSync;
ApiClient   gApi;

void calibrationSyncService();   // calibration.h
void bleService();               // ble_control.h

// Non-blocking. Called from pollKey(), which the main loop, the menus and the
// calibration prompts all use, so Wi-Fi keeps running everywhere. Does nothing
// until gWifi.begin() is called. Also applies calibration the network task
// downloaded (always on this thread, never on the network task).
void networkService()
{
  gWifi.loop(millis());
  gTimeSync.loop(gWifi.isConnected());
  calibrationSyncService();
  bleService();                    // phone control over Bluetooth (ble_control.h)
}

// ---------------- KEY INPUT ----------------

constexpr int KEY_ESC = 27;

// Returns the next key from the serial port, or -1 if none.
// A lone ESC comes back as KEY_ESC; arrow/function keys (which send ESC plus
// more bytes) are swallowed so they are not mistaken for ESC.
int pollKey()
{
  networkService();

  if (!Serial.available()) return -1;

  int c = Serial.read();
  if (c != KEY_ESC) return c;

  delay(30);   // a real escape sequence has its remaining bytes here by now
  if (Serial.available())
  {
    while (Serial.available()) { Serial.read(); delay(1); }
    return -1;
  }
  return KEY_ESC;
}

// True if the user asked for the menu (ESC, or M for terminals without ESC)
bool menuKeyPressed()
{
  int k;
  while ((k = pollKey()) >= 0)
  {
    if (k == KEY_ESC || k == 'm' || k == 'M') return true;
  }
  return false;
}

// ---------------- ANALOG READING ----------------

AnalogReading phADC, tdsADC, turbADC;

float phModuleVolts   = NAN;
float tdsModuleVolts  = NAN;
float turbModuleVolts = NAN;

float phValue         = NAN;
float tdsPPM          = NAN;
float turbidityNTU    = NAN;
float rawTemperatureC = NAN;
float temperatureC    = NAN;

bool temperatureConnected = false;
bool postPassed           = false;

volatile uint32_t flowPulseCounter = 0;
float flowRateLMin = 0.0f;
float totalLiters  = 0.0f;

uint32_t previousFlowMillis   = 0;
uint32_t previousSensorMillis = 0;
uint32_t previousSerialMillis = 0;
uint32_t previousLCDMillis    = 0;

// ---------------- FLOW INTERRUPT ----------------

void IRAM_ATTR flowISR()
{
  flowPulseCounter++;
}

// ---------------- ANALOG INPUT ----------------

AnalogReading readAnalog(uint8_t pin)
{
  AnalogReading r;
  uint32_t rawTotal = 0;
  uint32_t mvTotal = 0;

  for (uint8_t i = 0; i < SAMPLE_COUNT; i++) 
  {
    rawTotal += analogRead(pin);
    mvTotal += analogReadMilliVolts(pin);
    delay(2);
  }

  r.raw = rawTotal / SAMPLE_COUNT;
  r.pinVolts = (mvTotal / (float)SAMPLE_COUNT) / 1000.0f;

  r.valid = r.raw > 5 &&
            r.raw < 4090 &&
            isfinite(r.pinVolts);

  return r;
}

#include "post.h"          // needs lcd, ds18b20, LCD_ADDR, AnalogReading, readAnalog(); defines the *SensorOK flags
#include "calibration.h"   // needs the above plus the *SensorOK flags from post.h
#include "wifi_menu.h"     // needs lcd, gWifi, pollKey(), calReadLine()
#include "device_info.h"   // needs lcd, gWifi, gTimeSync, gApi, the *SensorOK / *Calibrated flags
// ---------------- READ ALL SENSORS ----------------

// A sensor that failed POST is never touched: no wasted ADC time, no stale values.
void readAnalogSensor(bool sensorOK, uint8_t pin, float multiplier,
                      AnalogReading &adc, float &moduleVolts)
{
  if (sensorOK)
  {
    adc = readAnalog(pin);
    moduleVolts = adc.pinVolts * multiplier;
  }
  else
  {
    adc = AnalogReading();   // valid = false, so the calculate*() functions give NAN
    moduleVolts = NAN;
  }
}

void readAllSensors()
{
  readAnalogSensor(phSensorOK,   PH_PIN,   PH_DIVIDER_MULTIPLIER,   phADC,   phModuleVolts);
  readAnalogSensor(tdsSensorOK,  TDS_PIN,  TDS_DIVIDER_MULTIPLIER,  tdsADC,  tdsModuleVolts);
  readAnalogSensor(turbSensorOK, TURB_PIN, TURB_DIVIDER_MULTIPLIER, turbADC, turbModuleVolts);

  if (!tempSensorOK)
  {
    // Skipping this also avoids the ~750 ms conversion wait on a dead bus
    temperatureConnected = false;
    rawTemperatureC = NAN;
    temperatureC    = NAN;
    return;
  }

  ds18b20.requestTemperatures();
  float t = ds18b20.getTempCByIndex(0);

  temperatureConnected = (t != DEVICE_DISCONNECTED_C && isfinite(t) && t >= -55.0f && t <= 125.0f);
  if (temperatureConnected) 
  {
    rawTemperatureC = t;
    temperatureC    = rawTemperatureC + tempOffsetC; // Apply calibrated offset
  } else {
    rawTemperatureC = NAN;
    temperatureC    = NAN;
  }
}

// ---------------- CALCULATE pH & TURBIDITY ----------------
// final2.3 fixed three-point pH and turbidity calculations (see calibration.h).

void calculatePH()
{
  if (!phCalibrated || !phADC.valid) 
  {
    phValue = NAN;
    return;
  }

  float v = phADC.pinVolts;
  float calculatedPH = NAN;

  // Is acidic?
  bool acidSide = (ph4PinVolts > ph7PinVolts) ? (v >= ph7PinVolts) : (v <= ph7PinVolts);

  if (acidSide) {
    calculatedPH = 6.86f + (v - ph7PinVolts) / (ph4PinVolts - ph7PinVolts) * (4.01f - 6.86f);
  } else {
    calculatedPH = 6.86f + (v - ph7PinVolts) / (ph9PinVolts - ph7PinVolts) * (9.18f - 6.86f);
  }

  phValue = (isfinite(calculatedPH) && calculatedPH >= 0.0f && calculatedPH <= 14.0f) ? calculatedPH : NAN;
}

void calculateTurbidity()
{
  if (!turbidityCalibrated || !turbADC.valid) 
  {
    turbidityNTU = NAN;
    return;
  }

  float v = turbModuleVolts;
  float calculatedNTU = 0.0f;

  // DI and tap water are both "clear" and can sit only a few mV apart. If they are too
  // close to tell apart (ADC noise), treat them as ONE clear-water point instead of
  // stretching a few NTU over a few mV, which turns noise into big NTU swings.
  bool tapDistinct = (turbDIVolts - turbTapVolts) >= TURB_MIN_SEGMENT_V;

  if (v >= turbDIVolts) 
  {
    calculatedNTU = TURB_NTU_DI;
  }
  else if (tapDistinct && v >= turbTapVolts) 
  {
    // DI > Tap segment
    float ntuPerVolt = (TURB_NTU_TAP - TURB_NTU_DI) / (turbDIVolts - turbTapVolts);
    calculatedNTU = TURB_NTU_DI + (turbDIVolts - v) * ntuPerVolt;
  }
  else 
  {
    // Clear > Cloudy segment. Start from tap when it is a separate point and sits clearly
    // above cloudy; otherwise start from DI (calibration guarantees DI - cloudy >= TURB_MIN_SPAN_V).
    float anchorV   = turbDIVolts;
    float anchorNTU = TURB_NTU_DI;
    if (tapDistinct && (turbTapVolts - turbCloudyVolts) >= TURB_MIN_SEGMENT_V)
    {
      anchorV   = turbTapVolts;
      anchorNTU = TURB_NTU_TAP;
    }

    float ntuPerVolt = (TURB_NTU_CLOUDY - anchorNTU) / (anchorV - turbCloudyVolts);
    calculatedNTU = anchorNTU + (anchorV - v) * ntuPerVolt;
  }

  if (calculatedNTU > TURB_NTU_MAX) calculatedNTU = TURB_NTU_MAX;   // sensor range limit

  turbidityNTU = (isfinite(calculatedNTU) && calculatedNTU >= 0.0f) ? calculatedNTU : NAN;
}

// ---------------- CALCULATE TDS ----------------

// Uncorrected TDS (ppm) from module voltage, with temperature compensation.
// Returns NAN if the temperature compensation is out of bounds.
float tdsRawPPM(float moduleVolts, float tempC)
{
  float compensation = 1.0f + 0.02f * (tempC - 25.0f);
  if (compensation <= 0.1f) return NAN;

  float v = moduleVolts / compensation;

  return (133.42f * v * v * v
          - 255.86f * v * v
          + 857.39f * v) * 0.5f;
}

void calculateTDS()
{
  if (!tdsADC.valid)
  {
    tdsPPM = NAN;
    return;
  }

  float temp = temperatureConnected ? temperatureC : 25.0f;
  float value = tdsRawPPM(tdsModuleVolts, temp) * tdsCalFactor;

  tdsPPM = (isfinite(value) && value >= 0.0f) ? value : NAN;
}


// ---------------- FLOW RATE ----------------

void updateFlow()
{
  uint32_t now = millis();
  uint32_t elapsedMs = now - previousFlowMillis;
  if (elapsedMs < 1000) return;

  noInterrupts();
  uint32_t pulses = flowPulseCounter;
  flowPulseCounter = 0;
  interrupts();

  float liters = pulses / FLOW_PULSES_PER_LITER;
  flowRateLMin = liters * 60000.0f / elapsedMs;   // uses the real elapsed time
  totalLiters += liters;
  previousFlowMillis = now;
}

// ---------------- SERIAL DISPLAY ----------------

void printAnalog(const char *name, bool sensorOK, const AnalogReading &r, float moduleVoltage)
{
  if (!sensorOK) return;   // failed POST: not being read, the value line says SENSOR FAULT

  Serial.printf("%s Raw ADC: %d | GPIO: %.3f V | Module: %.3f V\n", name, r.raw, r.pinVolts, moduleVoltage);
  if (!r.valid) {
    Serial.printf("WARNING: %s ADC invalid/near rail.\n", name);
  }
}

void printReadings()
{
  Serial.println("\n========== WATER MONITOR ==========");

  printAnalog("pH", phSensorOK, phADC, phModuleVolts);
  Serial.print("pH Value: ");
  if (!phSensorOK) Serial.println("SENSOR FAULT");
  else if (isfinite(phValue)) Serial.println(phValue, 2);
  else Serial.println("INVALID / 3-POINT pH CAL REQUIRED");

  Serial.println("------------------------------------");

  printAnalog("TDS", tdsSensorOK, tdsADC, tdsModuleVolts);
  Serial.print("TDS: ");
  if (!tdsSensorOK)
  {
    Serial.println("SENSOR FAULT");
  }
  else if (isfinite(tdsPPM)) 
  {
    Serial.print(tdsPPM, 1);
    Serial.printf(" ppm (Factor: %.3f)\n", tdsCalFactor);
  } else 
  {
    Serial.println("INVALID - check signal");
  }

  Serial.println("------------------------------------");

  printAnalog("Turbidity", turbSensorOK, turbADC, turbModuleVolts);
  Serial.print("Turbidity Value: ");
  if (!turbSensorOK)
  {
    Serial.println("SENSOR FAULT");
  }
  else if (isfinite(turbidityNTU)) 
  {
    Serial.print(turbidityNTU, 1);
    Serial.println(" NTU");
  } else if (turbidityCalibrated)
  {
    Serial.println("INVALID - check signal");
  } else 
  {
    Serial.println("3-POINT TURBIDITY CAL REQUIRED");
  }

  Serial.println("------------------------------------");
  Serial.print("Temperature: ");
  if (!tempSensorOK)
  {
    Serial.println("SENSOR FAULT");
  }
  else if (temperatureConnected) 
  {
    Serial.print(temperatureC, 2);
    Serial.printf(" C (Raw: %.2f C, Offset: %+.2f C)\n", rawTemperatureC, tempOffsetC);
  } else 
  {
    Serial.println("DS18B20 DISCONNECTED");
  }

  Serial.printf("Flow Rate: %.2f L/min | Total: %.3f L\n", flowRateLMin, totalLiters);
  Serial.println("====================================");
}

// ---------------- LCD DISPLAY ----------------

void updateLCD()
{
  if (!lcd.ok) return;   // no screen: nothing to draw

  static bool page = false;
  lcd.clear();

  if (!page) 
  {
    lcd.setCursor(0, 0);
    lcd.print("WATER MONITOR");

    lcd.setCursor(0, 1);
    lcd.print("pH: ");
    if (!phSensorOK) lcd.print("SENSOR FAULT");
    else if (isfinite(phValue)) lcd.print(phValue, 2);
    else lcd.print("NEEDS 3P-CAL");

    lcd.setCursor(0, 2);
    lcd.print("TDS: ");
    if (!tdsSensorOK)
    {
      lcd.print("SENSOR FAULT");
    }
    else if (isfinite(tdsPPM)) 
    {
      lcd.print(tdsPPM, 0);
      lcd.print(" ppm");
    } else {
      lcd.print("CHECK SENSOR");
    }

    lcd.setCursor(0, 3);
    lcd.print("Turb: ");
    if (!turbSensorOK)
    {
      lcd.print("SENSOR FAULT");
    }
    else if (isfinite(turbidityNTU)) 
    {
      lcd.print(turbidityNTU, 1);
      lcd.print(" NTU");
    } else if (turbidityCalibrated) {
      lcd.print("CHECK SENSOR");
    } else {
      lcd.print("NEEDS 3P-CAL");
    }
  } else 
  {
    lcd.setCursor(0, 0);
    lcd.print("SYSTEM STATUS");

    lcd.setCursor(0, 1);
    lcd.print("Temp: ");
    if (tempSensorOK && temperatureConnected) 
    {
      lcd.print(temperatureC, 1);
      lcd.print(" C");
    } else {
      lcd.print("SENSOR FAULT");
    }

    lcd.setCursor(0, 2);
    lcd.print("Flow: ");
    lcd.print(flowRateLMin, 2);
    lcd.print(" L/min");

    lcd.setCursor(0, 3);
    lcd.print("Total: ");
    lcd.print(totalLiters, 2);
    lcd.print(" L");
  }

  page = !page;
}

#include "menu.h"          // needs everything above (sensors, display, calibration, post)
#include "telemetry.h"     // needs gWifi, gTimeSync, gApi from above
#include "ble_control.h"   // needs calibration.h, wifi_menu.h, device_info.h, telemetry.h

// A BROWNOUT here means the supply sagged (Wi-Fi transmit bursts draw a few hundred mA).
const char *resetReasonName(esp_reset_reason_t reason)
{
  switch (reason)
  {
    case ESP_RST_POWERON:  return "POWERON";
    case ESP_RST_EXT:      return "EXTERNAL_PIN";
    case ESP_RST_SW:       return "SOFTWARE";
    case ESP_RST_PANIC:    return "PANIC (crash)";
    case ESP_RST_INT_WDT:  return "INTERRUPT_WATCHDOG";
    case ESP_RST_TASK_WDT: return "TASK_WATCHDOG";
    case ESP_RST_WDT:      return "OTHER_WATCHDOG";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP_WAKE";
    case ESP_RST_BROWNOUT: return "BROWNOUT (weak power supply)";
    default:               return "UNKNOWN";
  }
}

// ---------------- NETWORK START ----------------

bool gNetworkStarted = false;

// Failures here never stop the sensors: without Wi-Fi the system keeps running locally.
void startNetwork()
{
  if (gNetworkStarted) return;
  gNetworkStarted = true;

  wifiInitialStart();   // saved network (Wi-Fi menu) if any, else secrets.h; skipped if already chosen in the menu
  gApi.begin(API_BASE_URL, API_ROOT_CA_PEM, API_DEVICE_KEY);
  telemetryBegin();
}

// ---------------- SETUP ----------------

void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.printf("Reset reason: %s\n", resetReasonName(esp_reset_reason()));

  analogReadResolution(12);
  analogSetPinAttenuation(PH_PIN, ADC_11db);
  analogSetPinAttenuation(TDS_PIN, ADC_11db);
  analogSetPinAttenuation(TURB_PIN, ADC_6db);    // pin sees at most ~1.5 V through the 10k/5k divider

  ds18b20.begin();

  pinMode(FLOW_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_PIN), flowISR, FALLING);

  Wire.begin(LCD_SDA, LCD_SCL);

  // Power-on self test. Probes the LCD (and initialises it if present), then
  // checks every sensor. Sets lcd.ok and the *SensorOK flags used everywhere below.
  postPassed = runPOST();
  if (!postPassed) 
  {
    Serial.println("WARNING: POST found problems. Failed parts are disabled; the rest keeps running.");
  }

  loadCalibration();       // load saved calibration from flash
  bleBegin();              // phone control over Bluetooth, available from the menus onward

  // No saved calibration: start the network now so the database copy can arrive while
  // the menu is showing (Wi-Fi is otherwise kept off until the user has chosen).
  if (calibrationMissing())
  {
    Serial.println("No saved calibration: starting Wi-Fi now to look for one in the database.");
    startNetwork();
  }

  // Boot menu. Waits MENU_TIMEOUT_BOOT_MS for a choice, then starts the system itself.
  enterMenu(MENU_TIMEOUT_BOOT_MS);

  // Network starts only now (after any boot-menu calibration), unless it already did.
  startNetwork();
}

// ---------------- LOOP ----------------

void loop()
{
  // ESC (or M) at any time brings the menu back
  if (menuKeyPressed())
  {
    Serial.println("\nReturning to the menu...");
    enterMenu(MENU_TIMEOUT_RETURN_MS);
    return;
  }

  uint32_t now = millis();

  // Read sensors on a timer instead of blocking the loop with delay()
  if (now - previousSensorMillis >= SENSOR_INTERVAL_MS) 
  {
    previousSensorMillis = now;

    readAllSensors();

    calculatePH();
    calculateTurbidity();
    calculateTDS();

    telemetryUpdate(phValue, tdsPPM, turbidityNTU,
                    (tempSensorOK && temperatureConnected) ? temperatureC : NAN,
                    flowRateLMin, totalLiters);
  }

  updateFlow();

  now = millis();

  if (now - previousSerialMillis >= SERIAL_INTERVAL_MS)
  {
    printReadings();
    previousSerialMillis = now;
  }

  if (!gCalPhoneLive && now - previousLCDMillis >= LCD_INTERVAL_MS) 
  {
    updateLCD();
    previousLCDMillis = now;
  }

  delay(10);
}
