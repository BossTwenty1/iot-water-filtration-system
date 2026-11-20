#pragma once

// TEMPLATE - committed to Git, so it must never hold real secrets.
// Copy it to secrets.h in this folder (secrets.h is git-ignored) and fill in
// API_DEVICE_KEY, plus WIFI_SSID / WIFI_PASSWORD / BLE_PIN if you want them.
// The URL, device UUIDs and root CA below are not secret and are already set
// for the hosted backend; change them only if you host the backend elsewhere.

// Arduino.h defines the chip macros (CONFIG_IDF_TARGET_*) used for the board check below,
// so this file works no matter which header is included first.
#include <Arduino.h>

// Wi-Fi the device joins at boot. Leave empty to run offline: you can still connect by hand
// from the menu (3 = Wi-Fi), and a network saved there takes priority over these two.
// 2.4 GHz only.
#define WIFI_SSID ""
#define WIFI_PASSWORD ""

// Backend base URL: scheme + host only. "/api/v1" is added from net_config.h.
// It must be the host that serves /api/v1/devices/<uuid>/readings.
#define API_BASE_URL "https://safe-water-api.onrender.com"

// PIN the phone app asks for before it can control a board (Bluetooth). Choose your own, 4 to 8 digits.
// Leave it empty and Bluetooth control stays locked.
#define BLE_PIN ""

#define API_DEVICE_KEY ""   // REQUIRED: same value as DEVICE_INGEST_KEY on the backend host

// Device UUID per board. Must match kTelemetryPosition in net_config.h:
//   ESP32 DevKit V1 = PRE-filtration,  ESP32-S3 = POST-filtration.
#if CONFIG_IDF_TARGET_ESP32S3                              // ESP32-S3: post-filtration

  #define API_DEVICE_ID "cb06c51a-83db-4940-b6cc-19f6d52fcde7"

#elif CONFIG_IDF_TARGET_ESP32 || defined(ARDUINO_ESP32_DEV) // ESP32 DevKit V1: pre-filtration

  #define API_DEVICE_ID "d4b1601b-9355-4203-ac6e-2b84b28cbf50"
#else
  #error "Unconfigured ESP board: set API_DEVICE_ID in secrets.h"
#endif

// PEM root CA that signs the backend's TLS certificate: Google Trust Services "GTS Root R4"
// (a root certificate, valid until 2036-06-22). If the connection ever fails with a certificate
// error, check which root the host in API_BASE_URL uses now:
//   openssl s_client -showcerts -connect <host>:443 </dev/null
// You can paste several certificates one after another to cover a change of root.
#define API_ROOT_CA_PEM R"PEM(-----BEGIN CERTIFICATE-----
MIICCTCCAY6gAwIBAgINAgPlwGjvYxqccpBQUjAKBggqhkjOPQQDAzBHMQswCQYD
VQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2VzIExMQzEUMBIG
A1UEAxMLR1RTIFJvb3QgUjQwHhcNMTYwNjIyMDAwMDAwWhcNMzYwNjIyMDAwMDAw
WjBHMQswCQYDVQQGEwJVUzEiMCAGA1UEChMZR29vZ2xlIFRydXN0IFNlcnZpY2Vz
IExMQzEUMBIGA1UEAxMLR1RTIFJvb3QgUjQwdjAQBgcqhkjOPQIBBgUrgQQAIgNi
AATzdHOnaItgrkO4NcWBMHtLSZ37wWHO5t5GvWvVYRg1rkDdc/eJkTBa6zzuhXyi
QHY7qca4R9gq55KRanPpsXI5nymfopjTX15YhmUPoYRlBtHci8nHc8iMai/lxKvR
HYqjQjBAMA4GA1UdDwEB/wQEAwIBhjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQW
BBSATNbrdP9JNqPV2Py1PsVq8JQdjDAKBggqhkjOPQQDAwNpADBmAjEA6ED/g94D
9J+uHXqnLrmvT/aDHQ4thQEd0dlq7A/Cr8deVl5c1RxYIigL9zC2L7F8AjEA8GE8
p/SgguMh1YQdc4acLa/KNJvxn7kjNuK8YAOdgLOaVsjh4rsUecrNIdSUtUlD
-----END CERTIFICATE-----
)PEM"





