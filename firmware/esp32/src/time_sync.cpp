#include "time_sync.h"

#include <Arduino.h>
#include <esp_sntp.h>
#include <sys/time.h>
#include <time.h>

#include <atomic>

#include "config.h"

namespace {

// Set from the SNTP callback, which runs in the lwIP/tcpip task — keep it
// minimal and lock-free; logging happens later from loop().
std::atomic<bool> gSynced{false};

void onTimeSynced(struct timeval* /*tv*/) { gSynced.store(true); }

}  // namespace

void TimeSync::loop(bool wifiConnected) {
  if (!started_ && wifiConnected) {
    sntp_set_time_sync_notification_cb(onTimeSynced);
    // UTC only: the device reports UTC; local-time display is not in scope.
    configTzTime("UTC0", config::kNtpServerPrimary, config::kNtpServerSecondary);
    started_ = true;
    Serial.printf("[time] SNTP started (%s, %s)\n", config::kNtpServerPrimary,
                  config::kNtpServerSecondary);
  }

  if (!loggedFirstSync_ && isSynced()) {
    loggedFirstSync_ = true;
    char now[kIso8601BufferSize];
    formatUtcIso8601(now, sizeof(now));
    Serial.printf("[time] synced: %s\n", now);
  }
}

bool TimeSync::isSynced() const { return gSynced.load(); }

bool TimeSync::formatUtcIso8601(char* buffer, size_t bufferSize) const {
  if (buffer == nullptr || bufferSize == 0) {
    return false;
  }
  buffer[0] = '\0';
  if (bufferSize < kIso8601BufferSize || !isSynced()) {
    return false;
  }

  const time_t now = time(nullptr);
  struct tm utc;
  if (gmtime_r(&now, &utc) == nullptr) {
    return false;
  }
  const size_t written = strftime(buffer, bufferSize, "%Y-%m-%dT%H:%M:%SZ", &utc);
  if (written != kIso8601BufferSize - 1) {
    buffer[0] = '\0';
    return false;
  }
  return true;
}
