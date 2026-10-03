# Feature Branch Report: Real-Time Telemetry Streaming

**Branch**: `feature/realtime-telemetry-streaming`  
**Base Branch**: `fix/backend-audit-issues`  
**Date**: October 3, 2026  
**Status**: Ready for Review / Staged  

---

## 1. Executive Summary

This feature branch delivers end-to-end, sub-second real-time streaming across the entire **IoT Embedded Water Filtration System**. Previously, frontend views required manual browser refreshes or interval polling to reflect incoming telemetry, alerts, device status changes, and test-run progression. 

With this implementation, the dashboard operates reactively:
- Telemetry ingested via `POST /devices/:id/readings` appears across charts and sensor grids in **< 10ms**.
- Alerts evaluate and pop up instantaneously upon threshold violations.
- Device heartbeats and watchdog transitions reflect immediately in the header and status badges.
- Telemetry simulation frequency was upgraded to a continuous **1 Hz (1 reading batch per second)** cadence.

---

## 2. Architecture & Design Highlights

### Why Server-Sent Events (SSE)?
Rather than introducing full-duplex WebSockets or proprietary third-party brokers (such as Pusher, Firebase, or external pub/sub services), we used standard HTTP **Server-Sent Events (SSE)** via [`GET /api/v1/realtime/stream`](docs/API_CONTRACT.md#realtime-stream-events):
- **Native Browser Support**: Uses browser-native `EventSource` with built-in automatic reconnect.
- **Unidirectional Fit**: IoT monitoring is server-to-client; control commands remain standard, idempotent REST endpoints (`POST`, `PATCH`, `PUT`).
- **Zero Third-Party Vendor Lock-in**: Satisfies the project's local-first offline requirement specified in `AGENTS.md`.
- **Low Overhead**: Lightweight streaming over existing HTTP/1.1 and HTTP/2 infrastructure.

### Multi-Tier Synchronization Model
1. **In-Memory Pub/Sub (`realtimeBus`)**: Instant sub-millisecond push dispatch for events occurring within the running Express process.
2. **Database Change Detection (`updated_at` Triggers)**: Automatic trigger-based timestamp tracking on PostgreSQL tables.
3. **Database Polling Fallback**: Periodic cursor-based synchronization ensuring that updates made outside the Express process (e.g. direct Supabase Studio edits, database migrations) are also broadcast to clients.

---

## 3. Summary of Changes by Subsystem

### A. Database Layer
- **New Migration**: `backend/supabase/migrations/20261003180000_realtime_tracking_columns.sql`
  - Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `devices`, `sensor_readings`, `alerts`, and `test_runs`.
  - Created reusable PostgreSQL trigger function `update_updated_at_column()` executing `BEFORE UPDATE` on tracked tables.
  - Added database indexes on timestamp columns (`measured_at`, `triggered_at`, `updated_at`) for fast cursor-based pagination.

### B. Backend Layer
- **In-Memory Event Bus**:
  - `backend/src/lib/realtimeBus.ts`: Singleton subclass of Node's `EventEmitter` with typed methods (`emitTelemetry`, `emitAlert`, `emitDevice`, `emitTestRun`) and high listener capacity (`setMaxListeners(200)`).
  - `backend/src/lib/realtimeBus.test.ts`: Complete unit test coverage for subscription, emission, and cleanup.
- **Authentication & EventSource Support**:
  - `backend/src/middleware/auth.ts`: Updated `extractToken` to support `?token=<JWT>` query parameters, enabling authentication via browser-native `EventSource` which cannot send custom request headers.
- **Telemetry Ingestion Hook**:
  - `backend/src/routes/devices.routes.ts`: After inserting readings into `sensor_readings`, the handler immediately broadcasts the structured `TelemetryRecord` and updated `DeviceStatus` through `realtimeBus`.
- **Alert Engine & Routes**:
  - `backend/src/lib/alertEngine.ts`: Automatically broadcasts generated alerts through `realtimeBus.emitAlert()`.
  - `backend/src/routes/alerts.routes.ts`: Emits alert status changes upon user acknowledgment or resolution (`PATCH /alerts/:id`).
- **Device Watchdog**:
  - `backend/src/lib/deviceWatchdog.ts`: Emits real-time `DeviceStatus` updates when a device transitions to `Offline` after missing heartbeats.
- **Test Runs**:
  - `backend/src/routes/testRuns.routes.ts`: Emits updated `TestRun` records when runs are started, completed, or aborted.
- **Multiplexed SSE Stream Route**:
  - `backend/src/routes/realtime.routes.ts`:
    - Sends an initial state snapshot on connection to immediately hydrate the client.
    - Forwards live events from `realtimeBus` with zero latency.
    - Implements a background cursor-based database polling fallback (`env.ssePollIntervalMs`).
    - Writes `: heartbeat\n\n` comments every 15s to keep connections alive through proxies.
    - Cleans up timers and bus listeners on socket close (`req.on('close')`).

### C. Simulation & Local Development
- **1 Hz Simulation Cadence**:
  - `backend/scripts/liveSimulator.ts`: Updated default interval from 5 seconds to 1 second (`INTERVAL_MS = 1000`).
  - Scaled random walk drift steps (`pH: 0.005`, `turbidity: 0.03`, `TDS: 0.5`, `temperature: 0.02`, `flow_rate: 0.02`) for smooth chart curves.
  - Adjusted sensor dropout probability to 0.5% per tick.
- **Documentation**:
  - `backend/docs/LOCAL_DEVELOPMENT.md`: Updated environment variable reference table to document `LIVE_SIM_INTERVAL_MS=1000`.
  - `docs/API_CONTRACT.md`: Fully documented `GET /api/v1/realtime/stream` interface, query parameter authentication, and payload schemas.

### D. Frontend Layer
- **Context & Hooks**:
  - `frontend/src/context/RealtimeContext.tsx`: Manages the global `EventSource` lifecycle, connection states (`connected`, `connecting`, `disconnected`), token expiration, exponential backoff reconnects, and event multiplexing.
  - `frontend/src/hooks/useRealtime.ts`: Exported `useRealtime()` and `useRealtimeEvent(event, callback)` hooks for clean, self-cleaning component subscriptions.
  - `frontend/src/components/layout/AppLayout.tsx`: Wrapped core application routes with `RealtimeProvider`.
- **Reactive UI Components**:
  - `frontend/src/components/layout/Header.tsx`: Displays live connection status pill (`Connected`, `Connecting`, `Disconnected`) and an unread active alert counter badge.
  - `frontend/src/components/telemetry/SensorGrid.tsx`: Sensor cards update live values and status badges without page refresh.
  - `frontend/src/components/telemetry/TelemetryChart.tsx`: Appends incoming telemetry points in a sliding window without graph flickering or chart re-instantiation.
  - `frontend/src/pages/DashboardPage.tsx`: Live summary cards, system controller state, and recent telemetry update in real time.
  - `frontend/src/pages/AlertsPage.tsx`: Prepends newly triggered alerts and updates existing cards when acknowledged or resolved.
  - `frontend/src/pages/TestRunsPage.tsx`: Live updates for elapsed duration, treated volume accumulation, and active stage status.
  - `frontend/src/pages/HistoryPage.tsx`: Real-time ingestion keeps historical telemetry datasets fresh without manual reloads.

---

## 4. Verification & Testing

| Test Suite / Check | Command | Result |
| :--- | :--- | :--- |
| **Backend TypeScript Compilation** | `npm run --prefix backend build` | **PASSED** (Exit code 0, clean output) |
| **Backend Unit & Integration Tests** | `npm run --prefix backend test` | **PASSED** (11/11 test files, 64/64 tests green) |
| **Frontend TypeScript Build** | `npm run --prefix frontend build` | **PASSED** (Vite build successful, 0 type errors) |
| **Frontend Linter** | `npx oxlint --deny-warnings` | **PASSED** (0 warnings, 0 errors) |

---

## 5. File Statistics

```text
25 files changed, 2,073 insertions(+), 239 deletions(-)
```

### Staged Files:
```text
.gitignore
backend/docs/LOCAL_DEVELOPMENT.md
backend/scripts/liveSimulator.ts
backend/src/lib/alertEngine.ts
backend/src/lib/deviceWatchdog.ts
backend/src/lib/realtimeBus.test.ts
backend/src/lib/realtimeBus.ts
backend/src/middleware/auth.ts
backend/src/routes/alerts.routes.ts
backend/src/routes/devices.routes.ts
backend/src/routes/realtime.routes.ts
backend/src/routes/testRuns.routes.ts
backend/supabase/migrations/20261003180000_realtime_tracking_columns.sql
docs/API_CONTRACT.md
frontend/src/components/layout/AppLayout.tsx
frontend/src/components/layout/Header.tsx
frontend/src/components/telemetry/SensorGrid.tsx
frontend/src/components/telemetry/TelemetryChart.tsx
frontend/src/context/RealtimeContext.tsx
frontend/src/hooks/useRealtime.ts
frontend/src/pages/AlertsPage.tsx
frontend/src/pages/DashboardPage.tsx
frontend/src/pages/HistoryPage.tsx
frontend/src/pages/TestRunsPage.tsx
frontend/src/services/apiClient.ts
```

---

## 6. Next Steps & Recommendations

1. **Commit & Push**:
   Commit the staged changes to `feature/realtime-telemetry-streaming` using conventional commit conventions (e.g., `feat(realtime): add SSE streaming, event bus, and reactive frontend components`).
2. **Pull Request**:
   Open a pull request from `feature/realtime-telemetry-streaming` against `develop` or `fix/backend-audit-issues`.
3. **Database Migration**:
   Apply migration `20261003180000_realtime_tracking_columns.sql` to staging/production Supabase environments when deploying.
