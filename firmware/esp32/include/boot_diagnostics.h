#pragma once

// One-shot serial banner printed at boot: firmware identity, chip/memory info,
// reset reason, configuration status, and explicit notices for hardware that
// is intentionally not configured yet (GPIO map, sensors, actuators).

namespace boot_diagnostics {

// Serial must already be initialized. Never prints credential values.
void print(bool secretsArePlaceholders, bool wifiCredentialsPresent,
           bool apiConfigured);

}  // namespace boot_diagnostics
