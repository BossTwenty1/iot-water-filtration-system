
# Hardware Integration

This document defines the boundary between physical hardware and software.

Final electrical decisions remain under the hardware/research team's authority.

---

## 1. Confirmed Controller

- ESP32-WROOM-32

Final board revision and physical pin map must be confirmed before permanent
wiring or firmware pin definitions are finalized.

---

## 2. Confirmed Sensor Configuration

The system uses two sensor groups:

- one before filtration,
- one after filtration.

### pH

- Client-provided/confirmed project information: PH-4502C
- Quantity: 2

### TDS

- Client-provided documentation/reference: DFRobot TDS / SEN0244
- Quantity: 2
- Confirm exact delivered module before final electrical integration

### Temperature

- Client-provided/confirmed project information: DS18B20
- Quantity: 2

### Flow

- Client-provided/confirmed project information: ZJ-S201C
- Quantity: 2

### Turbidity

- Quantity: 2
- Exact model: `TBD`

---

## 3. Other Confirmed Hardware

- ESP32-WROOM-32
- integrated ultrafiltration / UV-C filtration unit
- Client-provided requirement: 4-channel relay module

Exact relay model and electrical specifications remain `TBD`.

---

## 4. Physical Water Flow

Current process:

```text
Water Source
-> Booster Pump
-> Pre-Filtration Sensors
-> Ultrafiltration
-> UV-C
-> Post-Filtration Sensors
-> LCD
-> Output
```

---

## 5. Local Control and Connectivity

Critical physical control remains local to the ESP32 and must continue safely
when internet or cloud services are unavailable. Remote commands, if approved,
must remain subject to ESP32 local safety validation and must not bypass the
approved fail-safe behavior.

## 6. Edgar's temperature test harness (reported, not a final pin map)

[PR #5 comment 6161917441](https://github.com/BossTwenty1/iot-water-filtration-system/pull/5#issuecomment-6161917441)
reports an ESP32-D0WD-V3, MAC `20:50:0D:29:58:E4`, with one working DS18B20 on
GPIO26, ROM `28DE8D14000000D8`, externally powered. The earlier temperature fault
claim was corrected: ADC surveying re-muxed GPIO26; `ac69081` fixes that interference.
The integration omits the ADC survey and uses only this temperature driver.

The registered real device UUID, physical pre/post position, registry sensor match
and current-board MAC/ROM must be confirmed before enabling transmission. Final
pin map and post-filtration hardware remain TBD. No hardware control, pH wiring,
calibration curve, flow constant or second probe is changed by this preparation.
See [temperature test setup](../firmware/esp32/README.md).
