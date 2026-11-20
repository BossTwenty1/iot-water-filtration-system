#pragma once

// Shared types. Kept in a header (not main.ino) so the Arduino IDE's
// auto-generated function prototypes can see them.

struct AnalogReading
{
  int raw = 0;
  float pinVolts = 0.0f;
  bool valid = false;
};
