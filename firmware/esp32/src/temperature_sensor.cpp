#include "temperature_sensor.h"

#include <Arduino.h>
#include <DallasTemperature.h>
#include <OneWire.h>

namespace {

// One bus in the harness. Held here rather than in the header so OneWire and
// DallasTemperature stay out of every translation unit that includes it.
OneWire gOneWire;
DallasTemperature gDallas(&gOneWire);

}  // namespace

void TemperatureSensor::begin(int pin) {
  pin_ = pin;
  deviceCount_ = 0;
  if (pin_ < 0) return;  // Unassigned pin (pin map TBD) — stays disabled.

  gOneWire.begin(static_cast<uint8_t>(pin_));
  gDallas.begin();

  parasitePowered_ = gDallas.isParasitePowerMode();
  const uint8_t found = gDallas.getDeviceCount();
  deviceCount_ = (found > kMaxDevices) ? kMaxDevices : found;
  for (uint8_t i = 0; i < deviceCount_; ++i) {
    if (!gDallas.getAddress(addresses_[i], i)) {
      // Address read failed — treat the device as absent rather than reporting
      // readings that cannot be attributed to a known probe.
      deviceCount_ = i;
      break;
    }
  }
}

bool TemperatureSensor::update() {
  if (pin_ < 0 || deviceCount_ == 0) return false;

  gDallas.requestTemperatures();
  for (uint8_t i = 0; i < deviceCount_; ++i) {
    const float value = gDallas.getTempC(addresses_[i]);
    // The library returns a sentinel when a probe does not answer; surfacing it
    // as "invalid" is what lets sensor-fault detection (P5-07) see a failure
    // instead of a plausible-looking number.
    valid_[i] = (value != DEVICE_DISCONNECTED_C);
    celsius_[i] = valid_[i] ? value : 0.0f;
  }
  return true;
}

bool TemperatureSensor::readCelsius(uint8_t index, float& out) const {
  if (index >= deviceCount_ || !valid_[index]) return false;
  out = celsius_[index];
  return true;
}

bool TemperatureSensor::formatAddress(uint8_t index, char* buffer, size_t bufferSize) const {
  if (index >= deviceCount_ || buffer == nullptr || bufferSize < kAddressBufferSize) return false;
  for (uint8_t byteIndex = 0; byteIndex < 8; ++byteIndex) {
    snprintf(buffer + byteIndex * 2, 3, "%02X", addresses_[index][byteIndex]);
  }
  buffer[16] = '\0';
  return true;
}
