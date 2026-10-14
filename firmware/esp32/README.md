# ESP32 temperature integration test

Integration base: `feature/user-management-rbac` at `99e43bc43f19dcda90013cd02323294abcc9184a`.
Firmware source: Edgar's PR #5 at `ac690817e00afa3ea659ca785284f73468c2456e`,
including [comment 6161917441](https://github.com/BossTwenty1/iot-water-filtration-system/pull/5#issuecomment-6161917441).
Only the DS18B20 driver and its OneWire/DallasTemperature dependencies were
incorporated. No merge of either firmware or telemetry branch was performed.

## Prepared behavior

- GPIO26 is Edgar's verified OneWire test harness, not the final project pin map.
- A selected ROM supplies Celsius only after conversion and protocol validation.
  Invalid/missing readings become `value: null, status: "fault"`; no disconnect
  sentinel or cached successful value is substituted for a failed sample.
- Sampling reads the previous conversion after at least 750 ms and starts the
  next; UTC `measuredAt` records the completed scratchpad read. The 30-second
  send cadence is provisional for this first test, not a final project decision.
- Only `category: "temperature"` and the confirmed position are transmitted.
  pH, turbidity, TDS and flow drivers remain outside this integration; their
  fault/uncalibrated states are unresolved, never replaced by numeric values.
  No second sensor or opposite-stage reading is fabricated.
- Verified HTTPS only: root CA validation, synchronized clock, no insecure TLS,
  and the existing `X-Device-Key` authentication. HTTP 201 is expected.
  HTTP 4xx disables sending until configuration is corrected and rebooted.
- No buffering, retransmission of old samples, registration requests, commands,
  relay/pump/UV-C behavior, or firmware update mechanisms were added.

## Confirm before an actual test

Nash/Alejandro must verify the approved API host and existing registry mapping;
Edgar must confirm the physical board, probe and filtration stage. Configure only
local, git-ignored `include/secrets.h`, copied from `secrets.example.h`:

| Setting | Required confirmation |
|---|---|
| `DEVICE_ID` | Existing real `devices.id` UUID, matched to this physical board; not a MAC, invented identifier, or simulator record |
| `DEVICE_MAC` | Reported board `20:50:0D:29:58:E4`, rechecked on the board being tested |
| `TEMPERATURE_PROBE_ROM` | Reported probe `28DE8D14000000D8`, rechecked on GPIO26; used by ROM, not discovery index |
| `TEMPERATURE_POSITION` | Actual `pre_filtration` or `post_filtration` assignment, and a matching registered `sensors` row for this UUID, category `temperature`, unit Celsius |
| `DEVICE_KEY` | Privately provisioned key matching backend `DEVICE_INGEST_KEY`; never a Supabase/service-role key |
| `API_BASE_URL` / `API_ROOT_CA_PEM` | Approved HTTPS origin (no `/api/v1` suffix) and its verified issuing root CA |
| Wi-Fi settings | Approved network with DNS, HTTPS and NTP access |
| `TEMPERATURE_TELEMETRY_ENABLED` | Keep `0` until all above are confirmed and the actual ingestion test is separately authorized; then set `1` locally |

All committed settings are empty/disabled. Old local secrets headers without
these settings also default to disabled. A matching ROM must be present at boot;
MAC mismatch, unknown stage, missing credentials or parasite power prevent arming.
A disconnected selected probe after arming yields a fault rather than a number.

Edgar's comment corrects the earlier DS18B20 fault claim: the ADC survey was
reconfiguring GPIO26, fixed in `ac69081`. This integration does not run that survey.
It does not require a pH hardware repair or a second sensor set for the first
single-stage temperature test. Those remain needed for their own later tests:
pH supply/divider verification and calibration, provisional GPIO34 verification,
flow model/K-factor confirmation, TDS wet testing, turbidity calibration, and
all post-filtration hardware/assignments. No wiring changes are prescribed here.

Protocol guards follow the [DS18B20 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/ds18b20.pdf).
Exactly 85 C is conservatively withheld because it is also the power-on value;
this limitation needs review before high-temperature research use. Parasite power
is not supported by this first test; confirm the externally powered harness.

## Checks and later test observation

From `firmware/esp32`, `pio run` builds only. No upload/flash is part of this task.
If using the worktree-local tool install from this preparation (PowerShell),
use the temporary short-path junction to its `.pio/core` cache; the longer cache
path caused GCC to miss standard headers on this Windows machine:

```powershell
$env:PLATFORMIO_CORE_DIR = Join-Path $env:TEMP 'safe-esp32-pio-core'
& './.pio/build-tools/Scripts/python.exe' -m platformio run
```

From `backend`, `npx vitest run src/routes/devices.temperature.test.ts` checks
four synthetic cases with every database call and alert side effect mocked:
valid temperature, nullable fault, wrong key, and unregistered opposite stage.
It neither contacts Supabase nor creates real records.

After a separately authorized hardware/ingestion test, expect an armed boot,
synchronized UTC, selected temperature and HTTP 201; confirm the response has
`inserted: 1, skipped: []` and the current-telemetry API contains the right device,
measurement and stage. A 400 may mean the sensor row is absent; a 401 means the
key is wrong; a 404 means the registered UUID is wrong. Fix the approved mapping
rather than guessing identifiers or registering automatically.

The existing dashboard reads `/telemetry/current` on mount. Reload the page
after ingestion to see the assigned-stage temperature card; it does not subscribe
to live updates here, and its main chart queries turbidity. Missing other sensor
cards/stages are expected. Fault values are stored with their status but the
current dashboard mapper omits null values; use API/history evidence for faults.

Network I/O is synchronous and bounded by TLS/connect/response timeouts. This
branch has no actuator control. Move network I/O off the control loop before
introducing any future critical control; no such change is authorized here.

## Preparation validation result

- PlatformIO `esp32dev` build: passed after the Windows cache-path workaround;
  RAM 47,412 / 327,680 bytes (14.5%), flash 933,445 / 1,310,720 bytes (71.2%).
- Warnings: expected missing `secrets.h` placeholder warning and two existing
  OneWire 2.3.8 `#undef` warnings; no project compilation errors.
- Four mocked temperature contract cases: passed. No hosted integration tests run.
- Firmware/configuration scope and whitespace checks: passed.
- Actual board behavior, target HTTPS handshake, registry mapping and dashboard
  ingestion remain Not Confirmed. No flash, real ingestion, deployment, commit,
  push or merge was performed. Changes remain uncommitted on the integration branch.
