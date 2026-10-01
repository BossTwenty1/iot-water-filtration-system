
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

## 3. Integrated Frontend Authentication and Session Layer

On `integration/frontend-auth-mosaic`, the React dashboard uses a responsive
Mosaic shell and shared light/dark themes. The frontend session layer implements
login, protected routes, restoration, token refresh, authenticated request
handling, and sign out through Express. The backend authentication routes use
Supabase Auth; the browser does not connect directly to Supabase.

The conceptual authenticated domain-request path is:

`User -> React login/session layer -> Protected React dashboard -> Authenticated HTTPS REST requests -> Node.js + Express API -> Supabase PostgreSQL`

This is distinct from the device path:

`Sensors -> ESP32 -> API -> Database`

Access tokens and current-user information are held in memory. Refresh tokens
are stored in tab-scoped `sessionStorage` and used to restore/refresh sessions.
This is JavaScript-readable storage, not an HttpOnly-cookie session. Header and
Settings display the API-provided current user; the frontend route guard is not
a substitute for server-side authentication and authorization.

The authenticated request helper and domain-service calls to Express are now
implemented for telemetry, alerts, test runs, calibration, laboratory
associations, maintenance, settings, users, and device status. API responses
can still be seeded or simulated and do not establish live telemetry or verified
ESP32 connectivity. End-to-end authentication, domain-request, and authenticated-
route verification require an approved running backend/test account.

Authentication does not resolve final roles/permissions or enable remote control.
The browser does not control hardware directly. Critical local ESP32 safety
requirements remain independent of the web session and cloud availability;
their exact hardware implementation remains subject to team approval.

Implemented endpoint details are in the
[backend API reference](../backend/docs/API_REFERENCE.md). Shared API/database
drafts retain unresolved decisions and need separate reconciliation where their
implementation-status statements differ from the current source.
