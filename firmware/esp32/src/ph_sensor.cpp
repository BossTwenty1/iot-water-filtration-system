#include "ph_sensor.h"

#include <Arduino.h>

#include "config.h"

void PhSensor::begin(int pin) {
  pin_ = pin;
  if (pin_ < 0) return;  // Unassigned pin (pin map TBD) — stays disabled.
  // 11 dB attenuation gives the full ~0-3.3 V input span, which is what a
  // PH-4502C output needs.
  analogSetPinAttenuation(pin_, ADC_11db);
}

bool PhSensor::read(Reading& out) const {
  if (pin_ < 0) return false;

  uint32_t countsTotal = 0;
  uint32_t milliVoltsTotal = 0;
  for (uint8_t i = 0; i < config::kPhSampleCount; ++i) {
    countsTotal += static_cast<uint32_t>(analogRead(pin_));
    milliVoltsTotal += analogReadMilliVolts(pin_);
  }

  out.rawCounts = static_cast<uint16_t>(countsTotal / config::kPhSampleCount);
  out.milliVolts = milliVoltsTotal / config::kPhSampleCount;

  if (calibration_.calibrated) {
    out.ph = applyCalibration(calibration_, out.milliVolts);
    out.phValid = true;
  } else {
    out.ph = 0.0f;
    out.phValid = false;
  }
  return true;
}

bool PhSensor::calibrateTwoPoint(uint32_t mv1, float ph1, uint32_t mv2, float ph2) {
  const Calibration fitted = fitTwoPoint(mv1, ph1, mv2, ph2);
  if (!fitted.calibrated) return false;
  calibration_ = fitted;
  return true;
}
