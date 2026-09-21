# ESP32 Firmware

Firmware for the ESP32-WROOM-32 in the IoT Water Filtration System.
Built with PlatformIO, the Arduino framework, and C++.

## Current scope (foundation)

- Serial boot diagnostics and a periodic status line
- Wi-Fi station with non-blocking auto-reconnect (capped exponential backoff)
- NTP time sync, formatted as UTC ISO-8601 (`2026-09-14T14:30:00Z`)
- HTTPS client skeleton that can POST JSON with verified TLS (structure only; not called yet)

Not implemented, by design: GPIO assignments, sensor drivers, actuator control,
thresholds, calibration, and cycle logic. These decisions are still open in
[`docs/PENDING_DECISIONS.md`](../../docs/PENDING_DECISIONS.md). Search the
code for `TODO(TBD)` to find each placeholder.

## Setup

1. Install PlatformIO Core, or the PlatformIO IDE extension for VS Code.
2. Create your local secrets file (it is git-ignored):

   ```sh
   cp include/secrets.example.h include/secrets.h
   ```

   Fill in `WIFI_SSID` and `WIFI_PASSWORD`. Leave `API_BASE_URL` and
   `API_ROOT_CA_PEM` empty until the backend host is decided. The API client
   stays disabled until both are set.
   **Never commit `secrets.h` or put real values in `secrets.example.h`.**

   If `secrets.h` is missing, the firmware still builds. It uses the
   placeholders, prints a compiler warning, and runs with Wi-Fi disabled.

## Build / flash / monitor

Run these from `firmware/esp32/`:

```sh
pio run                    # build
pio run -t upload          # flash over USB
pio device monitor         # serial monitor at 115200 baud
```

## Layout

| Path | Purpose |
|---|---|
| `platformio.ini` | Build environment (`esp32dev`, Arduino framework, pinned platform version) |
| `include/config.h` | Non-secret constants and provisional connectivity defaults |
| `include/secrets.example.h` | Committed credential template |
| `include/secrets_select.h` | Uses `secrets.h` if present, otherwise the example |
| `src/main.cpp` | `setup()` / `loop()` wiring |
| `src/boot_diagnostics.cpp` | Boot banner |
| `src/wifi_manager.cpp` | Non-blocking Wi-Fi state machine |
| `src/time_sync.cpp` | SNTP and the ISO-8601 formatter |
| `src/api_client.cpp` | HTTPS POST skeleton |
