#pragma once
// PC stand-in: the PC is always "connected", so no Wi-Fi code runs.
#include "Arduino.h"

struct PcWiFi {
  int RSSI() { return 0; }
};
inline PcWiFi WiFi;
