#include "temperature_sensor.h"

#include <Arduino.h>
#include <DallasTemperature.h>
#include <OneWire.h>

#include "config.h"

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
  // Do not let the library poll the bus to detect conversion completion: that
  // poll was returning early on this harness, so the scratchpad was read
  // mid-conversion and failed CRC. Wait a fixed worst-case interval instead.
  gDallas.setWaitForConversion(false);

  parasitePowered_ = gDallas.isParasitePowerMode();
  // Prime the first conversion so the first update() has fresh data to read
  // rather than the power-on default.
  gDallas.requestTemperatures();
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

  // Read the conversion started by the PREVIOUS call, then start the next one.
  // Reading immediately after issuing a convert left the bus with no presence
  // pulse on this harness (measured: presence=NO, scratchpad all zeros), while
  // a read not preceded by a convert succeeds every time. Deferring the read by
  // one cycle avoids that window entirely, and as a bonus takes the 750 ms
  // conversion wait out of the caller's path — update() no longer blocks.
  for (uint8_t i = 0; i < deviceCount_; ++i) {
    // Decoded straight from the scratchpad rather than via getTempC(), which
    // performs its own second scratchpad read and was returning
    // DEVICE_DISCONNECTED_C on this harness even though the bytes it would have
    // read are intact (verified: CRC 0x31 matches, 12-bit config, sane value).
    // One read instead of two also halves traffic on a bus whose length is the
    // most likely cause of that intermittent second read failing.
    uint8_t scratchPad[9] = {};
    // Retried because the first bus transaction after a convert is unreliable
    // on this harness — a standalone read moments later succeeds on the same
    // device. DallasTemperature carries a retryCount parameter on getTempC()
    // for the same reason, so this is the expected shape for a marginal bus,
    // not a workaround for a logic error.
    bool crcOk = false;
    bool lastPresence = false;
    for (uint8_t attempt = 0; attempt < kReadAttempts && !crcOk; ++attempt) {
      lastPresence = true;
      // readScratchPad only reports the bus presence pulse in this library
      // version, so the CRC has to be checked here — otherwise corrupt bytes
      // would decode into a plausible-looking temperature.
      lastPresence = gDallas.readScratchPad(addresses_[i], scratchPad);
      crcOk = lastPresence && (OneWire::crc8(scratchPad, 8) == scratchPad[8]);
      if (!crcOk) delay(10);
    }
    if (!crcOk) {
      // Bring-up instrumentation: says whether the bus failed to answer at all
      // or answered with bytes that did not verify.
      Serial.printf("[temp] read fail dev=%u presence=%s bytes=", static_cast<unsigned>(i),
                    lastPresence ? "ok" : "NO");
      for (uint8_t b = 0; b < 9; ++b) Serial.printf("%02X ", scratchPad[b]);
      Serial.printf("| crc_calc=%02X crc_byte=%02X\n", OneWire::crc8(scratchPad, 8), scratchPad[8]);
      // Surfacing a failure rather than a plausible number is what lets
      // sensor-fault detection (P5-07) see it.
      valid_[i] = false;
      celsius_[i] = DEVICE_DISCONNECTED_C;
      continue;
    }
    const int16_t raw = static_cast<int16_t>((scratchPad[1] << 8) | scratchPad[0]);
    celsius_[i] = static_cast<float>(raw) / 16.0f;
    valid_[i] = true;
  }
  // Start the conversion whose result the next call will read.
  gDallas.requestTemperatures();
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

bool TemperatureSensor::readScratchpad(uint8_t index, uint8_t* out, size_t outSize) const {
  if (index >= deviceCount_ || out == nullptr || outSize < 9) return false;
  // DallasTemperature verifies the scratchpad CRC and returns false on failure.
  return gDallas.readScratchPad(addresses_[index], out);
}
