#include "api_client.h"

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <stdio.h>
#include <string.h>

#include "net_config.h"

namespace {

constexpr char kHttpsScheme[] = "https://";

bool isNullOrEmpty(const char* s) { return s == nullptr || s[0] == '\0'; }

// Short meaning of an HTTP status code, with a hint for the ones this firmware hits most.
const char* httpReason(int code)
{
  switch (code)
  {
    case 400: return "Bad Request - the server rejected the payload (invalid/missing field or value)";
    case 401: return "Unauthorized - X-Device-Key missing or wrong";
    case 403: return "Forbidden - device key is not allowed for this device UUID";
    case 404: return "Not Found - wrong route or device UUID does not exist on the backend";
    case 405: return "Method Not Allowed - route exists but not for this HTTP method";
    case 408: return "Request Timeout";
    case 409: return "Conflict - duplicate or conflicting data";
    case 413: return "Payload Too Large";
    case 415: return "Unsupported Media Type - Content-Type must be application/json";
    case 422: return "Unprocessable Entity - JSON is valid but a value failed validation";
    case 429: return "Too Many Requests - uploading too often";
    case 500: return "Internal Server Error - backend crashed handling the request";
    case 502: return "Bad Gateway - backend host is down or restarting";
    case 503: return "Service Unavailable - backend is waking up or overloaded (Render free tier cold start?)";
    case 504: return "Gateway Timeout - backend took too long to answer";
    default:
      if (code >= 300 && code < 400) return "Redirect - the URL moved (check API_BASE_URL)";
      if (code >= 400 && code < 500) return "Client error";
      if (code >= 500)               return "Server error";
      return "";
  }
}

}  // namespace

void ApiClient::begin(const char* baseUrl, const char* rootCaPem, const char* deviceKey)
{
  baseUrl_ = baseUrl;
  rootCaPem_ = rootCaPem;
  deviceKey_ = deviceKey ? deviceKey : "";
  baseLen_ = 0;
  configured_ = false;

  if (isNullOrEmpty(baseUrl_))
  {
    Serial.println(F("[api] no base URL configured - backend API disabled"));
    return;
  }
  if (strncmp(baseUrl_, kHttpsScheme, strlen(kHttpsScheme)) != 0)
  {
    Serial.println(F("[api] base URL is not https:// - backend API disabled"));
    return;
  }

  // A trailing '/' in the base URL would produce "host//api/v1/...", so ignore it.
  baseLen_ = strlen(baseUrl_);
  while (baseLen_ > 0 && baseUrl_[baseLen_ - 1] == '/')
  {
    --baseLen_;
  }
  if (baseLen_ <= strlen(kHttpsScheme))
  {
    Serial.println(F("[api] base URL has no host name - backend API disabled"));
    return;
  }

  if (isNullOrEmpty(rootCaPem_))
  {
    // Never fall back to WiFiClientSecure::setInsecure(): an unverified TLS
    // connection would accept any server, including an impostor.
    Serial.println(F("[api] no root CA configured - backend API disabled"));
    return;
  }

  configured_ = true;
  Serial.printf("[api] backend: %.*s%s%s\n", static_cast<int>(baseLen_), baseUrl_,
                config::kApiBasePath, deviceKey_[0] ? " (with device key)" : " (no device key)");
}

