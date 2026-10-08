#pragma once

#include <stdint.h>

// PH-4502C analog pH board — one instance per probe (pre/post filtration).
//
// Reports only what can actually be measured: averaged raw ADC counts and
// millivolts. Millivolts come from analogReadMilliVolts(), which applies the
// chip's factory eFuse ADC calibration, so there is no hand-rolled voltage
// curve here.
//
// pH is NOT reported until the probe is calibrated. The millivolt-to-pH
// transfer of a PH-4502C depends on its onboard offset trim and on the
// individual electrode, and docs/PENDING_DECISIONS.md §12 leaves the curve
// parameters TBD. The default state is therefore "uncalibrated": read() still
// returns real millivolts, but Reading::phValid stays false. Two readings in
// buffer solutions, handed to calibrateTwoPoint(), supply the curve.
//
// Deliberately NOT done here: converting with the textbook -59.16 mV/pH
// Nernst slope. That is the ideal slope of a bare electrode, not this board's
// amplified and offset output, so using it would report a fabricated pH as if
// it had been measured (AGENTS.md: do not invent calibration values).
class PhSensor {
 public:
  // Linear fit: ph = slopePhPerMv * millivolts + interceptPh.
  struct Calibration {
    float slopePhPerMv = 0.0f;
    float interceptPh = 0.0f;
    bool calibrated = false;
  };

  struct Reading {
    uint16_t rawCounts = 0;
    uint32_t milliVolts = 0;
    float ph = 0.0f;
    // False while uncalibrated — `ph` is meaningless then, ignore it.
    bool phValid = false;
  };

  // Pure two-point fit, free of Arduino dependencies so it can be checked on
  // the host (see test/test_ph_calibration.cpp). Returns an uncalibrated
  // result when both points share a voltage, since that yields no slope.
  static Calibration fitTwoPoint(uint32_t mv1, float ph1, uint32_t mv2, float ph2) {
    Calibration result;
    if (mv1 == mv2) return result;
    const float deltaMv = static_cast<float>(mv2) - static_cast<float>(mv1);
    result.slopePhPerMv = (ph2 - ph1) / deltaMv;
    result.interceptPh = ph1 - result.slopePhPerMv * static_cast<float>(mv1);
    result.calibrated = true;
    return result;
  }

  static float applyCalibration(const Calibration& calibration, uint32_t milliVolts) {
    return calibration.slopePhPerMv * static_cast<float>(milliVolts) + calibration.interceptPh;
  }

  // `pin` must be an ADC1 GPIO. config::kPhPin* default to -1 (unassigned),
  // which leaves this sensor permanently disabled — the safe state while the
  // pin map is TBD.
  void begin(int pin);

  bool isEnabled() const { return pin_ >= 0; }

  // Averages config::kPhSampleCount samples. Returns false when disabled.
  // Non-blocking in practice: ADC reads are microseconds.
  bool read(Reading& out) const;

  // Convenience wrapper over fitTwoPoint(); stores the result.
  bool calibrateTwoPoint(uint32_t mv1, float ph1, uint32_t mv2, float ph2);

  const Calibration& calibration() const { return calibration_; }
  void setCalibration(const Calibration& calibration) { calibration_ = calibration; }

 private:
  int pin_ = -1;
  Calibration calibration_;
};
