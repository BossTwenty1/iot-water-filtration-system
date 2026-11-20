# ESP32 Firmware (two boards)

The Arduino sketch in [`FF/`](FF/) runs on both sensor boards. The board you
compile for decides everything board-specific at compile time:

| Board selected in Arduino IDE | Role | Uploads as | Backend device |
|---|---|---|---|
| ESP32 Dev Module (DevKit V1) | before filtration | `pre_filtration` | Device 0001 `d4b1601b-9355-4203-ac6e-2b84b28cbf50` |
| ESP32S3 Dev Module (ESP32-S3) | after filtration | `post_filtration` | Device 0005 `cb06c51a-83db-4940-b6cc-19f6d52fcde7` |

Pins are in `FF/board_config.h`, the stage in `FF/net_config.h`, and the
device UUIDs in `FF/secrets.example.h`. The pin map is the team's current bench
wiring; final pins are still `TBD` (docs/PENDING_DECISIONS.md).

## One-time setup

1. Install the Arduino IDE and the **esp32** board package by Espressif.
2. Install these libraries (Library Manager): **ArduinoJson**, **OneWire**,
   **DallasTemperature**, **LiquidCrystal I2C**, **NimBLE-Arduino**.
   Library and core versions are not pinned yet (`TBD`).
3. Create your settings file. It is git-ignored, so it never gets committed:

   ```sh
   cp firmware/esp32/FF/secrets.example.h firmware/esp32/FF/secrets.h
   ```

   In `secrets.h`, set:
   - `API_DEVICE_KEY`: the same value as `DEVICE_INGEST_KEY` on the backend
     host. **Required.** Without it every upload is rejected with HTTP 401.
   - `WIFI_SSID` / `WIFI_PASSWORD` (optional, 2.4 GHz only). You can also
     connect from the board's menu (`3 = Wi-Fi`). A network saved there wins.
   - `BLE_PIN` (optional, 4 to 8 digits) to allow phone control.
   - `API_BASE_URL`: change it only if the backend is hosted at a different
     address (see docs/DEPLOYMENT.md).

   Without `secrets.h` the sketch still compiles with a warning, but it cannot
   upload anything.

## Flash each board

1. Open `firmware/esp32/FF/FF.ino` in the Arduino IDE.
2. **Tools → Board**: pick the board from the table above.
3. Select the port and upload. If the build says the sketch is too big, pick
   a larger app partition under **Tools → Partition Scheme**.
4. Open the Serial Monitor at **115200** baud. Let the boot menu time out, or
   press `1` (Run).
5. Repeat for the other board.

## Check that it uploads

You should see these lines in the Serial Monitor about once a minute:

```
[api] POST https://.../api/v1/devices/<uuid>/readings - HTTP 201
[telemetry] sent (... bytes)
```

| What you see | Meaning |
|---|---|
| `HTTP 401` | `API_DEVICE_KEY` does not match the backend's `DEVICE_INGEST_KEY` |
| `HTTP 404` | wrong `API_BASE_URL`, or the device UUID is not in the database |
| `HTTP 503` / transport error on the first try | free Render service waking up; the next minute usually works |
| no `[api]` lines at all | Wi-Fi not connected, clock not synced yet, or the menu is open (uploads pause while the menu or calibration is open) |

Run **both boards at the same time** if you want the history page to show
before and after readings on the same row. Rows only pair when the two
readings are within 30 seconds of each other.

Sensor readings are for monitoring only. They do not show that the water is
safe to drink.
