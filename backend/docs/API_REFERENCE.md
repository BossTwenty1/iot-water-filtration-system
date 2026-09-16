# API Reference

Implementation of [plans/API ROUTES PLAN.md](plans/API%20ROUTES%20PLAN.md)
against the Supabase schema in
[DATABASE_SCHEMA_DRAFT.md](DATABASE_SCHEMA_DRAFT.md) +
[SCHEMA_TBD_LOG.md](SCHEMA_TBD_LOG.md). This is the reference for wiring the
frontend's mock services
(`frontend/src/services/*Service.ts` on `feature/frontend-foundation`) to a
real backend: **every response below is shaped to match the corresponding
type in `frontend/src/types/index.ts` exactly**, so a service function like

```ts
// before
getAlerts: async () => clone(alerts)
// after
getAlerts: () => apiRequest<SystemAlert[]>('/alerts')
```

is a drop-in swap — no response transformation needed on the frontend side.

All examples below are real captured responses from a local run against the
seed data in `supabase/seed.sql`, not hand-written samples.

## Base URL

```
http://localhost:<BACKEND_PORT>/api/v1
```

`BACKEND_PORT` defaults to `3000` (see `backend/.env.example`). This matches
`VITE_API_BASE_URL=http://localhost:3000/api/v1` in the frontend's
`.env.example`, so no frontend env change should be needed.

## Authentication

Every route except `GET /health` and the `/auth/*` routes requires:

```
Authorization: Bearer <token>
```

Get a token from `POST /auth/login`. There is currently **no per-role
authorization** — any authenticated user can call any route. This is
intentional, not an oversight: `docs/PENDING_DECISIONS.md` §9 leaves
roles/permissions unresolved, and guessing a specific role gate would violate
that document's decision rule. `req.profile.role` is available server-side
(`backend/src/middleware/auth.js`) if/when the team decides on a policy —
adding `requireRole(...)` gates then is a small change, not a rewrite.

### `POST /auth/login`

```json
// request
{ "email": "admin@test.local", "password": "testpass123" }
```

```json
// response 200
{
  "token": "eyJhbGciOiJFUzI1NiIs...",
  "refreshToken": "j6bpq6qc73xi",
  "expiresIn": 3600,
  "user": { "id": "0aca...", "name": "Test Admin", "email": "admin@test.local", "role": "Administrator", "status": "Active" }
}
```

`401` on bad credentials.

### `POST /auth/logout`

Requires `Authorization`. Invalidates the session server-side. `204` on
success.

### `GET /auth/me`

Requires `Authorization`. Returns the `User` shape above (this is what
replaces the Header's hardcoded `"Administrator"`).

### `POST /auth/refresh`

```json
// request
{ "refreshToken": "j6bpq6qc73xi" }
```

Response: same shape as `/auth/login`. `401` if the refresh token is
invalid/expired.

### `POST /auth/password-reset/request` / `POST /auth/password-reset/confirm`

Optional flow, present per the plan's "if wanted" note.

- `request` body: `{ "email": "..." }` → `204` (sends a reset email via
  whatever Supabase Auth SMTP config is active — nothing is configured for
  this locally beyond Mailpit).
- `confirm` body: `{ "accessToken": "...", "newPassword": "..." }` → `204`.
  `accessToken` is the token embedded in the reset-email link.

## Error format

Every non-2xx response is:

```json
{ "error": "human-readable message", "details": "optional extra context" }
```

Status codes used: `400` (bad input), `401` (missing/invalid token), `404`
(not found), `500` (unexpected/database error).

## List conventions

- Pagination: `?limit=` (default varies per route, capped at 500–1000) and
  `?offset=`.
- Date filters: `?from=` / `?to=`, ISO 8601, inclusive, applied to whatever
  timestamp column is that resource's natural "when" (documented per route
  below).
- IDs are Supabase UUIDs (`string`), not the padded display codes
  (`"RUN-2026-001"`) the frontend mocks currently generate — the mocks'
  cosmetic numbering was never a contract, just mock flavor.

## Real-time

Chosen: **Server-Sent Events**, not WebSocket — see
`backend/src/lib/sse.js`. No new dependency was needed (plain
`res.write`), and every real-time surface here is server→client only, so
SSE's one-way stream is sufficient; this matches the plan's "or SSE if
simplicity is preferred" option.

