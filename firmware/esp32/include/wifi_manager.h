#pragma once

#include <stdint.h>

// Non-blocking Wi-Fi station manager.
//
// begin() starts the first connection attempt and returns immediately.
// loop() must be called every main-loop iteration; it never blocks or delays.
// A lost connection is retried immediately; an attempt that does not reach
// WL_CONNECTED within the connect timeout is retried with capped exponential
// backoff. The driver's own auto-reconnect is disabled so there is exactly one
// reconnect policy.
//
// Wi-Fi is not required for local operation: callers must keep working when
// isConnected() is false (AGENTS.md "Hardware and Firmware Boundaries").
class WifiManager {
 public:
  enum class State : uint8_t {
    kDisabled,        // No SSID configured; Wi-Fi is never started.
    kConnecting,      // WiFi.begin() issued, waiting for association + IP.
    kConnected,       // Associated with an IP address.
    kWaitingToRetry,  // Backing off before the next attempt.
  };

  // ssid/password must outlive this object (string literals from secrets.h).
  void begin(const char* ssid, const char* password, uint32_t nowMs);
  void loop(uint32_t nowMs);

  bool isConnected() const { return state_ == State::kConnected; }
  State state() const { return state_; }
  static const char* stateName(State state);

 private:
  void startAttempt(uint32_t nowMs);
  void scheduleRetry(uint32_t nowMs);
  static const char* statusName(int wlStatus);

  const char* ssid_ = nullptr;
  const char* password_ = nullptr;
  State state_ = State::kDisabled;
  uint32_t attemptStartedMs_ = 0;
  uint32_t retryAtMs_ = 0;
  uint32_t backoffMs_ = 0;
  uint32_t attemptCount_ = 0;
};
