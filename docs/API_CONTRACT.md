# API Contract

This document defines the shared communication contract between the ESP32,
simulator, backend, frontend, and database-facing services.

The API is not yet implemented. Routes and payloads documented here are the
planned contract and may be refined through an approved architecture decision.

---

## 1. API Principles

The backend shall act as the normal communication boundary between:

- ESP32 and database
- simulator and database
- frontend and database
- remote commands and ESP32

Normal flow:

ESP32 / Simulator
-> HTTPS REST API
-> Node.js + Express
-> Supabase PostgreSQL

Frontend
-> HTTPS REST API
-> Node.js + Express
-> Supabase PostgreSQL

The ESP32 must not require a successful API request for critical local hardware
control to continue.

Remote commands must remain subject to local ESP32 safety validation. API
authorization or successful command delivery must not bypass the ESP32's
approved local safety logic.

The frontend must not contain database administrator or Supabase service-role
credentials.

---

## 2. Base Path

Planned API prefix:

`/api/v1`

API versioning is proposed so future changes do not silently break firmware,
frontend, simulator, or backend integrations.

Final versioning policy remains subject to implementation approval.

---

## 3. Data Format

API payloads shall use JSON unless another format is explicitly required.

Example content type:

`Content-Type: application/json`

Timestamps should use UTC ISO 8601 format when possible.

Example:

`2026-09-14T14:30:00Z`

The backend should also preserve a server-received timestamp so device clock
problems can be diagnosed.

---

## 4. Source Identification

Telemetry must identify whether it came from:

- real ESP32 hardware,
- development simulator.

Recommended field:

Device example:

```json
{
  "source": "device"
}
```

Simulator example:

```json
{
  "source": "simulator"
}
```

---

## 5. Telemetry Context

Telemetry payloads must preserve the context required by the requirements and
database design:

- device identity,
- test-run or experiment context,
- explicit sensor position (`pre-filtration` or `post-filtration`),
- measurement timestamp,
- sensor/calibration context, and
- source identity distinguishing real device data from simulator data.

Final field names, identifiers, units, and validation rules remain subject to
implementation approval.
