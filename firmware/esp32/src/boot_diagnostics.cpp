#include "boot_diagnostics.h"

#include <Arduino.h>
#include <esp_system.h>

#include "config.h"

namespace boot_diagnostics {
namespace {

const char* resetReasonName(esp_reset_reason_t reason) {
  switch (reason) {
    case ESP_RST_POWERON:   return "POWERON";
    case ESP_RST_EXT:       return "EXTERNAL_PIN";
    case ESP_RST_SW:        return "SOFTWARE";
    case ESP_RST_PANIC:     return "PANIC";
    case ESP_RST_INT_WDT:   return "INTERRUPT_WATCHDOG";
    case ESP_RST_TASK_WDT:  return "TASK_WATCHDOG";
    case ESP_RST_WDT:       return "OTHER_WATCHDOG";
    case ESP_RST_DEEPSLEEP: return "DEEPSLEEP_WAKE";
    case ESP_RST_BROWNOUT:  return "BROWNOUT";
    case ESP_RST_SDIO:      return "SDIO";
    default:                return "UNKNOWN";
  }
}

}  // namespace

void print(bool secretsArePlaceholders, bool wifiCredentialsPresent,
           bool apiConfigured) {
  const esp_reset_reason_t reason = esp_reset_reason();
  const uint64_t mac = ESP.getEfuseMac();  // Factory MAC, little-endian byte order.

  Serial.println();
  Serial.println(F("================================================================"));
  Serial.printf("  %s  v%s\n", config::kFirmwareName, config::kFirmwareVersion);
  Serial.printf("  built        : %s %s\n", __DATE__, __TIME__);
  Serial.println(F("================================================================"));
  Serial.printf("chip           : %s rev %u, %u core(s) @ %lu MHz\n",
                ESP.getChipModel(), static_cast<unsigned>(ESP.getChipRevision()),
                static_cast<unsigned>(ESP.getChipCores()),
                static_cast<unsigned long>(ESP.getCpuFreqMHz()));
  Serial.printf("flash          : %lu KiB @ %lu MHz\n",
                static_cast<unsigned long>(ESP.getFlashChipSize() / 1024),
                static_cast<unsigned long>(ESP.getFlashChipSpeed() / 1000000));
  Serial.printf("heap           : %lu B free, %lu B min free\n",
                static_cast<unsigned long>(ESP.getFreeHeap()),
                static_cast<unsigned long>(ESP.getMinFreeHeap()));
  Serial.printf("psram          : %lu B\n", static_cast<unsigned long>(ESP.getPsramSize()));
  Serial.printf("esp-idf        : %s\n", ESP.getSdkVersion());
#if defined(ESP_ARDUINO_VERSION_MAJOR)
  Serial.printf("arduino core   : %d.%d.%d\n", ESP_ARDUINO_VERSION_MAJOR,
                ESP_ARDUINO_VERSION_MINOR, ESP_ARDUINO_VERSION_PATCH);
#endif
  Serial.printf("reset reason   : %s (%d)\n", resetReasonName(reason),
                static_cast<int>(reason));
  Serial.printf("efuse mac      : %02X:%02X:%02X:%02X:%02X:%02X\n",
                static_cast<unsigned>(mac & 0xFF), static_cast<unsigned>((mac >> 8) & 0xFF),
                static_cast<unsigned>((mac >> 16) & 0xFF), static_cast<unsigned>((mac >> 24) & 0xFF),
                static_cast<unsigned>((mac >> 32) & 0xFF), static_cast<unsigned>((mac >> 40) & 0xFF));
  Serial.println(F("----------------------------------------------------------------"));
  Serial.printf("secrets        : %s\n",
                secretsArePlaceholders ? "PLACEHOLDER (include/secrets.h missing)"
                                       : "loaded from include/secrets.h");
  Serial.printf("wifi creds     : %s\n", wifiCredentialsPresent ? "present" : "NOT SET (Wi-Fi disabled)");
  Serial.printf("backend api    : %s\n",
                apiConfigured ? "configured" : "NOT CONFIGURED (https base URL / root CA missing)");
  Serial.println(F("gpio           : none assigned - pin map TBD (PENDING_DECISIONS sec. 1)"));
  Serial.println(F("sensors        : not implemented - TBD (PENDING_DECISIONS sec. 1, 3)"));
  Serial.println(F("actuators      : not implemented - TBD (PENDING_DECISIONS sec. 2)"));
  Serial.println(F("================================================================"));
}

}  // namespace boot_diagnostics
