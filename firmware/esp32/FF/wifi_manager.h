#pragma once

#include <stdint.h>

// Non-blocking Wi-Fi station manager.
//
// begin() starts the first connection attempt and returns immediately.
// loop() must be called often; it never blocks or delays.
// A lost connection is retried immediately; an attempt that does not reach
// WL_CONNECTED within the connect timeout is retried with capped exponential
// backoff. The driver's own auto-reconnect is disabled so there is exactly one
// reconnect policy.
//
// Wi-Fi is not required for local operation: callers must keep working when
// isConnected() is false.
class WifiManager {
 public:
  enum class State : uint8_t {
    kDisabled,        // No SSID configured, or Wi-Fi was stopped by the user (stop()).
    kConnecting,      // WiFi.begin() issued, waiting for association + IP.
    kConnected,       // Associated with an IP address.
    kWaitingToRetry,  // Backing off before the next attempt.
  };

  // ssid/password must outlive this object (string literals from secrets.h).
  void begin(const char* ssid, const char* password, uint32_t nowMs);
  void loop(uint32_t nowMs);

  // Manual connection (used by the Wi-Fi menu). Unlike begin(), both strings are
  // COPIED, so they may come from a temporary buffer. Drops the current connection
  // and starts a new attempt at once. Blocks for at most ~0.5 s while the old
  // association is torn down; the attempt itself is then driven by loop().
  void connectTo(const char* ssid, const char* password);

  // Turns the radio off. State becomes kDisabled until begin() or connectTo().
  void stop();

  // SSID of the network being used or attempted ("" if none).
  const char* ssid() const { return ssid_ ? ssid_ : ""; }

  bool isConnected() const { return state_ == State::kConnected; }
  State state() const { return state_; }
  static const char* stateName(State state);

 private:
  void startAttempt(uint32_t nowMs);
  void scheduleRetry(uint32_t nowMs);
  static const char* statusName(int wlStatus);

  const char* ssid_ = nullptr;
  const char* password_ = nullptr;
  // volatile: isConnected() is also read from the telemetry task.
  volatile State state_ = State::kDisabled;
  uint32_t attemptStartedMs_ = 0;
  uint32_t retryAtMs_ = 0;
  uint32_t backoffMs_ = 0;
  uint32_t attemptCount_ = 0;
  char manualSsid_[33] = "";      // 802.11 limit: 32 characters + NUL
  char manualPassword_[65] = "";  // WPA2 limit: 63 characters (or 64 hex digits) + NUL
};
