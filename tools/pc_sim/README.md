# PC board simulator

Runs the ESP32 upload code for **both boards** on a PC at the same time, with
no Wi-Fi and no sensors. Use it to test the backend and dashboard without the
hardware.

It compiles the real firmware files from `firmware/esp32/FF/` unchanged:

| Firmware file | Used for |
|---|---|
| `secrets_select.h` → `secrets.h` | credentials: `API_BASE_URL`, `API_DEVICE_KEY`, `API_DEVICE_ID`, `API_ROOT_CA_PEM` |
| `net_config.h` | upload route, timeouts, board position, 60 s interval |
| `api_client.cpp` / `.h` | `ApiClient::begin()` and `postReadings()` (HTTPS, `X-Device-Key`) |
| `telemetry.h` | `TelemetrySnapshot`, `telemetryBuildPayload()`, status logic |

Only the ESP32-only pieces are PC stand-ins (`shim/`): `HTTPClient` and
`WiFiClientSecure` send through the `curl` command and verify TLS against
`API_ROOT_CA_PEM` only, the same root the board trusts. `Serial`, `ESP` and
`String` are minimal stand-ins, and the clock is the PC clock.

`board_sim.cpp` is compiled twice, like the firmware: as ESP32 (before
filtration) and as ESP32-S3 (after filtration).

> **All sensor values are made up.** They are not measurements, and they say
> nothing about whether water is safe to drink.

## Requirements

- Linux or macOS with `g++` (C++17) and the `curl` command.
- `firmware/esp32/FF/secrets.h` with `API_DEVICE_KEY` set (see
  `docs/SETUP_CHECKLIST.md`). It's git-ignored. The key is never stored in
  this folder.

## Run

```bash
tools/pc_sim/run_both.sh --sim -i 15 -n 20
```

| Option | Effect |
|---|---|
| `--sim` | upload as the **simulated** Devices 0006 / 0007 (hidden on the dashboard) |
| *(no `--sim`)* | upload as the **real** Device 0001 / 0005 from `secrets.h`. The made-up values then appear in the real boards' history |
| `-i <s>` | seconds between uploads (default 60, like the firmware) |
| `-n <count>` | uploads per board (default 10, `0` = until Ctrl+C) |
| `--fault <sensor>` | sensor failed its self test: sent as `null` / `fault` (opens a Sensor Fault alert) |
| `--uncal <sensor>` | sensor not calibrated: sent as `null` / `uncalibrated` (`ph` or `turbidity`) |
| `--log <file>` | upload log (default `board_sim.log` in the current folder) |

Every upload is logged as `<device id> <measuredAt> <HTTP code>`, so readings
sent under the real IDs can be found and removed later.

Expected output (same messages as the board's Serial Monitor):

```
[pre ] [api] POST https://safe-water-api.onrender.com/api/v1/devices/<uuid>/readings - HTTP 201
[pre ] [telemetry] sent (455 bytes)
[post] [api] POST https://safe-water-api.onrender.com/api/v1/devices/<uuid>/readings - HTTP 201
[post] [telemetry] sent (460 bytes)
```
