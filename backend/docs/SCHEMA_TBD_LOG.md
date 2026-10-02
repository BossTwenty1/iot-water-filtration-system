# Schema & Architecture TBD Log

> **Companion document to Supabase migrations and database architecture.**  
> **Source Documents**: [`docs/THESIS_PAPER.md`](../../docs/THESIS_PAPER.md), [`docs/PENDING_DECISIONS.md`](../../docs/PENDING_DECISIONS.md), [`backend/docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md).  
> **Last Updated**: October 2, 2026  

---

## 1. Overview and Purpose

When the database schema was initially drafted and migrated (`20260916110448_initial_schema.sql` and `20260916120000_app_support_tables.sql`), several business rules, alert thresholds, actuator permissions, and calculation formulas were undecided. To avoid guessing or hardcoding unverified business logic into database constraints, columns were implemented as flexible types (`text`, `jsonb`, nullable values) and tracked in this log.

With the release of the formal thesis manuscript ([`docs/THESIS_PAPER.md`](../../docs/THESIS_PAPER.md), October 2026) and recent backend remediations, several core architectural questions and scientific formulas have been officially confirmed. This document logs the resolutions from the thesis paper and details the remaining open hardware items.

---

## 2. Key Resolutions Established by `docs/THESIS_PAPER.md`

### 2.1 Laboratory Validation & Sensor Accuracy Formulas (§12)
- **Percentage Error Formula**: **Confirmed** in `THESIS_PAPER.md` §768 (lines 1292–1301):
  $$\text{Percentage Error} = \frac{\text{Experimental Value} - \text{Actual Value}}{\text{Actual Value}} \times 100$$
  - `Experimental Value`: Prototype embedded sensor reading (`sensorReading`).
  - `Actual Value`: Authoritative laboratory test result (`referenceResult`).
  - Measures the accuracy and calibration deviation of prototype sensors against laboratory standards.
- **Percentage Reduction Formula**: **Confirmed** in `THESIS_PAPER.md` §768 (lines 1280–1288):
  $$\text{Percentage Reduction} = \frac{\text{Initial Value} - \text{Final Value}}{\text{Initial Value}} \times 100$$
  - Measures water quality improvement and treatment efficiency before and after filtration (particularly for turbidity).

### 2.2 Actuator Control Authority & Automation (§2, tracker `P0-05`)
- **Control Authority**: **Confirmed** in `THESIS_PAPER.md` (§427–429, 661–663, 670, 697–703, 715–716, 786–792, 843):
  - The booster pump and UV-C sterilization unit are **active actuators controlled by the ESP32 microcontroller**, not monitor-only.
  - The microcontroller serves as the central control unit, operating the pumps, controlling UV-C sterilization exposure time, and executing preprogrammed filtration sequences.
  - Automation logic: When sensor readings detect unacceptable water quality (or turbidity/pH levels exceed allowable limits), the system automatically initiates filtration and UV-C sterilization, and dispatches alerts/notifications.

### 2.3 Governing Water Quality Standards (§4)
- **Governing Standards**: **Confirmed** in `THESIS_PAPER.md` (§711–713, 822–823, 1141–1143, 1329–1330):
  1. **Philippine National Standards for Drinking Water (PNSDW)** (DOH AO 2017-0010)
  2. **Department of Environment and Natural Resources (DENR) Clean Water Act** (Republic Act 9275)
  3. **World Health Organization (WHO) Drinking Water Guidelines**
- **Sensor Parameters**: Strictly defined as **pH, Turbidity, Total Dissolved Solids (TDS), Temperature, and Flow Rate** (pre-filtration and post-filtration).
- **Potability Boundary**: Real-time sensors monitor physicochemical stability, while **potability certification requires comparative laboratory testing** against PNSDW/DENR/WHO standards.

### 2.4 Power Consumption Modeling (§13)
- **Power Formula**: **Confirmed** in `THESIS_PAPER.md` §768 (lines 1318–1326):
  $$P = IV$$
  - $P$: Power consumption (watts)
  - $V$: Operating voltage (volts)
  - $I$: Current draw (amperes)
  - Prototype energy efficiency is evaluated using this direct electrical relationship.

### 2.5 Filtration Cycle & Volumetric Demand (§5)
- **Water Demand & Volumetric Target**: `THESIS_PAPER.md` (§651–655) establishes that the system scale and filtration capacity are justified by a **Water Demand Calculation** and **specific volumetric targets** based on institutional human consumption standards at Bicol University College of Industrial Technology (BUCIT).
- **Flow Sensor Role**: Tracks instantaneous flow rate ($L/min$) and total accumulated volume ($L$).

### 2.6 User Roles & Evaluation Framework (§9)
- **Stakeholder Taxonomy**: `THESIS_PAPER.md` (§725–747, 1157–1173) identifies two distinct evaluation groups:
  1. **Technical Specialists (5 evaluators)**: Water Treatment Engineer, Software Engineer, Sanitary Engineer, BU RFQSC Food Safety Specialist, Electronic Research Expert (evaluating Functionality, Reliability, Safety).
  2. **Community End-Users (BUCIT random sample)**: Students, Faculty, Administrative Personnel, Laboratory Technicians (evaluating Usability and Safety).
- **5-Point Likert Scale**: Weighted Mean $\frac{\Sigma (f \cdot x)}{\Sigma f}$ with ranges:
  - 4.21–5.00: Strongly Acceptable
  - 3.41–4.20: Acceptable
  - 2.61–3.40: Moderate Acceptable
  - 1.81–2.60: Unacceptable
  - 1.00–1.80: Strongly Unacceptable
- **Application Roles**: Maps directly to system roles:
  - `Administrator`: Full access (system settings, user management, device provisioning).
  - `Researcher`: Access to test runs, calibration records, threshold configuration, laboratory validation.
  - `Viewer`: Read-only access to real-time water quality monitoring data.

---

## 3. Database Column TBD Status Matrix

| Table | Column | Original Schema Type | Status | Resolution from Thesis / Implementation |
|---|---|---|---|---|
| `sensors` | `category` | `text` | **Resolved** | Confirmed set: `'ph'`, `'turbidity'`, `'tds'`, `'temperature'`, `'flow_rate'` (`REQUIREMENTS.md`, `THESIS_PAPER.md` §628). |
| `sensors` | `position` | `text` | **Resolved** | Confirmed set: `'pre_filtration'`, `'post_filtration'`. |
| `sensor_readings` | `reading_status` | `text` | **Partially Resolved** | Application enforces `'valid'`, `'invalid'`, `'unavailable'`, `'stale'`. Physical electrical fault thresholds (ADC disconnect/short) remain TBD in firmware. |
| `test_runs` | `status` | `text` | **Resolved** | Application enforces `'Running'`, `'Completed'`, `'Aborted'`. Volume target completion calculated via trapezoidal flow integration. |
| `test_runs` | `target_volume_liters` | `numeric` | **Resolved** | Grounded in the Water Demand Calculation and volumetric target from `THESIS_PAPER.md` §651–655. |
| `alerts` | `category` | `text` | **Resolved** | Categories reflect PNSDW parameter breaches (`Water Quality`), system notifications (`Hardware / Actuator`), and watchdog status (`Offline`). |
| `alerts` | `severity` | `text` | **Resolved** | Application standardizes on `'Info'`, `'Warning'`, `'Critical'`. |
| `alerts` | `status` | `text` | **Resolved** | Application standardizes on `'Open'`, `'Acknowledged'`, `'Resolved'`. |
| `calibration_records` | `parameters` | `jsonb` | **Resolved** | Structured as `{ model, referenceValue, sensorReading, status }`. Calibration against standard laboratory solutions (`THESIS_PAPER.md` §752). |
| `laboratory_validation_records` | `results` | `jsonb` | **Resolved** | Structured as `{ stage, parameter, referenceResult, sensorReading, unit, conclusion, notes }`. |
| `laboratory_validation_records` | `percentage_error` | `numeric` | **Resolved** | **Confirmed formula**: $\frac{\text{Experimental} - \text{Actual}}{\text{Actual}} \times 100$ (`THESIS_PAPER.md` §768). |
| `profiles` | `role` | `text` | **Resolved** | Enforced as `'Administrator'`, `'Researcher'`, `'Viewer'` based on the thesis stakeholder taxonomy. |
| `thresholds` | `config` | `jsonb` | **Resolved** | Seeded with baseline Philippine National Standards for Drinking Water (PNSDW 2017) values (pH 6.5–8.5, turbidity ≤ 1 NTU, TDS ≤ 300 ppm, temp 15–35°C). |
| `notification_providers` | `provider_type` | `text` | **Pending** | Provider-neutral registry implemented (`notificationService.ts`). Third-party SMS carrier selection remains open. |

---

## 4. Architectural & Operational Status

| Architectural Item | Original Status | Current Status | Resolution Context |
|---|---|---|---|
| **Actuator Control Authority** | Blocked / TBD | **Resolved** | `THESIS_PAPER.md` confirms ESP32 actively operates pumps and UV-C sterilization for automated filtration. |
| **Row-Level Security (RLS)** | Unaddressed | **Implemented** | `20260919090000_enable_rls.sql` enables RLS deny-by-default on all 15 public tables. |
| **Role-Based Access Control** | Partial | **Implemented** | `requireRole('Administrator', 'Researcher')` protects domain mutation routes; Admin gates user accounts. |
| **Ingestion Deduplication** | Unaddressed | **Implemented** | Unique constraint on `(sensor_id, measured_at)` and duplicate retry handling in `POST /devices/:id/readings`. |
| **Water Volume Integration** | Placeholder | **Implemented** | Trapezoidal numerical integration ($\int Q \, dt$) over post-filtration flow sensor readings calculates actual liters processed. |
| **Data Retention Policy** | Open | **Implemented** | `retentionJob.ts` executes automated purging when `retention_days` is configured. |
| **Realtime Telemetry Stream** | Polling | **Implemented** | Server-Sent Events (SSE) active at `/telemetry/stream` and `/realtime/stream`. |

---

## 5. What Remains Genuinely Open (Hardware Implementation)

The following items are physical hardware engineering choices that remain pending assembly and empirical verification by the hardware team (Edgar):

1. **Exact Turbidity Sensor Model**: Specific sensor module part number (e.g. TS-300B vs analog optical turbidity sensor).
2. **Booster Pump Electrical Ratings**: Exact operating voltage (12V vs 24V DC) and full-load current draw.
3. **UV-C Electrical Specifications**: UV-C lamp electrical wattage, ballast input voltage, and required germicidal exposure duration.
4. **Relay Module Specifications**: Relay coil voltage, optoisolator ratings, and contact configuration (Normally Open vs Normally Closed fail-safe wiring).
5. **ESP32 GPIO Pin Map**: Final GPIO pin assignments after breadboard prototyping and PCB soldering.
6. **Hardware-Level Sensor Failure Detection**: Firmware ADC out-of-bound electrical thresholds for detecting disconnected probes or short circuits.
7. **SMS Gateway Provider**: Selection and credential provisioning for external SMS dispatch (e.g. Twilio vs Semaphore).
