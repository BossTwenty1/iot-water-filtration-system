# API Contract

This document defines the shared communication contract between the ESP32,
simulator, backend, frontend, and database-facing services.

The core API routes are implemented in `backend/src/routes`. This document
formalizes the shared contract between the ESP32, simulator, backend, frontend,
and database services.

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

Final field names, identifiers, units, and validation rules are formalized in
Section 6 below.

---

## 6. Telemetry Ingestion Endpoint

The primary device ingestion endpoint receives batches of sensor readings from
the ESP32 microcontroller or the live simulator.

### HTTP Route

- **Method**: `POST`
- **Path**: `/api/v1/devices/:id/readings` (canonical)
- **Alias**: `/api/v1/devices/:id/telemetry` (backward-compatible alias)
- **Route Parameter `:id`**: Either the registered device UUID or the unique
  `device_identifier` (e.g., `"ESP32-DEV-001"`).

### Headers

| Header | Required | Value / Description |
|---|---|---|
| `Content-Type` | Yes | `application/json` |
| `X-Device-Key` | Yes | Shared device ingestion secret (configured in `.env` / `secrets.h`) |

### Request Payload

```json
{
  "measuredAt": "2026-10-01T12:00:00.000Z",
  "testRunId": "81e398b8-0000-0000-0000-000000000000",
  "readings": [
    { "category": "ph", "position": "pre_filtration", "value": 7.12, "status": "valid" },
    { "category": "turbidity", "position": "pre_filtration", "value": 8.50, "status": "valid" },
    { "category": "tds", "position": "pre_filtration", "value": 310.0, "status": "valid" },
    { "category": "temperature", "position": "pre_filtration", "value": 26.5, "status": "valid" },
    { "category": "flow_rate", "position": "pre_filtration", "value": 2.4, "status": "valid" },
    { "category": "ph", "position": "post_filtration", "value": 7.05, "status": "valid" },
    { "category": "turbidity", "position": "post_filtration", "value": 0.42, "status": "valid" },
    { "category": "tds", "position": "post_filtration", "value": 185.0, "status": "valid" },
    { "category": "temperature", "position": "post_filtration", "value": 26.6, "status": "valid" },
    { "category": "flow_rate", "position": "post_filtration", "value": 2.1, "status": "valid" }
  ]
}
```

#### Field Specifications:

- `measuredAt` (*string, required*): ISO 8601 UTC timestamp of sensor sampling.
- `testRunId` (*string, optional*): UUID of an ongoing test run. If omitted, readings
  are recorded as standing device telemetry.
- `readings` (*array of objects, required*): Batch of sensor readings.
  - `category` (*string, required*): One of `"ph"`, `"turbidity"`, `"tds"`, `"temperature"`, `"flow_rate"`.
  - `position` (*string, required*): `"pre_filtration"` or `"post_filtration"`.
  - `value` (*number | null, required*): Measured numerical value, or `null` to indicate a sensor fault / unavailable reading.
  - `status` (*string, optional*): Health status indicator (e.g., `"valid"`, `"unavailable"`).

### Ingestion Semantics

1. **Partial Ingestion**: If an individual reading contains an invalid category or
   references an unregistered sensor, it is skipped and reported in the `skipped`
   array rather than failing the entire batch.
2. **Intra-batch Deduplication**: Duplicate readings for the same sensor within a
   single payload are dropped (first occurrence retained).
3. **Retry Idempotency**: If the device retries a batch with the same `(device_id, measured_at)`
   due to Wi-Fi dropped packets, existing readings are not duplicated, and HTTP 200
   is returned.
4. **Heartbeat Update**: Upon receiving any valid or idempotent batch, the server
   updates `devices.last_seen_at` to the current timestamp and marks `connection_state = 'Online'`.

### Responses

- **`201 Created`**: At least one reading was successfully inserted.
  ```json
  {
    "deviceId": "2a273ff0-fde6-4453-899a-c05af063d071",
    "inserted": 10,
    "skipped": []
  }
  ```
- **`200 OK`**: Idempotent retry; all readings were already recorded for this `measuredAt`.
  ```json
  {
    "deviceId": "2a273ff0-fde6-4453-899a-c05af063d071",
    "inserted": 0,
    "skipped": [{ "category": "ph", "position": "pre_filtration", "reason": "reading already recorded for this measured_at" }]
  }
  ```
- **`400 Bad Request`**: Malformed JSON, missing `measuredAt`, empty readings array, or every reading was invalid.
- **`401 Unauthorized`**: Missing or invalid `X-Device-Key`.
- **`404 Not Found`**: Device `:id` is not registered.

---

## 7. Real-Time Streaming (`GET /realtime/stream`)

The backend exposes a single multiplexed Server-Sent Events (SSE) stream for continuous UI updates without client-side page refreshes.

- **Route**: `GET /api/v1/realtime/stream`
- **Authentication**: Requires valid user JWT session via `Authorization: Bearer <token>` or query parameter `?token=<jwt>` (enabling browser native `EventSource`).
- **Content-Type**: `text/event-stream`
- **Keep-Alive**: Unnamed comment `: heartbeat\n\n` emitted every 15 seconds.

### Multiplexed Event Types

1. **`event: telemetry`**
   - Emitted when new sensor telemetry is ingested from physical or simulated devices.
   - Payload: Array of `TelemetryRecord` objects (containing pivoted `before` and `after` stages for `pH`, `turbidity`, `TDS`, `flowRate`, and `temperature`).

2. **`event: alert`**
   - Emitted when an alert is triggered, acknowledged, or resolved.
   - Payload: Array of `SystemAlert` objects.

3. **`event: device`**
   - Emitted when device connectivity changes (`Online`, `Offline`, `lastUpdatedAt`).
   - Payload: `DeviceStatus` object.

4. **`event: test_run`**
   - Emitted when experimental test run parameters, status, or accumulated volume ($L$) update.
   - Payload: Hydrated `TestRun` object.


