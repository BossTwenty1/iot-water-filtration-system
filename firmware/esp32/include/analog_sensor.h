#pragma once

#include <stdint.h>

// Generic analog sensor channel — one instance per probe (pH, turbidity, TDS).
//
// All three are the same shape electrically: a board outputs a voltage, the
// ESP32 samples it, and converting that voltage into a physical unit needs a
// per-probe calibration curve. Only that curve differs, so they share this
// class rather than having one near-identical driver each.
//
// Reports what can actually be measured: averaged raw ADC counts and
// millivolts. Millivolts come from analogReadMilliVolts(), which applies the
// chip's factory eFuse ADC calibration, so there is no hand-rolled voltage
// curve here.
//
// The physical value is NOT reported until the channel is calibrated.
// docs/PENDING_DECISIONS.md §12 leaves per-probe curve parameters TBD, and for
// turbidity the sensor model itself is still unconfirmed (P0-03), so no
// voltage-to-NTU/ppm/pH transfer is known. Default state is "uncalibrated":
// read() still returns real millivolts, but Reading::valueValid stays false.
//
// Deliberately NOT done here: filling in a textbook transfer function (e.g. a
// -59.16 mV/pH Nernst slope, or a turbidity curve from a datasheet for a part
// we have not confirmed we own). Those would report fabricated measurements as
// if they had been measured.
class AnalogSensor {
 public:
  // Linear fit: value = slopePerMv * sourceMilliVolts + intercept.
  struct Calibration {
    float slopePerMv = 0.0f;
    float intercept = 0.0f;
    bool calibrated = false;
  };

  struct Reading {
    uint16_t rawCounts = 0;
    // Voltage at the ESP32 pin.
    uint32_t pinMilliVolts = 0;
    // Voltage at the sensor output, i.e. pin voltage corrected for any divider
    // between the board and the pin. Equals pinMilliVolts when dividerRatio is 1.
    uint32_t sourceMilliVolts = 0;
    float value = 0.0f;
    // False while uncalibrated — `value` is meaningless then, ignore it.
    bool valueValid = false;
  };

  // Pure two-point fit, free of Arduino dependencies so it can be checked on
  // the host. Returns an uncalibrated result when both points share a voltage,
  // since that yields no slope.
  static Calibration fitTwoPoint(uint32_t mv1, float value1, uint32_t mv2, float value2) {
    Calibration result;
    if (mv1 == mv2) return result;
    const float deltaMv = static_cast<float>(mv2) - static_cast<float>(mv1);
    result.slopePerMv = (value2 - value1) / deltaMv;
    result.intercept = value1 - result.slopePerMv * static_cast<float>(mv1);
    result.calibrated = true;
    return result;
  }

  static float applyCalibration(const Calibration& calibration, uint32_t milliVolts) {
    return calibration.slopePerMv * static_cast<float>(milliVolts) + calibration.intercept;
  }

  // `pin` must be an ADC1 GPIO; config::kPin* default to -1 (unassigned),
  // which leaves the channel disabled — the safe state while a pin is TBD.
  //
  // `dividerRatio` is pinVoltage / sourceVoltage for any resistor divider in
  // front of the pin (1.0 when wired directly). Boards running at 5 V need one,
  // since the ESP32 tolerates only 3.3 V.
  void begin(int pin, const char* label, float dividerRatio = 1.0f);

  bool isEnabled() const { return pin_ >= 0; }
  const char* label() const { return label_; }

  // Averages config::kAnalogSampleCount samples. Returns false when disabled.
  bool read(Reading& out) const;

  // Convenience wrapper over fitTwoPoint(); stores the result. Points are in
  // source millivolts, not pin millivolts.
  bool calibrateTwoPoint(uint32_t mv1, float value1, uint32_t mv2, float value2);

  const Calibration& calibration() const { return calibration_; }
  void setCalibration(const Calibration& calibration) { calibration_ = calibration; }

 private:
  int pin_ = -1;
  const char* label_ = "";
  float dividerRatio_ = 1.0f;
  Calibration calibration_;
};
