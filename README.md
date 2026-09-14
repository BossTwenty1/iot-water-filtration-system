# IoT Water Filtration System

An IoT-enabled water filtration research system built around an ESP32-WROOM-32,
pre-filtration and post-filtration sensor sets, a Node.js and Express API,
Supabase PostgreSQL, and a React web dashboard.

## Project status

Phase 1 — Project Foundation is documented. The application, backend, firmware,
simulator, and database implementations have not been initialized yet.

## Confirmed system scope

- ESP32-WROOM-32
- Pre-filtration and post-filtration sensor sets
- pH, turbidity, TDS, temperature, and flow-rate measurements
- Web dashboard with historical data, alerts, test runs, calibration records,
  laboratory validation records, and CSV export

The planned data path is:

`Sensors -> ESP32 -> HTTPS / JSON -> Node.js + Express API -> Supabase PostgreSQL -> React Dashboard`

The frontend data path is:

`React Dashboard -> Express API -> Supabase PostgreSQL`

Critical hardware control remains on the ESP32 and must continue to work when
internet connectivity is unavailable. Sensor readings are monitoring data and
must not be presented as laboratory proof that water is safe to drink.

## Repository layout

```text
frontend/       React dashboard (not initialized)
backend/        API and server-side logic (not initialized)
firmware/       Device firmware
  esp32/        ESP32 firmware workspace (not initialized)
simulator/      Local device/data simulation (not initialized)
database/       Database-related artifacts (not initialized)
docs/           Project foundation and decision records
```

See [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for the project
context and [docs/PENDING_DECISIONS.md](docs/PENDING_DECISIONS.md) for the
items that must remain `TBD` until the team approves them.

## Project team

- Nash — Project Lead, Frontend, Integration
- Alejandro — Backend, Database, API
- Edgar — ESP32, Firmware, Hardware Integration

## Phase 1 boundary

This phase creates repository structure and documentation only. It does not
install dependencies, initialize React, Express, PlatformIO, or Supabase, and
does not create branches, commits, or pushes.
