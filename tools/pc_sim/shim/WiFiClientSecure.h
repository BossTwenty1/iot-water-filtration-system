#pragma once
// PC stand-in for the ESP32 TLS client. It only keeps the root CA that the
// firmware passes in (API_ROOT_CA_PEM); HTTPClient hands it to curl, so the
// server certificate is verified against exactly the same root as on the board.
#include "Arduino.h"

class WiFiClientSecure {
 public:
  void setCACert(const char *pem) { caPem_ = pem ? pem : ""; }
  const std::string &caPem() const { return caPem_; }
  int lastError(char *buf, size_t size) { if (size) buf[0] = '\0'; return 0; }
 private:
  std::string caPem_;
};
