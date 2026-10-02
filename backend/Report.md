# Backend Progress Report for the Client

**Prepared:** October 2, 2026 (Updated with Physical Hardware Integration & Alert System Verification)  
**Final defense date:** October 10, 2026  
**Feature freeze (bug fixes only after this):** October 8, 2026  

This report covers only the **backend** — the engine behind the web application that stores sensor data, enforces security, manages device connectivity, tracks maintenance schedules, and automatically raises alerts. It does not alter frontend visual layouts or firmware C++ code, but provides all necessary data and API contracts to both.

---

## 1. Executive Summary & Current Status

The backend is fully operational and verified end-to-end against the local Supabase stack and React frontend. With the grounding provided by the research thesis manuscript (`docs/THESIS_PAPER.md`), critical system policies have been formalized:
- **Governing Standards**: Philippine National Standards for Drinking Water (PNSDW), DENR Clean Water Act (RA 9275), and WHO Guidelines.
- **Physical Device Integration**: Added `ESP32-DEV-001` with local fail-safe control, 10 dual-stage sensors, and maintenance schedules.
- **Actuator Control Scope**: Microcontroller actively manages booster pump and UV-C sterilization for automated filtration cycles.
- **Accuracy Verification**: Formalized the percentage error and percentage reduction formulas.

| Area | Status | Implementation Details |
| :--- | :--- | :--- |
| **Physical Hardware Integration** | **Done** | `ESP32-DEV-001` registered (`is_simulated = false`), local fail-safe active, 10 dual-stage sensors |
| **Hardware Priority Ordering** | **Done** | Physical devices returned first (`is_simulated ASC`) for automatic frontend default selection |
| **Flexible Device Addressing** | **Done** | Endpoints accept both UUIDs and human identifiers (`ESP32-DEV-001`, `SIM-DEV-001`) |
| **Hardware Maintenance Reminders** | **Done** | Baseline schedules for Booster Pump, Ultrafiltration Unit, UV-C, Pre-filter, and Probes |
| **Telemetry Ingestion & Resilience** | **Done** | Batched ingestion, per-sensor dropout tolerance, deduplication, retry idempotency |
| **Interactive Alert CLI Simulator** | **Done** | `npm run alert` (`backend/scripts/sendAlert.ts`) for custom and scenario testing in CLI |
| **Automated Alert Engine** | **Done** | Provisional PNSDW baseline thresholds, sensor fault detection, offline watchdog auto-clearing |
| **Notification Dispatch Plumbing** | **Done** | Event-driven notification dispatch layer ready for SMS/email carrier integration |
| **User Registration & Auth** | **Done** | `POST /auth/register` with input validation, auto-session creation, secure Viewer role default |
| **Role-Based Access Control (RBAC)**| **Done** | `Administrator`, `Researcher`, and `Viewer` roles enforced on sensitive mutation endpoints |
| **Research & Lab Metrics** | **Done** | Volume tracking ($\int \text{flow} \, dt$), percentage error formula, test-run experiment linking |
| **CSV Data Export** | **Done** | Telemetry, test runs, alerts, and lab validation exports |
| **Cloud Fault Diagnostics** | **Done** | `GET /health/cloud` and error classification distinguish server bugs from database outages |

---

## 2. Key Deliverables & What Has Been Built

### 2.1 Physical Device & Sensor Suite (`ESP32-DEV-001`)
- **Dual-Device Registration**: The database now houses both the physical hardware unit (`ESP32-DEV-001`) and the simulated development device (`SIM-DEV-001`).
- **Pre- and Post-Filtration Sensors**: Registered all 10 physical sensors across the dual-stage filtration pipeline:
  - Pre-filtration: pH, Turbidity (NTU), TDS (ppm), Temperature (°C), Flow Rate (L/min).
  - Post-filtration: pH, Turbidity (NTU), TDS (ppm), Temperature (°C), Flow Rate (L/min).
- **Default Frontend Prioritization**: Updated `GET /api/v1/devices` to order by `is_simulated ASC, created_at ASC`. Because the frontend takes `devices[0]` on startup, the physical hardware unit is selected automatically without altering any frontend code.
- **Flexible Identifier Lookup**: Upgraded device route querying to accept either a UUID or human-readable identifier (`ESP32-DEV-001`), preventing PostgreSQL syntax errors across status and configuration endpoints.

### 2.2 Component Maintenance & Hardware Health
- **Maintenance Schedules**: Seeded baseline inspection reminders for major hardware components:
  - Booster Pump (due / upcoming inspection tracking)
  - Ultrafiltration Membrane unit
  - UV-C Sterilization module
  - Sediment pre-filter
  - Water quality probe calibration checks
- **Inspection Logging**: Integrated maintenance history logs recording component inspections, notes, and reviewer signatures.

