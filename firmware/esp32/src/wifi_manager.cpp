#include "wifi_manager.h"

#include <Arduino.h>
#include <WiFi.h>

#include "config.h"

namespace {

// True once `now` has reached `deadline`. Correct across millis() rollover
// (~49.7 days) as long as the two are less than 2^31 ms apart.
bool reached(uint32_t now, uint32_t deadline) {
  return static_cast<int32_t>(now - deadline) >= 0;
}

}  // namespace

void WifiManager::begin(const char* ssid, const char* password, uint32_t nowMs) {
  ssid_ = ssid;
  password_ = password;

  if (ssid_ == nullptr || ssid_[0] == '\0') {
    state_ = State::kDisabled;
    Serial.println(F("[wifi] no SSID configured - Wi-Fi disabled, continuing offline"));
    return;
  }

  // Keep credentials out of NVS flash (avoids a flash write on every begin()),
  // and own the reconnect policy here instead of the driver's auto-reconnect.
  WiFi.persistent(false);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(false);

  backoffMs_ = config::kWifiRetryBackoffInitialMs;
  startAttempt(nowMs);
}

void WifiManager::loop(uint32_t nowMs) {
  switch (state_) {
    case State::kDisabled:
      return;

    case State::kConnecting:
      // Only WL_CONNECTED or the timeout decide an attempt. Failure statuses
      // (WL_NO_SSID_AVAIL, WL_CONNECT_FAILED) are event-driven and can be left
      // over from the previous attempt, so reacting to them here would abort a
      // fresh attempt immediately. They are reported in the timeout log instead.
      if (WiFi.status() == WL_CONNECTED) {
        state_ = State::kConnected;
        backoffMs_ = config::kWifiRetryBackoffInitialMs;
        Serial.printf("[wifi] connected: ip=%s rssi=%d dBm (attempt %lu)\n",
                      WiFi.localIP().toString().c_str(), WiFi.RSSI(),
                      static_cast<unsigned long>(attemptCount_));
      } else if (reached(nowMs, attemptStartedMs_ + config::kWifiConnectTimeoutMs)) {
        scheduleRetry(nowMs);
      }
      return;

    case State::kConnected:
      if (WiFi.status() != WL_CONNECTED) {
        Serial.println(F("[wifi] connection lost"));
        WiFi.disconnect();  // Clear the stale association before reconnecting.
        // First reconnect attempt is immediate; backoff applies if it fails.
        backoffMs_ = config::kWifiRetryBackoffInitialMs;
        startAttempt(nowMs);
      }
      return;

    case State::kWaitingToRetry:
      if (reached(nowMs, retryAtMs_)) {
        startAttempt(nowMs);
      }
      return;
  }
}

void WifiManager::startAttempt(uint32_t nowMs) {
  ++attemptCount_;
  Serial.printf("[wifi] connecting to \"%s\" (attempt %lu)\n", ssid_,
                static_cast<unsigned long>(attemptCount_));
  WiFi.begin(ssid_, password_);
  attemptStartedMs_ = nowMs;
  state_ = State::kConnecting;
}

void WifiManager::scheduleRetry(uint32_t nowMs) {
  // Capture the driver's last reported status before disconnect() changes it.
  const int lastStatus = static_cast<int>(WiFi.status());
  WiFi.disconnect();  // Abort the pending attempt before backing off.
  retryAtMs_ = nowMs + backoffMs_;
  state_ = State::kWaitingToRetry;
  Serial.printf("[wifi] attempt %lu timed out (last status %d: %s) - retrying in %lu ms\n",
                static_cast<unsigned long>(attemptCount_), lastStatus,
                statusName(lastStatus), static_cast<unsigned long>(backoffMs_));

  // Exponential backoff, capped.
  backoffMs_ = (backoffMs_ >= config::kWifiRetryBackoffMaxMs / 2)
                   ? config::kWifiRetryBackoffMaxMs
                   : backoffMs_ * 2;
}

const char* WifiManager::statusName(int wlStatus) {
  switch (wlStatus) {
    case WL_IDLE_STATUS:     return "idle";
    case WL_NO_SSID_AVAIL:   return "SSID not found";
    case WL_CONNECTED:       return "connected";
    case WL_CONNECT_FAILED:  return "connect failed / auth rejected";
    case WL_CONNECTION_LOST: return "connection lost";
    case WL_DISCONNECTED:    return "disconnected";
    default:                 return "other";
  }
}

const char* WifiManager::stateName(State state) {
  switch (state) {
    case State::kDisabled:       return "disabled";
    case State::kConnecting:     return "connecting";
    case State::kConnected:      return "connected";
    case State::kWaitingToRetry: return "waiting-to-retry";
  }
  return "unknown";
}
