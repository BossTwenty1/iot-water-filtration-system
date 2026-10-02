# Backend Audit Action & Attention Register

**Target Audience**: Backend Developer (Alejandro) / Project Lead (Nash)  
**Date**: October 1, 2026  
**Auditor**: Antigravity Autonomous Agent  
**Audited Branch**: `integration/frontend-api-connection`  
**Milestones**: Feature Freeze: **October 8, 2026** | Final Defense: **October 10, 2026**  

---

## 1. Executive Summary

This register consolidates **all backend, database, API contract, and simulation audit findings** requiring your attention. Frontend visual and layout items have been filtered out.

The backend infrastructure is robust (well-structured routes, PostgreSQL schemas via Supabase, RLS policies, Vitest test suites, and simulated telemetry pipelines). However, there are **critical gaps, dormant systems, contract desynchronizations, and open policy decisions** that must be addressed before the prototype defense.

---

## 2. Master Backend Action Matrix

| Item ID | Priority | Area | Issue Summary | Target Files | Action Type | Status |
|---|---|---|---|---|---|:---:|
| **BE-01** | **P0 Blocker** | API Contract & Firmware Sync | Firmware refuses to transmit telemetry (`kApiTelemetryPath = ""`) because `docs/API_CONTRACT.md` was never updated with `POST /devices/:id/readings`. | [`docs/API_CONTRACT.md`](file:///home/hikaru/Commisions/iot-water-filtration-system/docs/API_CONTRACT.md)<br/>[`firmware/esp32/include/config.h`](file:///home/hikaru/Commisions/iot-water-filtration-system/firmware/esp32/include/config.h) | Contract Sync | **Resolved** |
| **BE-02** | **P0 Blocker** | Alert Engine & Seed Data | Water-quality threshold alerts are 100% dormant because `thresholds` table has 0 rows in `seed.sql`. Alert engine skips all threshold evaluations. | [`backend/supabase/seed.sql`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/supabase/seed.sql)<br/>[`backend/src/lib/alertEngine.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/alertEngine.ts) | Seed Data & Logic | **Resolved** |
| **BE-03** | **P1 High** | Device Status Contract | `GET /devices/:id/status` via `toDeviceStatus()` omits `is_simulated`. Frontend is forced to make a secondary call to `GET /devices` and blindly pick `devices[0]`. | [`backend/src/lib/mappers.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/mappers.ts)<br/>[`backend/src/types/domain.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/types/domain.ts) | Contract & Mapper | **Resolved** |
| **BE-04** | **P1 High** | Sensor Reading Mapper | `toSensorReadings()` filters out `row.value === null`, causing faulty/unavailable sensors to vanish from the UI instead of rendering a visible fault state. | [`backend/src/lib/mappers.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/mappers.ts) | Data Mapper Bug | **Resolved** |
| **BE-05** | **P1 High** | Authorization & RBAC | `requireRole('Administrator')` only protects `/users/*`. All domain write routes (`PUT /thresholds`, `PUT /settings`, `POST /test-runs`, `POST /calibration`) permit any `Viewer`. | [`backend/src/routes/settings.routes.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/settings.routes.ts)<br/>[`backend/src/routes/testRuns.routes.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/testRuns.routes.ts) | Security / RBAC | **Resolved** |
| **BE-06** | **P2 Medium** | Simulator / Test Runs | `liveSimulator.ts` never attaches a `testRunId`, so all simulated telemetry has `test_run_id = null`. Active test runs permanently report `telemetryCount: 0`. | [`backend/scripts/liveSimulator.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/scripts/liveSimulator.ts) | Simulator Script | **Resolved** |
| **BE-07** | **P2 Medium** | Test Run Hydration | Test runs report `processedVolume: row.target_volume_liters ?? 0`. No flow rate accumulation ($\int flow\_rate \, dt$) exists in backend or firmware. | [`backend/src/lib/testRunHydrator.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/testRunHydrator.ts) | Business Logic | **Resolved** |
| **BE-08** | **P2 Medium** | Ingestion Idempotency | `POST /devices/:id/readings` has no unique constraint or idempotency key on `(sensor_id, measured_at)`. Network retries create duplicate rows in `sensor_readings`. | [`backend/src/routes/devices.routes.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/devices.routes.ts)<br/>[`backend/supabase/migrations/`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/supabase/migrations/) | Database & API | **Resolved** |
| **BE-09** | **P3 Policy** | Actuator Authority & Safety | Client confirmed rule to cut water flow on sensor fault, but whether the booster pump and UV-C are ESP32-controlled or monitor-only remains undecided. | [`docs/PENDING_DECISIONS.md`](file:///home/hikaru/Commisions/iot-water-filtration-system/docs/PENDING_DECISIONS.md)<br/>[`backend/Report.md`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/Report.md) | Policy Decision | **Open** |
| **BE-10** | **P3 Policy** | Data Retention & SMS | `retentionJob.ts` is inactive (`retention_days = null`); SMS notifications currently write to server logs because no SMS gateway is configured. | [`backend/src/lib/retentionJob.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/retentionJob.ts)<br/>[`backend/src/lib/notificationService.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/notificationService.ts) | Policy Decision | **Open** |

---

## 3. Detailed Technical Action Items

---

### BE-01: Update `API_CONTRACT.md` to Unblock Firmware Telemetry
- **Severity**: **P0 Blocker**
- **The Problem**:  
  In [`firmware/esp32/include/config.h#L45-L48`](file:///home/hikaru/Commisions/iot-water-filtration-system/firmware/esp32/include/config.h#L45-L48), Edgar set:
  ```cpp
  constexpr char kApiTelemetryPath[] = "";
  ```
  The ESP32 firmware refuses to send telemetry because [`docs/API_CONTRACT.md`](file:///home/hikaru/Commisions/iot-water-filtration-system/docs/API_CONTRACT.md) still says the API is unimplemented. However, Alejandro already implemented `POST /devices/:id/readings` with header `X-Device-Key` in [`backend/src/routes/devices.routes.ts#L162`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/devices.routes.ts#L162).
- **Required Action**:
  1. Update [`docs/API_CONTRACT.md`](file:///home/hikaru/Commisions/iot-water-filtration-system/docs/API_CONTRACT.md) to formally document:
     - Method: `POST /api/v1/devices/:id/readings`
     - Header: `X-Device-Key: <DEVICE_INGEST_KEY>`
     - Request Body:
       ```json
       {
         "measuredAt": "2026-10-01T10:00:00.000Z",
         "testRunId": "uuid-optional",
         "readings": [
           { "category": "ph", "position": "pre_filtration", "value": 7.12, "status": "valid" },
           { "category": "turbidity", "position": "post_filtration", "value": 0.45, "status": "valid" }
         ]
       }
       ```
  2. Coordinate with Edgar to update `firmware/esp32/src/api_client.cpp` to format this URL dynamically and attach the `X-Device-Key` header.

---

### BE-02: Activate Alert Engine with Provisional Thresholds
- **Severity**: **P0 Blocker**
- **The Problem**:  
  In [`alertEngine.ts#L175`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/alertEngine.ts#L175):
  ```typescript
  const config = thresholds.get(`${parameter}|${stage}`) ?? thresholds.get(`${parameter}|`)
  if (!config) continue
  ```
  Because the `thresholds` table is completely empty in [`backend/supabase/seed.sql`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/supabase/seed.sql), `config` is always undefined. During testing and live simulation, water quality alert evaluation never triggers.
- **Required Action**:
  Insert default provisional thresholds into [`backend/supabase/seed.sql`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/supabase/seed.sql) with clear non-authoritative tags per [`AGENTS.md`](file:///home/hikaru/Commisions/iot-water-filtration-system/AGENTS.md):
  ```sql
  -- Seed provisional alert thresholds (PNSDW 2017 baseline for testing; not final research criteria)
  insert into public.thresholds (parameter, stage, config) values
      ('pH', 'after', '{"min": 6.5, "max": 8.5, "severity": "Warning", "provisional": true}'::jsonb),
      ('turbidity', 'after', '{"max": 1.0, "severity": "Warning", "provisional": true}'::jsonb),
      ('TDS', 'after', '{"max": 300, "severity": "Warning", "provisional": true}'::jsonb),
      ('temperature', 'after', '{"min": 15, "max": 35, "severity": "Information", "provisional": true}'::jsonb)
  on conflict (parameter, stage) do nothing;
  ```

---

### BE-03: Include `isSimulated` in `DeviceStatus` Domain Contract
- **Severity**: **P1 High**
- **The Problem**:  
  In [`backend/src/lib/mappers.ts#L182`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/mappers.ts#L182), `toDeviceStatus()` omits `is_simulated`:
  ```typescript
  export function toDeviceStatus(row: DeviceRow & { latestReadingAt?: string | null }): DeviceStatus {
    return {
      deviceId: row.id,
      controller: row.controller_name ?? row.name ?? 'Unknown Controller',
      connection: row.connection_state ?? 'Pending Hardware Integration',
      wifiConnection: row.wifi_state ?? 'Not Configured',
      failSafeControl: row.fail_safe_state ?? 'Pending Hardware Integration',
      lastUpdatedAt: row.last_seen_at ?? row.latestReadingAt ?? undefined,
    }
  }
  ```
  The frontend [`deviceService.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/frontend/src/services/deviceService.ts) works around this by calling `GET /devices`, grabbing `devices[0].is_simulated`, and combining it with `GET /devices/:id/status`. If multiple devices exist, this causes race conditions and wrong status attribution.
- **Required Action**:
  1. In [`backend/src/types/domain.ts#L116`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/types/domain.ts#L116), add `isSimulated?: boolean` to `DeviceStatus`.
  2. In [`backend/src/lib/mappers.ts#L182`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/mappers.ts#L182), add:
     ```typescript
     isSimulated: row.is_simulated === true,
     ```

---

### BE-04: Retain Unavailable Sensor Readings in `toSensorReadings()`
- **Severity**: **P1 High**
- **The Problem**:  
  In [`backend/src/lib/mappers.ts#L233-L243`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/mappers.ts#L233-L243):
  ```typescript
  export function toSensorReadings(rows: SensorReadingWithSensor[]): SensorReading[] {
    return rows
      .filter((row) => row.value !== null && row.value !== undefined)
      .map((row) => ({ ... }))
  }
  ```
  When the simulator exercises sensor faults (`value: null, status: 'unavailable'`), this filter drops the reading entirely. In `GET /telemetry/current`, the sensor card vanishes from `SensorGrid.tsx` instead of showing a failure state.
- **Required Action**:
  Update `toSensorReadings()` to map null readings with a status indicator:
  ```typescript
  export function toSensorReadings(rows: SensorReadingWithSensor[]): SensorReading[] {
    return rows.map((row) => ({
      parameter: categoryToParameter(row.sensor?.category),
      label: row.sensor?.category ?? '',
      value: row.value as number,
      unit: row.sensor?.unit ?? '',
      stage: positionToStage(row.sensor?.position),
      status: row.reading_status ?? (row.value === null ? 'unavailable' : 'valid'),
    }))
  }
  ```

---

### BE-05: Enforce Role-Based Access Control (RBAC) on Domain Writes
- **Severity**: **P1 High**
- **The Problem**:  
  [`backend/src/middleware/auth.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/middleware/auth.ts) provides `requireRole(...roles)`, but it is ONLY used in `users.routes.ts`. Any authenticated user with a `Viewer` token can currently execute:
  - `PUT /api/v1/thresholds` (overwrite safety limits)
  - `PUT /api/v1/settings` (change system settings)
  - `POST /api/v1/test-runs` (start test runs)
  - `POST /api/v1/calibration` (insert calibration records)
  - `PATCH /api/v1/laboratory-validation/:id/result` (alter lab results)
  - `POST /api/v1/maintenance/records` (alter maintenance records)
- **Required Action**:
  Protect domain mutation routes by applying `requireRole('Administrator', 'Researcher')`:
  - [`backend/src/routes/settings.routes.ts#L35`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/settings.routes.ts#L35): `router.put('/settings', requireAuth, requireRole('Administrator'), ...)`
  - [`backend/src/routes/settings.routes.ts#L67`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/settings.routes.ts#L67): `router.put('/thresholds', requireAuth, requireRole('Administrator', 'Researcher'), ...)`
  - [`backend/src/routes/calibration.routes.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/calibration.routes.ts): `router.post('/', requireAuth, requireRole('Administrator', 'Researcher'), ...)`
  - [`backend/src/routes/labValidation.routes.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/labValidation.routes.ts): `router.patch('/:id/result', requireAuth, requireRole('Administrator', 'Researcher'), ...)`

---

### BE-06: Add `testRunId` Support to `liveSimulator.ts`
- **Severity**: **P2 Medium**
- **The Problem**:  
  In [`backend/scripts/liveSimulator.ts#L128`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/scripts/liveSimulator.ts#L128):
  ```typescript
  const body = { measuredAt: new Date().toISOString(), readings: buildReadingBatch() }
  ```
  `testRunId` is omitted. All simulated readings are saved with `test_run_id = null`. When viewing `TestRunsPage.tsx`, active runs permanently show `telemetryCount: 0`.
- **Required Action**:
  Support `LIVE_SIM_TEST_RUN_ID` via environment variable or query Supabase for an active run:
  ```typescript
  async function resolveActiveTestRunId(deviceId: string): Promise<string | null> {
    if (process.env.LIVE_SIM_TEST_RUN_ID) return process.env.LIVE_SIM_TEST_RUN_ID
    const { data } = await supabaseAdmin
      .from('test_runs')
      .select('id')
      .eq('device_id', deviceId)
      .eq('status', 'In Progress')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data?.id ?? null
  }
  ```

---

### BE-07: Implement Flow Rate Volume Accumulation in `testRunHydrator.ts`
- **Severity**: **P2 Medium**
- **The Problem**:  
  In [`backend/src/lib/testRunHydrator.ts#L103`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/testRunHydrator.ts#L103):
  `processedVolume: row.target_volume_liters ?? 0`
  The system collects flow rates ($L/min$) from sensor `ZJ-S201C`, but never integrates them over time ($\text{Volume} = \int flow\_rate \, dt$).
- **Required Action**:
  Calculate actual processed volume from linked `sensor_readings` for the post-filtration flow meter:
  ```typescript
  const { data: flowReadings } = await supabaseAdmin
    .from('sensor_readings')
    .select('value, measured_at, sensor:sensors!inner(category, position)')
    .eq('test_run_id', row.id)
    .eq('sensor.category', 'flow_rate')
    .eq('sensor.position', 'post_filtration')
    .order('measured_at', { ascending: true })

  let calculatedVolume = 0
  if (flowReadings && flowReadings.length > 1) {
    for (let i = 1; i < flowReadings.length; i++) {
      const dtMinutes = (new Date(flowReadings[i].measured_at).getTime() - new Date(flowReadings[i-1].measured_at).getTime()) / 60000
      const avgFlowRate = ((flowReadings[i].value ?? 0) + (flowReadings[i-1].value ?? 0)) / 2
      calculatedVolume += avgFlowRate * dtMinutes
    }
  }
  ```

---

### BE-08: Ingestion Idempotency & Unique Constraint on `sensor_readings`
- **Severity**: **P2 Medium**
- **The Problem**:  
  In [`devices.routes.ts#L217`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/routes/devices.routes.ts#L217), rows are inserted with random UUIDs. If the ESP32 retries due to a Wi-Fi dropped packet or timeout, identical readings are inserted multiple times.
- **Required Action**:
  Add an `onConflict` clause on `(sensor_id, measured_at)` or create a partial index to discard duplicate retries without returning a 500 error.

---

## 4. Policy Decisions Requiring Client / Adviser Sign-Off

The following items are **policy questions**, not programming gaps. They are holding back backend completion and need formal clarification:

1. **Pump and UV-C Actuator Control Authority (`PENDING_DECISIONS.md` §2)**:
   - *Question*: Are the booster pump and UV-C actively controlled by ESP32 relays, or are they manually operated and only monitored?
   - *Backend Impact*: If controlled, backend needs remote start/stop endpoints and audit tables. If monitor-only, remote commands remain permanently out of scope.
2. **Sensor-Failure Flow Cutoff Mechanism (`PENDING_DECISIONS.md` §2, §3)**:
   - *Question*: What is the physical mechanism used to stop water flow when a sensor disconnects or reports invalid data?
   - *Backend/Firmware Impact*: If relay-controlled, firmware cuts power to the pump relay immediately. If manual, firmware can only sound a buzzer/alarm and log an alert.
3. **Data Retention Policy (`PENDING_DECISIONS.md` §11)**:
   - *Question*: Should the automated cleanup job ([`retentionJob.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/src/lib/retentionJob.ts)) delete telemetry older than 90 days, or should all sensor records be kept indefinitely for academic review?
   - *Default Recommendation*: Keep indefinitely for prototype defense (`retention_days = null`).
4. **SMS Provider Selection (`PENDING_DECISIONS.md` §16)**:
   - *Question*: Will a commercial SMS provider (e.g. Twilio) be funded and configured, or will the server console log provider be used for the academic demonstration?
   - *Default Recommendation*: Use the built-in server `log` provider for the defense rehearsal.

---

## 5. October 8 Feature Freeze Checklist

To ensure a bug-free rehearsal on October 8 and defense on October 10:

- [ ] **Step 1**: Document `POST /devices/:id/readings` in `docs/API_CONTRACT.md` and share endpoint format with Edgar (**BE-01**).
- [ ] **Step 2**: Add provisional thresholds to `backend/supabase/seed.sql` and run `npm run seed` (**BE-02**).
- [ ] **Step 3**: Update `toDeviceStatus` and `toSensorReadings` in `backend/src/lib/mappers.ts` (**BE-03**, **BE-04**).
- [ ] **Step 4**: Add `requireRole('Administrator', 'Researcher')` to domain mutation routes (**BE-05**).
- [ ] **Step 5**: Update `liveSimulator.ts` to attach active `testRunId` (**BE-06**).
- [ ] **Step 6**: Run full test pass:
  ```bash
  cd backend && npm run test && npm run typecheck
  ```
