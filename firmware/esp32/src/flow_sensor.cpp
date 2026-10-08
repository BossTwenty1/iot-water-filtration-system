#include "flow_sensor.h"

#include <Arduino.h>

namespace {

// Single sensor in the harness, so one counter is enough. Guarded by a spinlock
// because the ISR runs on either core.
volatile uint32_t gPulseCount = 0;
portMUX_TYPE gPulseMux = portMUX_INITIALIZER_UNLOCKED;

void IRAM_ATTR onPulse() {
  portENTER_CRITICAL_ISR(&gPulseMux);
  ++gPulseCount;
  portEXIT_CRITICAL_ISR(&gPulseMux);
}

uint32_t takePulseCount() {
  portENTER_CRITICAL(&gPulseMux);
  const uint32_t value = gPulseCount;
  portEXIT_CRITICAL(&gPulseMux);
  return value;
}

}  // namespace

void FlowSensor::begin(int pin, float pulsesPerLitre) {
  pin_ = pin;
  pulsesPerLitre_ = pulsesPerLitre;
  if (pin_ < 0) return;  // Unassigned pin (pin map TBD) — stays disabled.
  // The harness divides the sensor's 5 V output down to ~3 V, so no internal
  // pull is needed or wanted here.
  pinMode(pin_, INPUT);
  portENTER_CRITICAL(&gPulseMux);
  gPulseCount = 0;
  portEXIT_CRITICAL(&gPulseMux);
  lastTotal_ = 0;
  lastReadMs_ = millis();
  attachInterrupt(digitalPinToInterrupt(pin_), onPulse, RISING);
}

bool FlowSensor::read(Reading& out, uint32_t nowMs) {
  if (pin_ < 0) return false;

  const uint32_t total = takePulseCount();
  const uint32_t elapsedMs = nowMs - lastReadMs_;
  if (elapsedMs == 0) return false;

  out.totalPulses = total;
  out.pulses = total - lastTotal_;
  out.intervalMs = elapsedMs;
  out.hertz = (static_cast<float>(out.pulses) * 1000.0f) / static_cast<float>(elapsedMs);

  if (pulsesPerLitre_ > 0.0f) {
    const float litres = static_cast<float>(out.pulses) / pulsesPerLitre_;
    out.litresPerMinute = litres * (60000.0f / static_cast<float>(elapsedMs));
    out.flowValid = true;
  } else {
    out.litresPerMinute = 0.0f;
    out.flowValid = false;
  }

  lastTotal_ = total;
  lastReadMs_ = nowMs;
  return true;
}