Connect with `EventSource` (or `fetch` + a streaming reader) and an
`Authorization` header — note `EventSource` itself can't set custom headers,
so either proxy the token as a query param server-side, or use a
fetch-based SSE client. Each stream sends a named `event:` frame; unnamed
`: heartbeat` comments are sent every 15s to keep the connection alive
through proxies.

| Endpoint | Event name | Payload |
| --- | --- | --- |
| `GET /telemetry/stream` | `telemetry` | `TelemetryRecord[]` (new records since last poll) |
| `GET /alerts/stream` | `alert` | `SystemAlert[]` |
| `GET /realtime/stream` | `telemetry` and/or `alert` | multiplexed channel, per the plan's "Real-time strategy note" |

All three poll the database every `SSE_POLL_INTERVAL_MS` (default 3000ms) —
see `backend/src/lib/sse.js`'s `pollAndStream`. If the project later needs
sub-second latency, Supabase Realtime (already running in the local stack)
is the natural next step; this poll-based approach was chosen to avoid
adding that complexity before it's actually needed.

---

## Dashboard

### `GET /dashboard/summary`

Bundles: latest 3 alerts, the active (`In Progress`) test run, the most
recent laboratory validation record, latest telemetry snapshot, and the
first device's status — one round trip for the Dashboard page.

```json
{
  "alerts": [ /* SystemAlert[], newest 3 */ ],
  "activeTestRun": /* TestRun | null */,
  "latestValidation": /* LaboratoryValidationRecord | null */,
  "telemetry": [ /* SensorReading[] */ ],
  "deviceStatus": /* DeviceStatus | null */
}
```

---

## Telemetry

Backed by the normalized `sensor_readings` table (one row per sensor per
reading), joined to `sensors` for `category`/`position`/`unit`. The API
pivots rows into the frontend's merged `{ before, after }` shape.

**Telemetry grouping assumption**: a reading "cycle" is all `sensor_readings`
rows sharing the same `device_id` + `test_run_id` + `measured_at` timestamp
— i.e. the device reports all sensors in one batch per cycle. If the
firmware ever timestamps sensors independently within a cycle, this grouping
will split what should be one `TelemetryRecord` into several. Revisit
`groupReadingsIntoTelemetry` in `backend/src/lib/mappers.js` if that changes.

**`totalVolume`** (from `SensorParameter`) is intentionally never populated
by these endpoints — it isn't one of the five confirmed sensor categories
(`ph, turbidity, tds, temperature, flow_rate` per `REQUIREMENTS.md`). Use
`TestRun.processedVolume` instead for a run-level volume figure.

### `GET /telemetry`

Query: `from`, `to` (on `measured_at`), `testRunId`, `deviceId`, `parameter`
(`pH|turbidity|TDS|temperature|flowRate`), `stage` (`before|after`), `limit`,
`offset`.

```json
[
  {
    "id": "2a273ff0-...|RUN_ID_or_omitted|2026-09-16T12:01:37.439+00:00",
    "timestamp": "2026-09-16T12:01:37.439+00:00",
    "testRunId": null,
    "deviceId": "2a273ff0-fde6-4453-899a-c05af063d071",
    "before": { "flowRate": 2.1, "temperature": 26.3, "TDS": 300, "turbidity": 9.4, "pH": 7.1 },
    "after": { "flowRate": 2.1, "temperature": 26.3, "TDS": 180, "turbidity": 0.7, "pH": 7.1 }
  }
]
```

`id` is an opaque composite key (`deviceId|testRunId|measuredAt`, URL-encode
it before using it in a path) — pass it straight to `GET /telemetry/:id`.

### `GET /telemetry/current`

No query required (optional `?deviceId=`). Returns `SensorReading[]` — one
entry per sensor per stage, latest value only. This is what drives the live
`SensorGrid`.

```json
[
  { "parameter": "pH", "label": "ph", "value": 7.1, "unit": "pH", "stage": "before" },
  { "parameter": "pH", "label": "ph", "value": 7.1, "unit": "pH", "stage": "after" }
]
```

Note: `label` here is the raw sensor `category` (e.g. `"ph"`), not the
display label the mock's `parameterMeta` used (e.g. `"pH"`). If the UI reads
`label` for display text rather than `parameter`, add a small display-label
lookup on the frontend side, or ask backend to add one — it wasn't stored
anywhere in the schema and duplicating `parameterMeta` server-side felt more
fragile than fixing it in one place.

