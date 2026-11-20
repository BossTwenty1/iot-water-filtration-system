#pragma once

// Configures the board at compilation depending on what board is used.
// NOTE: #define takes no '=' and no ';' - they would become part of the pin name.

// Arduino.h pulls in the chip macros (CONFIG_IDF_TARGET_*) so they are defined here
// even when this header is included first.
#include <Arduino.h>

#if CONFIG_IDF_TARGET_ESP32S3

  // ESP32-S3
  #define PH_PIN    4
  #define TDS_PIN   6
  #define TURB_PIN  5
  #define TEMP_PIN  7
  #define FLOW_PIN  15
  #define LCD_SDA   8
  #define LCD_SCL   9

#elif CONFIG_IDF_TARGET_ESP32 || defined(ARDUINO_ESP32_DEV)

  // Original ESP32 DevKit V1 (analog pins are all ADC1, so they keep working with Wi-Fi on)
  #define PH_PIN    34
  #define TDS_PIN   33
  #define TURB_PIN  32
  #define TEMP_PIN  26
  #define FLOW_PIN  27
  #define LCD_SDA   18
  #define LCD_SCL   19

#else
  #error "Unconfigured ESP board pls add new config at board_config.h"
#endif
