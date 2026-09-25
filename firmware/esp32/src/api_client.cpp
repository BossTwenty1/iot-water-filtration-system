#include "api_client.h"

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <stdio.h>
#include <string.h>

#include "config.h"

namespace {

constexpr char kHttpsScheme[] = "https://";

bool isNullOrEmpty(const char* s) { return s == nullptr || s[0] == '\0'; }

}  // namespace

void ApiClient::begin(const char* baseUrl, const char* rootCaPem) {
  baseUrl_ = baseUrl;
  rootCaPem_ = rootCaPem;
  configured_ = false;

  if (isNullOrEmpty(baseUrl_)) {
    Serial.println(F("[api] no base URL configured - backend API disabled"));
    return;
  }
  if (strncmp(baseUrl_, kHttpsScheme, strlen(kHttpsScheme)) != 0) {
    Serial.println(F("[api] base URL is not https:// - backend API disabled"));
    return;
  }
  if (isNullOrEmpty(rootCaPem_)) {
    // Never fall back to WiFiClientSecure::setInsecure(): an unverified TLS
    // connection would accept any server, including an impostor.
    Serial.println(F("[api] no root CA configured - backend API disabled"));
    return;
  }

  configured_ = true;
  Serial.printf("[api] backend: %s%s\n", baseUrl_, config::kApiBasePath);
}

ApiClient::Result ApiClient::postJson(const char* path, const char* jsonBody,
                                      bool wifiConnected) {
  if (!configured_) {
    return {Status::kNotConfigured, 0};
  }
  if (path == nullptr || jsonBody == nullptr) {
    return {Status::kInvalidRequest, 0};
  }
  if (!wifiConnected) {
    // Checked before any network I/O so an offline device never blocks on DNS
    // or TLS here.
    return {Status::kWifiDown, 0};
  }

  char url[config::kMaxUrlLength];
  const int urlLength =
      snprintf(url, sizeof(url), "%s%s%s", baseUrl_, config::kApiBasePath, path);
  if (urlLength < 0 || static_cast<size_t>(urlLength) >= sizeof(url)) {
    Serial.println(F("[api] URL too long - request not sent"));
    return {Status::kInvalidRequest, 0};
  }

  WiFiClientSecure tlsClient;
  tlsClient.setCACert(rootCaPem_);

  HTTPClient http;
  http.setConnectTimeout(config::kHttpConnectTimeoutMs);
  http.setTimeout(config::kHttpResponseTimeoutMs);
  http.setReuse(false);

  if (!http.begin(tlsClient, url)) {
    // begin() only fails when the URL cannot be parsed; nothing was sent.
    Serial.printf("[api] POST %s - invalid URL, request not sent\n", url);
    return {Status::kInvalidRequest, 0};
  }
  http.addHeader("Content-Type", "application/json");
  // TODO(TBD): device authentication header — mechanism and credential
  // provisioning are undecided (docs/PENDING_DECISIONS.md §8).

  // HTTPClient::POST takes a non-const buffer (Arduino-ESP32 2.x API) but only
  // writes it to the socket, so casting away const is safe here.
  const int code = http.POST(
      reinterpret_cast<uint8_t*>(const_cast<char*>(jsonBody)), strlen(jsonBody));
  http.end();

  if (code < 0) {
    Serial.printf("[api] POST %s - transport error %d (%s)\n", url, code,
                  HTTPClient::errorToString(code).c_str());
    return {Status::kTransportError, code};
  }
  Serial.printf("[api] POST %s - HTTP %d\n", url, code);
  if (code >= 200 && code < 300) {
    return {Status::kOk, code};
  }
  return {Status::kHttpError, code};
}

ApiClient::Result ApiClient::postTelemetry(const char* jsonBody, bool wifiConnected) {
  if (isNullOrEmpty(config::kApiTelemetryPath)) {
    // TODO(TBD): telemetry route not yet defined in docs/API_CONTRACT.md.
    return {Status::kRouteUndefined, 0};
  }
  return postJson(config::kApiTelemetryPath, jsonBody, wifiConnected);
}

const char* ApiClient::statusName(Status status) {
  switch (status) {
    case Status::kOk:             return "ok";
    case Status::kHttpError:      return "http-error";
    case Status::kTransportError: return "transport-error";
    case Status::kNotConfigured:  return "not-configured";
    case Status::kRouteUndefined: return "route-undefined";
    case Status::kWifiDown:       return "wifi-down";
    case Status::kInvalidRequest: return "invalid-request";
  }
  return "unknown";
}
