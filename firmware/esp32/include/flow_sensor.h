#pragma once

#include <stdint.h>

// Hall-effect pulse-output flow sensor.
//
// Reports pulse count and frequency always — those are directly measured.
// Volumetric flow is NOT reported until a K-factor (pulses per litre) is
// configured, because that constant is part-specific and the part is not
// settled: the wiring diagram labels this YF-S201 while tracker task P5-05
// names a ZJ-S201C. Those are different part numbers with different K-factors,
// so picking one would be guessing at the hardware.
//
// Only one flow sensor exists in the harness, so the ISR uses a single
// file-scope counter rather than a per-instance registry.
class FlowSensor {
 public:
  struct Reading {
    uint32_t pulses = 0;      // Since the previous read().
    uint32_t totalPulses = 0; // Since begin().
    uint32_t intervalMs = 0;
    float hertz = 0.0f;
    float litresPerMinute = 0.0f;
    // False until a K-factor is set — `litresPerMinute` is meaningless then.
    bool flowValid = false;
  };

  // `pulsesPerLitre` of 0 leaves flow uncalibrated (the default).
  void begin(int pin, float pulsesPerLitre = 0.0f);
  bool isEnabled() const { return pin_ >= 0; }

  // Returns false when disabled, or when called twice within the same
  // millisecond (no interval to divide by).
  bool read(Reading& out, uint32_t nowMs);

  void setPulsesPerLitre(float pulsesPerLitre) { pulsesPerLitre_ = pulsesPerLitre; }
  float pulsesPerLitre() const { return pulsesPerLitre_; }

 private:
  int pin_ = -1;
  float pulsesPerLitre_ = 0.0f;
  uint32_t lastReadMs_ = 0;
  uint32_t lastTotal_ = 0;
};
