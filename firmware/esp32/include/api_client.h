#pragma once

#include <stdint.h>

// HTTPS client skeleton for the backend REST API (docs/API_CONTRACT.md).
//
// Structure only: it can POST a caller-supplied JSON string over verified TLS.
// It does not build payloads, schedule transmissions, retry, or buffer —
// payload fields, transmission interval, retry policy, and offline buffering
// are TBD (docs/API_CONTRACT.md §5, docs/PENDING_DECISIONS.md §6–§8).
//
// Safety: requests are synchronous and block the caller for up to the
// configured connect + response timeouts. Critical local control must never
// wait on this client (see the TODO in main.cpp).
class ApiClient {
 public:
  enum class Status : uint8_t {
    kOk,             // Server answered with 2xx.
    kHttpError,      // Server answered with a non-2xx status (see httpCode).
    kTransportError, // TLS/connection/timeout failure (httpCode < 0).
    kNotConfigured,  // Missing https base URL or root CA; nothing was sent.
    kRouteUndefined, // Endpoint path is TBD; nothing was sent.
    kWifiDown,       // Wi-Fi not connected; nothing was sent.
    kInvalidRequest, // Null body or URL too long; nothing was sent.
  };

  struct Result {
    Status status;
    int httpCode;  // HTTP status, a negative HTTPClient error, or 0 if not sent.
  };

  // baseUrl/rootCaPem must outlive this object (string literals from secrets.h).
  // baseUrl must start with "https://"; rootCaPem must be a non-empty PEM.
  void begin(const char* baseUrl, const char* rootCaPem);
  bool isConfigured() const { return configured_; }

  // POSTs `jsonBody` to baseUrl + config::kApiBasePath + `path`.
  Result postJson(const char* path, const char* jsonBody, bool wifiConnected);

  // POSTs to the telemetry route. Returns kRouteUndefined while
  // config::kApiTelemetryPath is empty (TBD).
  Result postTelemetry(const char* jsonBody, bool wifiConnected);

  static const char* statusName(Status status);

 private:
  const char* baseUrl_ = nullptr;
  const char* rootCaPem_ = nullptr;
  bool configured_ = false;
};
