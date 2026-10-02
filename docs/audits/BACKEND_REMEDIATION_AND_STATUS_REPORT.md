# Backend Remediation & Status Report

**Repository**: `iot-water-filtration-system`  
**Branch**: `fix/backend-audit-issues`  
**Base Branch**: `integration/frontend-api-connection`  
**Date**: October 1, 2026  
**Auditor & Remediation Lead**: Antigravity Autonomous Agent  
**Milestones**: Feature Freeze: **October 8, 2026** | Final Defense: **October 10, 2026**  

---

## Executive Summary

Following a comprehensive repository audit against architectural contracts and project constraints ([`AGENTS.md`](../../AGENTS.md)), all actionable backend and integration audit items (**`BE-01` through `BE-08`**) have been systematically resolved, implemented, tested, and verified on branch `fix/backend-audit-issues`.

The backend, API contract, and ESP32 C++ firmware now maintain **100% synchronization**. All test suites pass:
- **Unit Tests**: 10 files passed, **57/57 passed** (0 failures).
- **Integration Tests**: 3 files passed, **14/14 passed** (0 failures) against local PostgreSQL/Supabase.
- **TypeScript & Production Builds**: Clean compilation with **0 errors** in both `backend/` and `frontend/`.

---

## 1. Remediation Details: What Has Been Done

### A. API Contract & Firmware Synchronization (`BE-01`)
- **Root Cause**: [`firmware/esp32/include/config.h`](../../firmware/esp32/include/config.h) had `kApiTelemetryPath = ""` because [`docs/API_CONTRACT.md`](../../docs/API_CONTRACT.md) had not documented the telemetry ingestion route or headers, blocking the physical ESP32 from transmitting telemetry.
- **Contract Formalization**:
  - Documented canonical `POST /api/v1/devices/:id/readings` and alias `POST /api/v1/devices/:id/telemetry` in `docs/API_CONTRACT.md` Section 6.
  - Formally specified `X-Device-Key` header authentication, request payload structure (`measuredAt`, optional `testRunId`, array of sensor `readings`), status codes (201 Created, 200 OK idempotent retry, 400 Bad Request, 401 Unauthorized, 404 Not Found), and deduplication/partial ingestion semantics.
- **Backend Route Flexibility**:
  - In [`backend/src/routes/devices.routes.ts`](../../backend/src/routes/devices.routes.ts), updated `:id` parameter resolution: checks `isUuid(id)`. If valid UUID, queries `devices.id`; if not, queries `devices.device_identifier = id`. This eliminates the need for physical hardware or simulators to know database-internal UUIDs.
  - Added route alias `router.post('/:id/telemetry', requireDeviceKey, validateBody(readingsEnvelopeSchema), handleReadingsIngestion)`.
- **Firmware Implementation**:
  - In [`firmware/esp32/include/config.h`](../../firmware/esp32/include/config.h), set `kApiTelemetryPath = "/devices/ESP32-DEV-001/telemetry"`.
  - In [`firmware/esp32/include/secrets.example.h`](../../firmware/esp32/include/secrets.example.h), added `#define DEVICE_KEY ""` placeholder.
  - In [`firmware/esp32/include/api_client.h`](../../firmware/esp32/include/api_client.h) and [`firmware/esp32/src/api_client.cpp`](../../firmware/esp32/src/api_client.cpp), updated `ApiClient::begin(...)` to accept `deviceKey` and automatically attach header `X-Device-Key` to HTTP POST requests.
  - In [`firmware/esp32/src/main.cpp`](../../firmware/esp32/src/main.cpp), passed `DEVICE_KEY` to `gApi.begin(...)`.
- **Integration Test**:
  - Added test in [`backend/src/__tests__/integration/deviceReadings.integration.test.ts`](../../backend/src/__tests__/integration/deviceReadings.integration.test.ts) confirming ingestion via the `/telemetry` alias using `device_identifier`.

---

### B. Provisional Water Quality Thresholds (`BE-02`)
- **Root Cause**: The `thresholds` table was empty in `seed.sql`, causing `alertEngine.ts` to evaluate 0 thresholds and silently drop water-quality abnormal reading alerts.
- **Resolution**:
  - Seeded initial provisional alert thresholds for all 4 primary water parameters (`pH`, `turbidity`, `TDS`, `temperature`) in both [`backend/supabase/seed.sql`](../../backend/supabase/seed.sql) and [`backend/scripts/seedTestData.ts`](../../backend/scripts/seedTestData.ts).
  - Explicitly tagged each threshold with `"provisional": true` and marked `approval_state = 'Provisional'` per [`AGENTS.md`](../../AGENTS.md) guidelines to avoid claiming final research criteria.

---

### C. Domain Contracts & Frontend Compatibility (`BE-03` & `BE-04`)
- **`isSimulated` Propagation (`BE-03`)**:
  - Added `isSimulated?: boolean` to [`backend/src/types/domain.ts`](../../backend/src/types/domain.ts) and mapped `row.is_simulated === true` in `toDeviceStatus()` in [`backend/src/lib/mappers.ts`](../../backend/src/lib/mappers.ts).
  - Added unit test in [`backend/src/lib/mappers.test.ts`](../../backend/src/lib/mappers.test.ts).
