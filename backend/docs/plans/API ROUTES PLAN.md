# API Route Plan for IoT Water Filtration Frontend

## Context

The frontend (`iot-water-filtration-system/frontend`) is a Vite + React SPA (react-router-dom, routes in `src/App.tsx`) with **no real backend** — every page currently reads/writes an in-memory mock layer (`src/services/*` + `src/data/mock/*`) via a `useServiceData` hook. There's already a generic HTTP client (`src/services/apiClient.ts`, `apiRequest<T>()`) wired to `VITE_API_BASE_URL` but no service calls it yet. The domain types in `src/types/index.ts` and the per-domain service interfaces (`AlertsService`, `TestRunsService`, `CalibrationService`, `LaboratoryValidationService`, `MaintenanceService`, `SettingsService`, `TelemetryService`, `UsersService`, `DeviceService`) already describe the exact shapes a backend needs to satisfy — this plan turns those into concrete REST routes.

The app also has two structural gaps that block real deployment: **no authentication** (no login page, no token/session handling — Header hardcodes "Administrator") and **no real-time data path** (no polling/WebSocket — everything loads once on mount). Per user decision, this plan includes routes for both, alongside CRUD for the 8 existing pages.

This is a **planning-only** task — no code will be changed on this branch. The output is the route inventory below, meant to guide backend implementation work in a future session.

## Route inventory by domain

Base path assumed: `/api/v1` (matches `.env.example` default `VITE_API_BASE_URL`).

### 1. Auth (new — no current frontend support)
- `POST /auth/login` — email/password → session token + user profile
- `POST /auth/logout` — invalidate session
- `GET /auth/me` — current user profile (drives Header's user display, replacing hardcoded "Administrator")
- `POST /auth/refresh` — refresh access token (if using short-lived JWT + refresh token)
- *(optional, if self-service password reset is wanted)* `POST /auth/password-reset/request`, `POST /auth/password-reset/confirm`

### 2. Dashboard (`/dashboard` — read-only aggregation)
No dedicated endpoints beyond the ones below; the page composes calls to Alerts, Test Runs, Laboratory Validation, Telemetry, and Device Status. Optionally a single aggregation endpoint to cut round-trips:
- `GET /dashboard/summary` — bundles latest alerts (top 3), active test run, latest validation record, latest telemetry, device status in one response

### 3. Telemetry (`/history`, `SensorGrid`, dashboard charts)
- `GET /telemetry` — list telemetry records; query params: `from`, `to`, `testRunId`, `parameter`, `stage` (server-side filtering to replace the current client-side filtering in `HistoryPage`)
- `GET /telemetry/current` — latest before/after sensor snapshot (for live `SensorGrid`)
- `GET /telemetry/:id` — single record detail (for Record Inspector)
- `GET /telemetry/chart` — pre-aggregated chart series (turbidity trend etc.), query params `from`/`to`/`parameter`
- `GET /telemetry/stream` (SSE) or WebSocket `WS /telemetry/live` — real-time push of new sensor readings, replacing the non-existent live-update path; drives Dashboard's live `SensorGrid` and turbidity chart without polling

### 4. Alerts (`/alerts`)
- `GET /alerts` — list; query params `severity`, `status`, `source`, `from`, `to`
- `GET /alerts/:id` — detail
- `PATCH /alerts/:id/acknowledge` — status → `Acknowledged`
- `PATCH /alerts/:id/resolve` — status → `Resolved`
- `WS /alerts/live` or SSE `GET /alerts/stream` — push new alerts as they fire (device-side threshold breaches), feeding Dashboard's alert badge and AlertsPage in real time

### 5. Test Runs (`/test-runs`)
- `GET /test-runs` — list
- `GET /test-runs/:id` — detail (includes telemetry snapshot + associated alerts, or these are fetched separately by `testRunId`)
- `POST /test-runs` — create, body: `CreateTestRunInput` (`sampleInformation`, `notes`)
- `PATCH /test-runs/:id/complete` — end run, sets `endedAt`/`status: Completed`
- `PATCH /test-runs/:id/notes` — update notes field

### 6. Calibration (`/calibration`)
- `GET /calibration` — list; query params `parameter`, `stage`, `status`
- `GET /calibration/:id` — detail (for error-history mini chart, likely `GET /calibration/:id/history` or `?parameter=&stage=` on the list endpoint)
- `POST /calibration` — create, body: `CreateCalibrationRecordInput` (`parameter`, `stage`, `referenceValue`, `sensorReading`)
- *(gap noted: the modal UI isn't wired to real form state today — flag for backend/frontend alignment, not a route issue)*

### 7. Laboratory Validation (`/laboratory-validation`)
- `GET /laboratory-validation` — list
- `GET /laboratory-validation/:id` — detail
- `POST /laboratory-validation` — create, body: `CreateLaboratoryValidationRecordInput` (`testRunId`, `sampleId`, `referenceResult`)
- `PATCH /laboratory-validation/:id/result` — attach/update `referenceResult` once external lab result arrives (not modeled in mock service today, but needed for a real workflow where the reference result comes later than record creation)

### 8. Maintenance (`/maintenance`)
- `GET /maintenance/records` — list; query params `component`, `type`, `status`
- `POST /maintenance/records` — create, body: `CreateMaintenanceRecordInput` (`component`, `notes`, plus `type`/`description` once form is wired)
- `GET /maintenance/reminders` — list reminders (`Due`/`Upcoming`)
- `POST /maintenance/reminders` — create reminder *(not in current mock service, but needed for a real maintenance-scheduling backend)*
- `PATCH /maintenance/reminders/:id/dismiss` — mark handled *(same — future need, no current UI hook yet)*

### 9. Settings (`/settings`)
- `GET /settings` — fetch `AppSettings`
- `PUT /settings` — update general/notification settings
- `GET /devices/:id/status` — device status (ESP32 connection, wifi, fail-safe) — could live under a `devices` resource since it's device-specific, not settings-specific
- `PUT /devices/:id/config` — device control/connectivity config (currently "Pending Hardware Integration" placeholder in UI — route needed once hardware integration lands)
- `GET /thresholds`, `PUT /thresholds` — alert threshold configuration (currently placeholder "Configuration Pending" in UI)
- `GET /notifications/providers`, `PUT /notifications/providers` — SMS/notification provider config (currently placeholder)
- `GET /data-retention`, `PUT /data-retention` — retention policy config (currently placeholder)

### 10. Users (`/settings` users table)
- `GET /users` — list
- `GET /users/:id` — detail
- `PATCH /users/:id/role` — update role (UI has an unwired "Edit Role" button today — route is the natural backing for it)
- *(optional, if user management expands)* `POST /users`, `PATCH /users/:id/status` (Active/Inactive), `DELETE /users/:id`

## Real-time strategy note

None of the 8 pages currently poll or subscribe — everything is fetch-once-on-mount. Two real-time-sensitive surfaces exist: **Dashboard** (live sensor grid, turbidity chart, device status) and **Alerts** (new alerts should appear without a manual refresh). Recommend one WebSocket channel (`WS /realtime`) multiplexing telemetry + alert + device-status events, or SSE if simplicity is preferred over bidirectionality — either replaces the naive alternative of client-side polling intervals, which would be wasteful for continuous IoT sensor data.

## Verification

This is a planning task with no code changes — nothing to run or test. When backend implementation begins, verification should be: each route's response shape checked against the corresponding TypeScript type in `src/types/index.ts`, and each existing mock service (`src/services/*Service.ts`) swapped to call `apiRequest()` against the new route instead of the local mock array, confirming each page still renders correctly end-to-end.