### `GET /telemetry/:id`

Detail for one grouped record (same shape as one `GET /telemetry` entry).
`404` if no readings match that composite id.

### `GET /telemetry/chart`

Query: `parameter` (default `turbidity`), `from`, `to`.

```json
[{ "time": "2026-09-16T12:01:37.439+00:00", "before": 9.4, "after": 0.7 }]
```

`time` is a full ISO timestamp, not the mock's local `"14:15:00"` string —
format it on the frontend for display.

### `GET /telemetry/stream` (SSE)

See "Real-time" above.

---

## Alerts

`alerts` table now has `source`/`title`/`message` (added in the follow-up
migration — the original schema only had a `category` taxonomy column,
which isn't used by these routes since its values are still TBD).

### `GET /alerts`

Query: `severity`, `status`, `source` (partial match), `from`/`to` (on
`triggered_at`), `limit`, `offset`.

```json
[
  {
    "id": "4c4b93bc-836b-4774-aca6-fb1c7238d466",
    "timestamp": "2026-09-16T12:01:37.465444+00:00",
    "severity": "Warning",
    "source": "Pre-Filtration Turbidity Sensor",
    "title": "Test Alert",
    "message": "Smoke test alert",
    "status": "Active"
  }
]
```

`testRunId` is present when the alert was created with one, otherwise
omitted (frontend type marks it optional).

### `GET /alerts/:id`

Same shape, single object. `404` if not found.

### `PATCH /alerts/:id/acknowledge` / `PATCH /alerts/:id/resolve`

No body. Sets `status` to `Acknowledged`/`Resolved`, records
`acknowledged_at`/`acknowledged_by` (on acknowledge), and logs a row in
`alert_state_changes`. Returns the updated `SystemAlert`.

There is intentionally no `POST /alerts` — per the plan and
`docs/API_ROUTES_DRAFT.md`, alerts are assumed system-generated (from a
device or a future rules engine), not client-created. If a manual "raise an
alert" UI action is ever needed, that's a new decision, not an oversight
here.

### `GET /alerts/stream` (SSE)

See "Real-time" above.

---

## Test Runs

`TestRun.duration`, `.telemetryCount`, `.alertCount`, and `.validationStatus`
are **computed on read**, not stored columns — see
`backend/src/lib/testRunHydrator.js`. `validationStatus` is `"Available"` if
any linked `laboratory_validation_records` row has a `percentage_error` or a
`results.referenceResult`, else `"Pending"`. `processedVolume` currently
falls back to `target_volume_liters` (or `0`) — there's no flow-integration
logic yet (that's `PENDING_DECISIONS` §5's "1 L target" logic, still open).

### `GET /test-runs`

Query: `deviceId`, `status`, `limit`, `offset`.

```json
[
  {
    "id": "81e398b8-48e0-4a5b-b572-10ded27a0114",
    "startedAt": "2026-09-16T12:01:14.442302+00:00",
    "endedAt": "2026-09-16T12:01:14.718+00:00",
    "duration": "00m 00s",
    "processedVolume": 0,
    "status": "Completed",
    "telemetryCount": 0,
    "alertCount": 0,
    "validationStatus": "Pending",
    "notes": "smoke test run"
  }
]
```

### `GET /test-runs/:id`

Same shape, single object. `404` if not found.

### `POST /test-runs`

```json
// request — CreateTestRunInput, plus optional deviceId
{ "sampleInformation": "...", "notes": "...", "deviceId": "2a273ff0-..." }
```

`deviceId` is optional — if omitted, the first device row is used (fine for
a single-device deployment; pass it explicitly once multiple devices exist).
Sets `status: "In Progress"`. Returns `201` + the created `TestRun`.

### `PATCH /test-runs/:id/complete`

No body. Sets `status: "Completed"`, `endedAt: now()`. Returns the updated
`TestRun`.

### `PATCH /test-runs/:id/notes`

```json
{ "notes": "updated notes" }
```

Returns the updated `TestRun`.

---

## Calibration

`CalibrationRecord.model`, `.referenceValue`, `.sensorReading`, and
`.status` all live inside `calibration_records.parameters` (`jsonb`) — the
column the original schema left shapeless on purpose
(`PENDING_DECISIONS` §12: "calibration formulas/factors TBD"). `.parameter`,
`.stage`, and `.unit` come from the joined `sensors` row instead of being
duplicated.

`model` values mirror the frontend mock's existing hardcoded map
(`PH-4502C`, `DFRobot TDS`, `DS18B20`, `ZJ-S201C`, and `"Pending
Confirmation"` for turbidity) — see `backend/src/lib/sensorModels.js`. These
are the labels the UI already shows; nothing new was invented here.

**Status is never computed** — every created record is `"Record Available"`,
same as the current mock. There is no reference-vs-sensor-reading tolerance
check that would flip a record to `"Review Needed"`, because that tolerance
is exactly the "calibration formula" `PENDING_DECISIONS` §12 leaves open.

### `GET /calibration`

Query: `parameter`, `stage`, `status`, `limit`, `offset`.

```json
[
  {
    "id": "adfbfe9a-c622-4e69-9236-6694aa05fbd8",
    "date": "2026-09-16T12:01:14.825453+00:00",
    "parameter": "pH",
    "stage": "before",
    "model": "PH-4502C",
    "referenceValue": 7,
    "sensorReading": 7.15,
    "unit": "pH",
    "status": "Record Available",
    "notes": "Calibration record created. Method details require research-team approval."
  }
]
```

### `GET /calibration/:id`

Same shape, single object.

### `GET /calibration/:id/history`

All calibration records for the same physical sensor (same `parameter` +
`stage` + device), oldest first — for the error-history mini chart.

### `POST /calibration`

```json
// request — CreateCalibrationRecordInput, plus optional deviceId
{ "parameter": "pH", "stage": "before", "referenceValue": 7, "sensorReading": 7.15, "deviceId": "2a273ff0-..." }
```

Resolves the `sensors` row for that `parameter`/`stage`/device;
`404` if no such sensor is registered on that device (seed data registers
all 5 parameters × 2 stages for the one seeded device). Returns `201` + the
created record.

---

## Laboratory Validation

`stage`, `parameter`, `referenceResult`, `sensorReading`, `unit`,
`conclusion`, `notes` all live inside `laboratory_validation_records.results`
(`jsonb`), same rationale as calibration's `parameters` column
(`PENDING_DECISIONS` §12).

**Percentage-error formula is a placeholder**: `|sensorReading -
referenceResult| / referenceResult * 100`. This is the standard textbook
definition, but the exact convention this project wants (signed vs.
absolute, rounding, which value is authoritative) is still open per
`PENDING_DECISIONS` §12 — treat this as "a number goes in the column," not a
confirmed lab-validation formula.

`status` is `"Pending"` only when both `percentage_error` is null and
`results.referenceResult` is undefined; otherwise `"Available"`.

### `GET /laboratory-validation`

Query: `testRunId`, `limit`, `offset`.

```json
[
  {
    "id": "59a53153-f15c-471d-9399-fc5852daddca",
    "date": "2026-09-16T12:01:15.076253+00:00",
    "testRunId": "81e398b8-48e0-4a5b-b572-10ded27a0114",
    "sampleId": "SMP-001",
    "stage": "after",
    "parameter": "turbidity",
    "referenceResult": 0.7,
    "sensorReading": 0.72,
    "unit": "NTU",
    "status": "Available",
    "notes": ""
  }
]
```

### `GET /laboratory-validation/:id`

Same shape, single object.

### `POST /laboratory-validation`

```json
// request — CreateLaboratoryValidationRecordInput, plus optional extras
{
  "testRunId": "81e398b8-...", "sampleId": "SMP-001",
  "referenceResult": 0.7,
  "stage": "after", "parameter": "turbidity", "sensorReading": 0.72, "unit": "NTU"
}
```

Only `testRunId` and `sampleId` are required (matching
`CreateLaboratoryValidationRecordInput`); the rest default to `undefined` if
omitted rather than being fabricated (the frontend mock hardcoded
`sensorReading: 0.72` for every record — the real backend does not do that).
Returns `201` + the created record.

### `PATCH /laboratory-validation/:id/result`

```json
{ "referenceResult": 0.71, "conclusion": "Matches expected range." }
```

Attaches/updates the external lab result once it arrives, recomputes
`percentage_error`. Returns the updated record.

---

## Maintenance

`maintenance_records` and `maintenance_reminders` are new tables (not part
of the original 9-table schema — Maintenance wasn't one of `DATABASE.md`'s
listed domains). `performedBy` is resolved from the authenticated caller's
`profiles.full_name` (falls back to their email, then `"Unknown"`).

### `GET /maintenance/records`

Query: `component` (partial match), `type`, `status`, `limit`, `offset`.

```json
[
  {
    "id": "93a06476-e2f8-45e8-be08-909c91972afc",
    "date": "2026-09-16T12:01:14.954897+00:00",
    "component": "Booster Pump",
    "type": "Inspection",
    "description": "Inspection record created.",
    "status": "Completed",
    "performedBy": "Test Admin",
    "notes": "smoke test"
  }
]
```

### `POST /maintenance/records`

```json
// request — CreateMaintenanceRecordInput, plus optional type/description
{ "component": "Booster Pump", "notes": "...", "type": "Inspection", "description": "..." }
```

Returns `201` + the created record.

### `GET /maintenance/reminders`

```json
[{ "id": "c3230247-...", "component": "UV-C Unit", "label": "UV-C Review", "dueDate": "2026-09-20", "status": "Upcoming" }]
```

### `POST /maintenance/reminders`

```json
{ "component": "UV-C Unit", "label": "UV-C Review", "dueDate": "2026-09-20" }
```

Returns `201` + the created reminder (`status` defaults to `"Upcoming"`).

### `PATCH /maintenance/reminders/:id/dismiss`

No body. Sets `status: "Dismissed"` and `dismissedAt`. **Note:**
`MaintenanceReminder.status` in `frontend/src/types/index.ts` is currently
typed as only `'Due' | 'Upcoming'` — this route introduces a third value the
frontend type doesn't have yet. Widen that union (or map `"Dismissed"` to
removing the row from the list client-side) when wiring this up.