- **Fault-Tolerant Telemetry Mapping (`BE-04`)**:
  - Added `status: row.reading_status ?? 'valid'` to `toSensorReadings()` in [`backend/src/lib/mappers.ts`](../../backend/src/lib/mappers.ts).
  - Updated `GET /telemetry/current` in [`backend/src/routes/telemetry.routes.ts`](../../backend/src/routes/telemetry.routes.ts) so that if a sensor reports a transient simulated fault (`value: null, status: 'unavailable'`), the query falls back to the latest valid measurement. This prevents dashboard sensor cards from crashing or disappearing.

---

### D. Security & Role-Based Access Control (`BE-05`)
- **Root Cause**: `requireRole('Administrator')` only guarded `/users/*`. All operational domain mutation endpoints permitted any authenticated `Viewer` token.
- **Resolution**:
  - Applied strict role enforcement across all routes:
    - **`Administrator` Only**:
      - `PUT /settings`
      - `PUT /notifications/providers`
      - `PUT /data-retention`
    - **`Administrator` + `Researcher`**:
      - `PUT /thresholds`
      - `POST /test-runs`, `PATCH /test-runs/:id/complete`, `PATCH /test-runs/:id/notes`
      - `POST /calibration`
      - `POST /laboratory-validation`, `PATCH /laboratory-validation/:id/result`
      - `POST /maintenance/records`, `POST /maintenance/reminders`, `PATCH /maintenance/reminders/:id/dismiss`
      - `PATCH /alerts/:id/acknowledge`, `PATCH /alerts/:id/resolve`
    - **`Viewer`**: Strictly read-only access.

---

### E. Simulator Integration & Throughput Integration (`BE-06` & `BE-07`)
- **Live Simulator Test Run Linking (`BE-06`)**:
  - Added `resolveActiveTestRunId(deviceId)` in [`backend/scripts/liveSimulator.ts`](../../backend/scripts/liveSimulator.ts) to query active "In Progress" test runs (or read `process.env.LIVE_SIM_TEST_RUN_ID`).
  - Attached `testRunId` to outgoing packets so that running the simulator properly increments `telemetryCount` and populates charts for active test runs in the UI.
- **Flow Volume Numerical Integration (`BE-07`)**:
  - Implemented `computeProcessedVolume()` in [`backend/src/lib/testRunHydrator.ts`](../../backend/src/lib/testRunHydrator.ts) using trapezoidal numerical integration ($\text{Volume} = \int \text{flow\_rate} \, dt$) over post-filtration flow readings.
  - Added unit test suite [`backend/src/lib/testRunHydrator.test.ts`](../../backend/src/lib/testRunHydrator.test.ts) covering constant flow, accelerating flow, irregular intervals, and single-point edge cases.

---

### F. Ingestion Idempotency & Deduplication (`BE-08`)
- **Root Cause**: Rapid Wi-Fi retries by the ESP32 caused duplicate rows in `sensor_readings` because no unique constraint or idempotency key was enforced.
- **Resolution**:
  - Created migration [`backend/supabase/migrations/20261001120000_sensor_readings_idempotency.sql`](../../backend/supabase/migrations/20261001120000_sensor_readings_idempotency.sql) adding unique index on `sensor_readings (sensor_id, measured_at)`.
  - Added intra-batch deduplication (first measurement retained per batch).
  - Added retry idempotency handling: returns HTTP 200 with heartbeat `last_seen_at` updated instead of 500 duplicate key error.
  - Added automated integration tests verifying deduplication and idempotency in `deviceReadings.integration.test.ts`.

---

## 2. Verification & Test Summary

| Area / Check | Command | Status | Notes |
|---|---|:---:|---|
| **Backend Vitest Unit Tests** | `npm run test` (in `backend/`) | **PASS** | 10 test files, **57/57 tests passing** |
| **Backend Integration Tests** | `npm run test:integration` (in `backend/`) | **PASS** | 3 test files, **14/14 tests passing** against local Supabase |
| **Backend TypeScript Check** | `npm run typecheck` (in `backend/`) | **PASS** | 0 type errors |
| **Backend Production Build** | `npm run build` (in `backend/`) | **PASS** | `dist/` built successfully |
| **Frontend Production Build** | `npm run build` (in `frontend/`) | **PASS** | Vite production build clean (908ms) |
| **Firmware Structural Check** | C++ Syntax & Header Inspection | **PASS** | `ApiClient` headers and parameters validated |

---

## 3. Remaining Todos & Open Decisions

| Item ID | Area | Status | Description | Action Needed |
|---|---|:---:|---|---|
| **BE-09** | Hardware Safety / Actuators | **Open (Policy)** | Final decision on whether ESP32 controls booster pump / UV-C relay locally or operates monitor-only. | Decision from client/research adviser (Edgar/Hardware team). |
| **BE-10** | SMS & Retention | **Open (Policy)** | Choosing production SMS gateway (Twilio, Vonage, PhilSMS) and setting retention period (`retention_days`). | Client decision when standing up cloud services. |
| **DB-Cloud** | Database Migration | **Pending Deploy** | Applying `20261001120000_sensor_readings_idempotency.sql` to remote Supabase staging/production. | Run `npx supabase db push` during staging deployment. |
