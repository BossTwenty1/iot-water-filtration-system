#pragma once

#include <stddef.h>
#include <stdint.h>

// HTTPS client for the backend REST API (verified TLS, optional X-Device-Key header).
//
// POSTs a caller-supplied JSON string, or GETs JSON into a caller's buffer. It does
// not build payloads, schedule transmissions, retry, or buffer.
//
// Requests are synchronous and block the caller for up to the configured
// connect + response timeouts (and longer during the TLS handshake), so they
// must never run on the task that handles sensors, menus or the display.
class ApiClient {
 public:
  enum class Status : uint8_t {
    kOk,               // Server answered with 2xx.
    kHttpError,        // Server answered with a non-2xx status (see httpCode).
    kTransportError,   // TLS/connection/timeout failure (httpCode < 0).
    kNotConfigured,    // Missing https base URL or root CA; nothing was sent.
    kRouteUndefined,   // Endpoint path or device UUID is empty; nothing was sent.
    kWifiDown,         // Wi-Fi not connected; nothing was sent.
    kTimeNotSynced,    // Clock not set yet, so the certificate cannot be verified; nothing was sent.
    kInvalidRequest,   // Null body, bad path or URL too long; nothing was sent.
    kResponseTooLarge, // Answer did not fit the caller's buffer.
  };

  struct Result {
    Status status;
    int httpCode;  // HTTP status, a negative HTTPClient error, or 0 if not sent.
  };

  // All strings must outlive this object (string literals from secrets.h).
  // baseUrl must start with "https://"; rootCaPem must be a non-empty PEM.
  // deviceKey ("" = none) is sent as "X-Device-Key: <key>" on every request.
  void begin(const char* baseUrl, const char* rootCaPem, const char* deviceKey = "");
  bool isConfigured() const { return configured_; }

  // `path` starts with '/'; the URL is baseUrl + config::kApiBasePath + path.
  Result postJson(const char* path, const char* jsonBody, bool wifiConnected, bool timeSynced);
  Result getJson(const char* path, char* response, size_t responseCap, bool wifiConnected, bool timeSynced);

  // POSTs to /devices/{deviceUuid}/readings (config::kApiReadingsPathFormat).
  // kRouteUndefined while the format or the UUID is empty.
  Result postReadings(const char* deviceUuid, const char* jsonBody, bool wifiConnected, bool timeSynced);

  static const char* statusName(Status status);

 private:
  Result request(bool isPost, const char* path, const char* body, char* response,
                 size_t responseCap, bool wifiConnected, bool timeSynced);

  const char* baseUrl_ = nullptr;
  const char* rootCaPem_ = nullptr;
  const char* deviceKey_ = "";
  size_t baseLen_ = 0;  // baseUrl_ length without trailing '/' characters
  bool configured_ = false;
};