---

## Settings

### `GET /settings` / `PUT /settings`

```json
{
  "systemName": "AquaSense Research Console",
  "deviceDisplayName": "ESP32 Filtration Unit (Simulated)",
  "timezone": "Asia/Manila",
  "dateFormat": "YYYY-MM-DD",
  "timeFormat": "24h",
  "notifications": { "offline": true, "sensor": true, "noFlow": true, "waterQuality": true, "pump": false, "uvc": false, "maintenance": true }
}
```

`PUT` body is the same shape; upserts the single settings row. Backed by
seed data (`supabase/seed.sql`), so `GET /settings` never 404s on a freshly
reset local DB.

### `GET /thresholds` / `PUT /thresholds`

Content shape is deliberately opaque — `docs/PENDING_DECISIONS.md` calls
"approved thresholds" TBD. `GET` returns whatever was last stored:

```json
[{ "parameter": "turbidity", "stage": "after", "config": { "max": 1 } }, { "parameter": "pH", "config": { "min": 6.5, "max": 8.5 } }]
```

`PUT` body is an array of `{ parameter, stage?, config }`; each entry
upserts by `(parameter, stage)`. `stage` is optional (parameter-level
threshold with no stage split).

### `GET /notifications/providers` / `PUT /notifications/providers`

SMS/notification provider is TBD (`PENDING_DECISIONS`: "SMS provider").
`GET` returns whatever providers have been configured:

