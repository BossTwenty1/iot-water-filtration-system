#pragma once

// Template for include/secrets.h — COMMITTED, placeholders only.
//
// Setup:
//   1. Copy this file to include/secrets.h (git-ignored).
//   2. Fill in real values in secrets.h only.
//   3. Never put real credentials in this file.
//
// If include/secrets.h is missing, the build falls back to these placeholders
// and prints a compiler warning. With an empty SSID, Wi-Fi stays disabled.

// Wi-Fi network the device joins in station mode.
#define WIFI_SSID ""
#define WIFI_PASSWORD ""

// Backend base URL, scheme + host only, e.g. "https://api.example.invalid".
// Must be https:// — the API client refuses plain http.
// The /api/v1 prefix is added from config.h.
#define API_BASE_URL ""

// PEM root CA certificate that signs the backend's TLS certificate.
// A CA certificate is public (not secret) but deployment-specific, so it lives
// here next to the URL. The API client refuses to connect while this is empty;
// certificate verification is never disabled.
// TODO(TBD): backend hosting/CA not yet confirmed.
#define API_ROOT_CA_PEM ""

// TODO(TBD): device authentication mechanism and credential provisioning
// (docs/PENDING_DECISIONS.md §8). Add a device credential here once decided.
// Never place database/service-role credentials in firmware.
