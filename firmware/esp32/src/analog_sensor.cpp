#include "analog_sensor.h"

#include <Arduino.h>

#include "config.h"

void AnalogSensor::begin(int pin, const char* label, float dividerRatio) {
  pin_ = pin;
  label_ = label;
  dividerRatio_ = (dividerRatio > 0.0f) ? dividerRatio : 1.0f;
  if (pin_ < 0) return;  // Unassigned pin (pin map TBD) — stays disabled.
  // 11 dB attenuation gives the full ~0-3.3 V input span.
  analogSetPinAttenuation(pin_, ADC_11db);
}

bool AnalogSensor::read(Reading& out) const {
  if (pin_ < 0) return false;

  uint32_t countsTotal = 0;
  uint32_t milliVoltsTotal = 0;
  for (uint8_t i = 0; i < config::kAnalogSampleCount; ++i) {
    countsTotal += static_cast<uint32_t>(analogRead(pin_));
    milliVoltsTotal += analogReadMilliVolts(pin_);
  }

  out.rawCounts = static_cast<uint16_t>(countsTotal / config::kAnalogSampleCount);
  out.pinMilliVolts = milliVoltsTotal / config::kAnalogSampleCount;
  out.sourceMilliVolts =
      static_cast<uint32_t>(static_cast<float>(out.pinMilliVolts) / dividerRatio_ + 0.5f);

  if (calibration_.calibrated) {
    out.value = applyCalibration(calibration_, out.sourceMilliVolts);
    out.valueValid = true;
  } else {
    out.value = 0.0f;
    out.valueValid = false;
  }
  return true;
}

bool AnalogSensor::calibrateTwoPoint(uint32_t mv1, float value1, uint32_t mv2, float value2) {
  const Calibration fitted = fitTwoPoint(mv1, value1, mv2, value2);
  if (!fitted.calibrated) return false;
  calibration_ = fitted;
  return true;
}
