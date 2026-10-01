# IoT Water Filtration System

An IoT-enabled water filtration research system built around an ESP32-WROOM-32,
pre-filtration and post-filtration sensor sets, a Node.js and Express API,
Supabase PostgreSQL, and a React web dashboard.

## Project status

On `integration/frontend-auth-mosaic`, the frontend integrates the Mosaic-style
dashboard, responsive navigation and layouts, light/dark themes, and Express API
authentication with protected routes. Domain services now make authenticated
Express API requests for telemetry, alerts, test runs, calibration, laboratory
associations, maintenance, settings, and device status. They do not fall back
to local representative records if the API is unavailable.

The repository also contains Express backend routes, Supabase migration/seed
artifacts under `backend/supabase/`, and an ESP32 connectivity foundation.
Their presence is not proof of deployment or a connected physical prototype.
Real login/session and domain-request end-to-end verification still require an
approved running backend and test account. API records may be seeded or
simulated; they do not confirm a connected physical prototype. The whole
project is not complete.

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
frontend/       Mosaic dashboard and frontend authentication integration
backend/        Express API source and backend documentation
  supabase/     Database migrations, seed, and local configuration artifacts
firmware/       Device firmware
  esp32/        Connectivity foundation; sensor/actuator implementation pending
simulator/      Placeholder directory; simulation scripts exist under backend/
database/       Placeholder directory; database artifacts live under backend/
docs/           Project foundation and decision records
```

See [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for the project
context and [docs/PENDING_DECISIONS.md](docs/PENDING_DECISIONS.md) for the
items that must remain `TBD` until the team approves them.

## Project team

- Nash — Project Lead, Frontend, Integration
- Alejandro — Backend, Database, API
- Edgar — ESP32, Firmware, Hardware Integration

## Frontend development

From `frontend/`, run `npm install`, then `npm run dev`. Configure the public
`VITE_API_BASE_URL` for an approved Express backend to use `/login`; application
routes require a session. See [frontend/README.md](frontend/README.md) for setup,
theme/session behavior, and validation commands.

Authentication and API-backed records do not confirm ESP32 connectivity,
approve final permissions, or enable remote hardware control. Sensor readings
are not independent laboratory proof of potability.