```json
[{ "provider": "twilio", "enabled": false, "config": {} }]
```

`PUT` body upserts one provider: `{ "provider": "twilio", "enabled": true, "config": { ... } }`.

### `GET /data-retention` / `PUT /data-retention`

```json
{ "retentionDays": 90, "config": {} }
```

`PUT` body: `{ "retentionDays": 90, "config": {} }`.

---

## Devices

Not an explicit page of its own, but backs Settings' Device Status card and
lets the frontend discover a `deviceId` to pass to the routes above that
accept one.

### `GET /devices` / `GET /devices/:id`

Returns raw device rows (not remapped — there's no dedicated frontend type
for "a device" beyond `DeviceStatus`, which is the `:id/status` route
below).

### `POST /devices`

```json
{ "deviceIdentifier": "ESP32-002", "name": "Second Unit", "isSimulated": true, "controllerName": "ESP32 DevKit V1" }
```

Placeholder registration route — device auth/provisioning is TBD
(`PENDING_DECISIONS` §8). Returns `201` + the created device row.

### `GET /devices/:id/status`

```json
{
  "deviceId": "2a273ff0-fde6-4453-899a-c05af063d071",
  "controller": "ESP32 DevKit V1",
  "connection": "Pending Hardware Integration",
  "wifiConnection": "Not Configured",
  "failSafeControl": "Pending Hardware Integration"
}
```

