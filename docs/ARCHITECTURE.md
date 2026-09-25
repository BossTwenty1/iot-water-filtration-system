
# Architecture

This document defines the technical architecture of the IoT Embedded Water
Filtration System.

Unconfirmed technical decisions must remain `TBD`.

---

## 1. Physical Water Flow

Current planned process:

Water Source
-> Booster Pump
-> Pre-Filtration Sensors
-> Ultrafiltration
-> UV-C
-> Post-Filtration Sensors
-> LCD
-> Output / Collection Tank

The exact electrical wiring and actuator implementation remain subject to
hardware-team confirmation.

---

## 2. High-Level Software Architecture

```text
Pre-Filtration Sensors ----\
                            \
                             -> ESP32-WROOM-32
                            /
Post-Filtration Sensors ---/

ESP32
  |
  | Wi-Fi / HTTPS / JSON
  v
Node.js + Express API
  |
  v
Supabase PostgreSQL
  |
  v
React Dashboard

Simulator
   |
   v
Express API
   |
   v
Supabase
   |
   v
React Dashboard
```

The frontend request path is:

`React Dashboard -> HTTPS REST API -> Node.js + Express API -> Supabase PostgreSQL`

The diagram's database-to-dashboard direction represents returned data; the
browser does not connect directly to Supabase PostgreSQL.

Critical physical control remains local to the ESP32 and must continue safely
when internet or cloud services are unavailable. Remote commands, if approved,
must be accepted or rejected by the ESP32's local safety logic before hardware
state changes.

Simulator records must remain explicitly identified as simulated data and must
not be presented as real experimental or laboratory results.

The web dashboard is intended to be reachable through the public internet and
through a local network where practical. The local deployment method and exact
behavior when public internet or cloud services are unavailable remain `TBD`.
