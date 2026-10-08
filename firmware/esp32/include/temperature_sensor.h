#pragma once

#include <stddef.h>
#include <stdint.h>

// DS18B20 digital temperature probe(s) on a shared OneWire bus.
//
// Unlike the analog channels, this one needs no project calibration: a DS18B20
// is factory-calibrated and returns degrees Celsius directly over the bus
// (±0.5 °C over most of its range, per the part's own specification). So
// readCelsius() is valid as soon as a device is found — there is no curve to
// invent and nothing to defer.
//
// Several probes can share one data line, which is how the pre/post pair will
// eventually be wired; devices are addressed by index here and each one's
// 64-bit ROM address can be printed to tell them apart.
class TemperatureSensor {
 public:
  // Length of the buffer formatAddress() needs: 16 hex digits + NUL.
  static constexpr size_t kAddressBufferSize = 17;

  // Scans the bus. `pin` of -1 leaves the sensor disabled.
  void begin(int pin);

  bool isEnabled() const { return pin_ >= 0; }

  // Devices found during begin(). Zero means nothing answered — either nothing
  // is wired, or the 4.7 kOhm pull-up is missing.
  uint8_t deviceCount() const { return deviceCount_; }

  // Triggers a conversion on every device and caches the results. Blocks for
  // the conversion time (up to ~750 ms at 12-bit), so call it from the sampling
  // path, not from a tight loop.
  bool update();

  // Celsius for one device, from the last update(). False when the index is out
  // of range or the device reported a disconnect.
  bool readCelsius(uint8_t index, float& out) const;

  // Last value as returned by the library, sentinel included — for diagnosis.
  float lastRawCelsius(uint8_t index) const { return index < deviceCount_ ? celsius_[index] : 0.0f; }

  // Writes the device's ROM address as hex. Buffer must be kAddressBufferSize.
  bool formatAddress(uint8_t index, char* buffer, size_t bufferSize) const;

  // Raw 9-byte scratchpad for one device, for bring-up diagnosis. Returns
  // false if the index is out of range or the read fails its CRC. The contents
  // separate causes a temperature value alone cannot: all 0xFF means nothing
  // drove the bus, 0x0550 in the temperature register is the DS18B20's
  // power-on default and means no conversion ever completed, and a CRC failure
  // on otherwise-plausible bytes points at signal integrity.
  bool readScratchpad(uint8_t index, uint8_t* out, size_t outSize) const;

  // True when devices are drawing power from the data line instead of VCC.
  // Parasite mode needs a strong pull-up during conversion; a probe that
  // enumerates but then fails to convert is usually powered this way by
  // accident (VCC left unconnected).
  bool isParasitePowered() const { return parasitePowered_; }

 private:
  static constexpr uint8_t kMaxDevices = 4;
  // Scratchpad read attempts per sample before declaring a fault.
  static constexpr uint8_t kReadAttempts = 3;

  int pin_ = -1;
  uint8_t deviceCount_ = 0;
  bool parasitePowered_ = false;
  uint8_t addresses_[kMaxDevices][8] = {};
  float celsius_[kMaxDevices] = {};
  bool valid_[kMaxDevices] = {};
};