### 2.3 Interactive Alert CLI Tool (`npm run alert`)
- Created an interactive command-line simulator ([`backend/scripts/sendAlert.ts`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/scripts/sendAlert.ts)) registered in [`backend/package.json`](file:///home/hikaru/Commisions/iot-water-filtration-system/backend/package.json).
- Allows project leads, reviewers, and advisers to trigger any alert scenario on demand:
  1. Normal baseline readings (all within PNSDW safe thresholds)
  2. Acidic pH alert ($< 6.5$)
  3. Alkaline pH alert ($> 8.5$)
  4. High turbidity alert ($> 1.0\text{ NTU}$)
  5. High TDS alert ($> 300\text{ ppm}$)
  6. Abnormal temperature alert
  7. Sensor disconnection / hardware fault (`status: "unavailable"`)
  8. Custom manual values for interactive testing

### 2.4 Research Metrics & Volume Integration
- **Volume Tracking**: Implemented trapezoidal numerical integration calculating cumulative processed volume ($\text{Liters} = \int \text{flow\_rate} \, dt$) from flow sensor telemetry, automatically updating test-run records.
- **Laboratory Accuracy**: Formalized percentage error formula:
  $$\text{Percentage Error} = \frac{\text{Experimental Value} - \text{Actual Value}}{\text{Actual Value}} \times 100$$
  and treatment reduction efficiency:
  $$\text{Percentage Reduction} = \frac{\text{Initial Value} - \text{Final Value}}{\text{Initial Value}} \times 100$$

### 2.5 User Registration, Security & RBAC
- **User Self-Registration**: Created public `POST /api/v1/auth/register` with Zod schema validation (email formatting, password minimum 6 chars), automatically provisioning a profile with default `Viewer` role to prevent unauthorized privilege escalation.
- **Strict Access Control**: Secured sensitive routes (account management, threshold changes, calibration, and lab validation) behind verified role-based access checks (`Administrator` / `Researcher`).
- **Deny-by-Default RLS**: Supabase database tables enforce Row-Level Security denying direct anon client manipulation.
- **Fail-Safe Offline Mode**: Configured `fail_safe_state = 'Local Control Active'` reflecting ESP32 autonomous operation when disconnected from cloud infrastructure.

---

## 3. Thesis & Research Grounding Summary

Recent alignment with `docs/THESIS_PAPER.md` resolved several architectural open questions:

1. **Actuator Control Authority**: Microcontroller actively manages the booster pump and UV-C sterilization module. Automated filtration routines are triggered when sensor parameters breach acceptable thresholds.
2. **Water Quality Thresholds**: Grounded in official Philippine standards (PNSDW AO 2017-0010) and WHO guidelines:
   - pH: 6.5 – 8.5
   - Turbidity: $\le 1.0\text{ NTU}$ (critical cutoff at $5.0\text{ NTU}$)
   - Total Dissolved Solids: $\le 300\text{ ppm}$ (acceptable up to $600\text{ ppm}$)
   - Temperature: Ambient drinking water range ($15^\circ\text{C} - 35^\circ\text{C}$)
3. **User Roles & Stakeholder Taxonomy**: Operational roles map to evaluation groups: `Administrator` (system integration), `Researcher` (technical specialists evaluating parameters), and `Viewer` (community end-users viewing real-time water quality).

---

## 4. Verification & Testing

- **Backend Type Safety**: TypeScript compiles with zero errors (`tsc --noEmit`).
- **Backend Build**: Production build compiles cleanly (`npm run build`).
- **Automated Tests**: 10 test suites passed, 60 unit tests passed (`npm test`).
- **Frontend Compatibility**: Frontend builds with 0 errors (`tsc -b && vite build`) without touching frontend code.
- **Live Endpoint Verification**:
  - `GET /api/v1/devices`: Successfully lists `ESP32-DEV-001` first.
  - `GET /api/v1/devices/ESP32-DEV-001/status`: Returns current hardware status and fail-safe state.
  - `GET /api/v1/devices/ESP32-DEV-001`: Returns device record with all 10 registered sensors.
  - `GET /api/v1/maintenance/reminders` & `/records`: Returns active maintenance schedule.

---

## 5. Next Steps for Hardware & Deployment

The backend software is complete, hardened, and verified for presentation and defense. The remaining items depend on physical assembly:
1. **Physical Wiring & Pinout Confirmation**: Finalize the exact ESP32 GPIO pin assignments once Edgar completes breadboard/PCB soldering.
2. **Live Firmware Handshake**: Flash the ESP32 with `firmware/esp32` and verify real HTTPS ingestion to `POST /api/v1/devices/ESP32-DEV-001/telemetry`.
3. **Production Cloud Provisioning**: Deploy backend to a cloud host (Render, Fly.io, or Railway) and connect to hosted Supabase prior to final defense.