`connection`/`wifiConnection`/`failSafeControl` are plain stored columns set
via `PUT .../config` (or a future device heartbeat) — **not** derived from
any online/offline timeout heuristic, because that timeout rule is TBD
(`PENDING_DECISIONS` §6). If `last_seen_at` was never set, `lastUpdatedAt` is
omitted rather than guessed (falls back to the latest `sensor_readings` row
for that device if one exists).

### `PUT /devices/:id/config`

```json
{ "connectionState": "Online", "wifiState": "Connected", "failSafeState": "Local Control Active" }
```

Any subset of `connectionState`/`wifiState`/`failSafeState`/`controllerName`/
`config` may be sent. Always bumps `lastUpdatedAt` to now. Returns the
updated `DeviceStatus`. This is the route the UI's current "Pending Hardware
Integration" placeholders should eventually call once real hardware
integration lands.

---

## Users

`profiles` rows, one per Supabase Auth user (auto-created via the
`on_auth_user_created` trigger — see `SCHEMA_TBD_LOG.md`). Default role on
creation is `"Viewer"` (least-privilege placeholder, not a permissions
decision — anyone can `PATCH .../role` since role enforcement isn't
implemented, see "Authentication" above).

### `GET /users` / `GET /users/:id`

```json
[{ "id": "0aca0b4d-...", "name": "Test Admin", "email": "admin@test.local", "role": "Administrator", "status": "Active" }]
```

### `POST /users`

```json
{ "name": "New Researcher", "email": "researcher@test.local", "password": "...", "role": "Researcher" }
```

Provisions a real Supabase Auth user (`email_confirm: true`, so no
confirmation email is required) plus its profile row. Returns `201`.

### `PATCH /users/:id/role`

```json
{ "role": "Researcher" }
```

### `PATCH /users/:id/status`

```json
{ "status": "Inactive" }
```

App-level flag only — does **not** suspend the underlying Supabase Auth
account (enforcing that is a `PENDING_DECISIONS` §9 question).

### `DELETE /users/:id`

Deletes the Supabase Auth user; the profile row cascades. `204` on success,
`404` if the id doesn't exist.

---

## Health

### `GET /health`

No auth. `{ "status": "ok" }` — liveness only, does not reflect device
online/offline state (see `docs/API_ROUTES_DRAFT.md` §1 — same rationale
carried over here).

---

## Running this locally

```bash
cd backend
npx supabase start     # first time only per docs/LOCAL_SUPABASE.md
npx supabase db reset  # applies both migrations + supabase/seed.sql
cp .env.example .env   # then fill in the values `supabase start` printed
npm run dev            # ts-node + nodemon; recompiles nothing to disk
```

The whole backend is TypeScript (`src/**/*.ts`, `index.ts`, `scripts/*.ts`).
`npm run dev` runs it directly via `ts-node`; `npm run typecheck` runs
`tsc --noEmit` on its own (useful in CI or before committing); `npm run
build` compiles to `dist/` for `npm start` (production). Row types come from
`src/types/database.types.ts`, generated with `npx supabase gen types
typescript --local` — regenerate it after any new migration. `typescript`
is pinned to the 5.x line deliberately: the 7.x line (a rewritten compiler)
changes its Node API surface in a way `ts-node` doesn't support yet — plain
`tsc` builds fine under 7.x, but `npm run dev`/`npm run seed` need 5.x.

Seed data (`supabase/seed.sql`, applied automatically by `db reset`) gives
you one device (`SIM-DEV-001`) with all 10 sensors registered (5 parameters
× before/after), and default rows for `app_settings`/`data_retention_policy`
— enough to satisfy routes that need *something* to exist, but no test
runs, alerts, readings, or a login.

For an actually-populated database plus a ready-to-use token, run the
seeder script instead:

```bash
npm run seed
```

`backend/scripts/seedTestData.ts` creates a test user
(`seed-admin@aquasense.test` / `SeedTest123!`), two test runs (one active,
one completed) with 100 sensor readings across 5 reading cycles, 3 alerts, 3
calibration records, 2 laboratory validation records (one `Available`, one
`Pending`), 2 maintenance records, 2 maintenance reminders, and threshold +
notification-provider config — then logs in and prints the access token plus
copy-pasteable `curl` commands for the routes above. Safe to re-run (the
test user is recreated each time); run `npx supabase db reset` first if you
want a fully clean slate before seeding again.
