#pragma once

#include <stddef.h>

// UTC wall-clock time via SNTP.
//
// SNTP is started once, after Wi-Fi first connects (starting it before the
// network stack is up is unsafe on some Arduino-ESP32 versions). After that,
// lwIP keeps re-syncing in the background, including across Wi-Fi reconnects.
//
// Until the first successful sync the clock is not trustworthy (it starts at
// 1970), so formatUtcIso8601() refuses to produce a timestamp.
class TimeSync {
 public:
  // "YYYY-MM-DDTHH:MM:SSZ" + NUL, matching docs/API_CONTRACT.md §3.
  static constexpr size_t kIso8601BufferSize = 21;

  // Call every main-loop iteration. Non-blocking.
  void loop(bool wifiConnected);

  bool isSynced() const;

  // Writes current UTC time as ISO-8601 (e.g. "2026-09-14T14:30:00Z").
  // Returns false and writes an empty string if time is not yet synced or the
  // buffer is smaller than kIso8601BufferSize.
  bool formatUtcIso8601(char* buffer, size_t bufferSize) const;

 private:
  bool started_ = false;
  bool loggedFirstSync_ = false;
};
