#pragma once

//  POWER-ON SELF TEST (POST)
//
//  Runs once from setup() and decides, for the whole run:
//    - is the LCD present?                  -> lcd.ok
//    - does each sensor give a sane signal? -> phSensorOK, tdsSensorOK,
//                                              turbSensorOK, tempSensorOK
//
//  Everything else in the program follows these flags:
//    - lcd.ok false      : every lcd.* call is skipped (see SafeLCD in main.ino)
//    - a *SensorOK false : the sensor is never read, the LCD/serial show
//                          "SENSOR FAULT", and the calibration wizard skips it
//
//  Include order in main.ino: AFTER lcd, ds18b20, LCD_ADDR, AnalogReading and
//  readAnalog(), and BEFORE calibration.h (which uses the flags).
//
//  The flow sensor is not tested: a Hall-effect flow meter only produces pulses
//  while water moves, so "no pulses" at power-on is normal and proves nothing.

#include <Arduino.h>
#include <Wire.h>

// ---------------- WORKING / FAILED FLAGS (set by runPOST) ----------------

bool phSensorOK   = false;
bool tdsSensorOK  = false;
bool turbSensorOK = false;
bool tempSensorOK = false;

constexpr uint8_t POST_ANALOG_READS = 3;   // every read must be valid
constexpr uint8_t POST_TEMP_TRIES   = 3;

// ---------------- INDIVIDUAL CHECKS ----------------

// An I2C device that is wired and powered will ACK its address
bool postProbeLCD()
{
  Wire.beginTransmission(LCD_ADDR);
  return Wire.endTransmission() == 0;
}

// Analog module: the signal must sit inside the valid ADC range on every read.
// A disconnected module pulls the pin to the rail (through its divider), so
// it fails the range check in readAnalog().
bool postAnalog(const char *name, uint8_t pin)
{
  AnalogReading r;

  for (uint8_t i = 0; i < POST_ANALOG_READS; i++)
  {
    r = readAnalog(pin);
    if (!r.valid)
    {
      Serial.printf("  %-10s FAIL  (raw %d, %.3f V at GPIO)\n", name, r.raw, r.pinVolts);
      return false;
    }
  }

  Serial.printf("  %-10s OK    (raw %d, %.3f V at GPIO)\n", name, r.raw, r.pinVolts);
  return true;
}

// DS18B20: must be found on the bus and return a believable temperature
bool postTemperature()
{
  if (ds18b20.getDeviceCount() == 0)
  {
    Serial.println("  Temp       FAIL  (no DS18B20 found on the bus)");
    return false;
  }

  for (uint8_t i = 0; i < POST_TEMP_TRIES; i++)
  {
    ds18b20.requestTemperatures();
    float t = ds18b20.getTempCByIndex(0);

    // 85.0 C is the chip's power-on value ("no conversion done yet"), not a reading
    if (t != DEVICE_DISCONNECTED_C && isfinite(t) && t >= -55.0f && t <= 125.0f && t != 85.0f)
    {
      Serial.printf("  Temp       OK    (%.2f C)\n", t);
      return true;
    }
    delay(100);
  }

  Serial.println("  Temp       FAIL  (no valid reading)");
  return false;
}

// ---------------- RUN THE POST ----------------

// Returns true only if the LCD and every sensor passed.
// Needs: Wire.begin(), analog pin setup and ds18b20.begin() already done.
bool runPOST()
{
  Serial.println("\n===== POWER-ON SELF TEST =====");

  // 1) LCD first, so the rest of the POST (and the program) knows whether to use it
  lcd.ok = postProbeLCD();
  if (lcd.ok)
  {
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("IoT Water System");
    lcd.setCursor(0, 1);
    lcd.print("Self test...");
    delay(1000);
  }
  Serial.printf("  %-10s %s\n", "LCD",
                lcd.ok ? "OK" : "FAIL  (no response - screen calls disabled)");

  // 2) Sensors
  phSensorOK   = postAnalog("pH", PH_PIN);
  tdsSensorOK  = postAnalog("TDS", TDS_PIN);
  turbSensorOK = postAnalog("Turbidity", TURB_PIN);
  tempSensorOK = postTemperature();

  bool allOK = lcd.ok && phSensorOK && tdsSensorOK && turbSensorOK && tempSensorOK;

  Serial.println(allOK ? "POST RESULT: ALL OK"
                       : "POST RESULT: PROBLEMS FOUND (failed parts are disabled)");
  Serial.println("==============================");

  // 3) Summary on the LCD (skipped automatically if there is no screen)
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(allOK ? "POST: ALL OK" : "POST: PROBLEMS");
  lcd.setCursor(0, 1);
  lcd.print("pH:");
  lcd.print(phSensorOK ? "OK" : "FAIL");
  lcd.print(" TDS:");
  lcd.print(tdsSensorOK ? "OK" : "FAIL");
  lcd.setCursor(0, 2);
  lcd.print("Turb:");
  lcd.print(turbSensorOK ? "OK" : "FAIL");
  lcd.print(" Temp:");
  lcd.print(tempSensorOK ? "OK" : "FAIL");
  if (lcd.ok) delay(2500);

  return allOK;
}