ApiClient::Result ApiClient::request(bool isPost, const char* path, const char* body,
                                     char* response, size_t responseCap,
                                     bool wifiConnected, bool timeSynced)
{
  if (response != nullptr && responseCap > 0) response[0] = '\0';

  if (!configured_) return {Status::kNotConfigured, 0};
  if (path == nullptr || path[0] != '/' || (isPost && body == nullptr)) return {Status::kInvalidRequest, 0};
  // Checked before any network I/O so an offline device never blocks on DNS or TLS here.
  if (!wifiConnected) return {Status::kWifiDown, 0};
  // The clock starts at 1970, so every certificate would look "not yet valid".
  if (!timeSynced) return {Status::kTimeNotSynced, 0};

  char url[config::kMaxUrlLength];
  const int urlLength = snprintf(url, sizeof(url), "%.*s%s%s", static_cast<int>(baseLen_),
                                 baseUrl_, config::kApiBasePath, path);
  if (urlLength < 0 || static_cast<size_t>(urlLength) >= sizeof(url))
  {
    Serial.println(F("[api] URL too long - request not sent"));
    return {Status::kInvalidRequest, 0};
  }

  const uint32_t startMs = millis();
  WiFiClientSecure tlsClient;
  tlsClient.setCACert(rootCaPem_);

  HTTPClient http;
  http.setConnectTimeout(config::kHttpConnectTimeoutMs);
  http.setTimeout(config::kHttpResponseTimeoutMs);
  http.setReuse(false);

  if (!http.begin(tlsClient, url))
  {
    Serial.printf("[api] %s %s - invalid URL, request not sent\n", isPost ? "POST" : "GET", url);
    return {Status::kInvalidRequest, 0};
  }
  http.addHeader("Accept", "application/json");
  if (isPost) http.addHeader("Content-Type", "application/json");
  if (deviceKey_[0] != '\0') http.addHeader("X-Device-Key", deviceKey_);

  // HTTPClient::POST takes a non-const buffer but only writes it to the socket,
  // so casting away const is safe here.
  const int code = isPost
      ? http.POST(reinterpret_cast<uint8_t*>(const_cast<char*>(body)), strlen(body))
      : http.GET();

  bool tooLarge = false;
  String errorBody;
  if (code >= 200 && code < 300 && response != nullptr && responseCap > 0)
  {
    String text = http.getString();
    if (text.length() < responseCap) memcpy(response, text.c_str(), text.length() + 1);
    else                             tooLarge = true;
  }
  else if (code >= 300)
  {
    // Must be read BEFORE http.end(): the server's explanation of the error
    // (e.g. which field failed validation) is in the response body.
    errorBody = http.getString();
  }
  http.end();

  if (code < 0)
  {
    Serial.printf("[api] %s %s - transport error %d (%s)\n", isPost ? "POST" : "GET", url, code,
                  HTTPClient::errorToString(code).c_str());
    // The TLS layer knows the real reason (certificate check failed, handshake timeout, DNS...).
    char tlsError[128] = "";
    const int tlsCode = tlsClient.lastError(tlsError, sizeof(tlsError));
    if (tlsCode != 0) Serial.printf("[api] TLS error %d: %s\n", tlsCode, tlsError);
    else              Serial.println(F("[api] no TLS error - the TCP connection itself failed (DNS, server asleep, or timeout)"));
    // How long it took and what the board looked like: an instant failure points at DNS or low
    // memory, one near the connect timeout points at a slow/asleep server or weak Wi-Fi.
    Serial.printf("[api] failed after %lu ms | free heap %lu B (largest block %lu B, lowest ever %lu B) | RSSI %d dBm\n",
                  (unsigned long)(millis() - startMs), (unsigned long)ESP.getFreeHeap(),
                  (unsigned long)ESP.getMaxAllocHeap(), (unsigned long)ESP.getMinFreeHeap(),
                  (int)WiFi.RSSI());
    return {Status::kTransportError, code};
  }
  if (code >= 200 && code < 300)
  {
    Serial.printf("[api] %s %s - HTTP %d\n", isPost ? "POST" : "GET", url, code);
  }
  else
  {
    Serial.printf("[api] %s %s - HTTP %d: %s\n", isPost ? "POST" : "GET", url, code, httpReason(code));
    if (errorBody.length() > 0)
    {
      Serial.printf("[api] server says: %.400s%s\n", errorBody.c_str(),
                    errorBody.length() > 400 ? "..." : "");
    }
    else
    {
      Serial.println(F("[api] server sent no error details"));
    }
  }

  if (tooLarge) return {Status::kResponseTooLarge, code};
  if (code >= 200 && code < 300) return {Status::kOk, code};
  return {Status::kHttpError, code};
}

ApiClient::Result ApiClient::postJson(const char* path, const char* jsonBody,
                                      bool wifiConnected, bool timeSynced)
{
  return request(true, path, jsonBody, nullptr, 0, wifiConnected, timeSynced);
}

ApiClient::Result ApiClient::getJson(const char* path, char* response, size_t responseCap,
                                     bool wifiConnected, bool timeSynced)
{
  return request(false, path, nullptr, response, responseCap, wifiConnected, timeSynced);
}

ApiClient::Result ApiClient::postReadings(const char* deviceUuid, const char* jsonBody,
                                          bool wifiConnected, bool timeSynced)
{
  if (isNullOrEmpty(config::kApiReadingsPathFormat) || isNullOrEmpty(deviceUuid))
  {
    return {Status::kRouteUndefined, 0};
  }

  char path[96];
  const int n = snprintf(path, sizeof(path), config::kApiReadingsPathFormat, deviceUuid);
  if (n < 0 || static_cast<size_t>(n) >= sizeof(path)) return {Status::kInvalidRequest, 0};
  return postJson(path, jsonBody, wifiConnected, timeSynced);
}

const char* ApiClient::statusName(Status status)
{
  switch (status)
  {
    case Status::kOk:               return "ok";
    case Status::kHttpError:        return "http-error";
    case Status::kTransportError:   return "transport-error";
    case Status::kNotConfigured:    return "not-configured";
    case Status::kRouteUndefined:   return "route-undefined";
    case Status::kWifiDown:         return "wifi-down";
    case Status::kTimeNotSynced:    return "time-not-synced";
    case Status::kInvalidRequest:   return "invalid-request";
    case Status::kResponseTooLarge: return "response-too-large";
  }
  return "unknown";
}