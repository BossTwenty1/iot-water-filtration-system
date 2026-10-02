
# Pending Decisions

This document is the official register of unresolved project decisions.

Do not replace `TBD` items with assumptions.

When a decision is approved:

1. record the confirmed decision,
2. update the relevant documentation,
3. remove/update the item here,
4. then implement it.

---

## 1. Hardware

- exact turbidity sensor model — `TBD`
- final physical sensor housing/mounting — `TBD`
- booster pump model — `TBD`
- booster pump voltage/current — `TBD`
- exact UV-C electrical specifications — `TBD`
- exact relay module specifications — `TBD`
- power supply design — `TBD`
- LCD model/interface — `TBD`
- final wiring diagram — `TBD`
- final ESP32 GPIO map — `TBD`

---

## 2. Hardware Control

- is the booster pump controlled by ESP32? — **Confirmed** in `docs/THESIS_PAPER.md` (§427–429, 697–703): Yes, the microcontroller actively operates the water pumps.
- is UV-C controlled by ESP32? — **Confirmed** in `docs/THESIS_PAPER.md` (§661–663, 670): Yes, the microcontroller coordinates UV-C sterilization and exposure time.
- are either only monitored? — **Confirmed**: No, both are active actuators under microcontroller control.
- meaning of client phrase "automatic sensor control" — **Confirmed** in `docs/THESIS_PAPER.md` (§715–716, 786–792): Closed-loop control where unacceptable water quality parameters automatically engage filtration and UV-C sterilization.
- physical mechanism used to stop water flow — `TBD` (relay switching pump power)
- sensor-failure shutdown sequence — `TBD`
- power-up default states — `TBD`
- fail-safe relay states — `TBD` (NO vs NC wiring contacts)
- remote-control permission for pump — `TBD` (Administrator/Researcher role)
- remote-control permission for UV-C — `TBD` (Administrator/Researcher role)

---

## 3. Sensor Failure Detection

- what constitutes pH sensor failure? — `TBD`
- turbidity sensor failure rule — `TBD`
- TDS sensor failure rule — `TBD`
- temperature sensor failure rule — `TBD`
- flow sensor failure/no-flow timeout — `TBD`
- which failures require immediate shutdown — `TBD`

---

## 4. Water-Quality Thresholds

Governing standards **confirmed** in `docs/THESIS_PAPER.md` (§711–713, 822–823):
Philippine National Standards for Drinking Water (PNSDW), DENR Clean Water Act (RA 9275),
and WHO Drinking Water Guidelines.

- approved pH range — Governed by PNSDW/WHO (baseline provisional: 6.5–8.5)
- approved turbidity limit — Governed by PNSDW/WHO (baseline provisional: ≤ 1.0 NTU)
- approved TDS limit — Governed by PNSDW/WHO (baseline provisional: ≤ 300 ppm)
- approved temperature range — Governed by PNSDW/WHO (baseline provisional: 15–35°C)
- approved flow requirement — `TBD` (measured via flow sensor in L/min)

---

## 5. Filtration Cycle

`docs/THESIS_PAPER.md` (§651–655) clarifies that system capacity and volumetric targets
are governed by a **Water Demand Calculation** and realistic consumption standards for BUCIT.
Total processed volume is dynamically integrated via post-filtration flow sensor readings.

- is 1 L the normal cycle-completion target? — Grounded in Water Demand Calculation / volumetric target
- does reaching 1 L immediately stop the cycle? — `TBD`
- does one hour act only as a safety timeout? — `TBD`
- pump behavior when cycle ends — `TBD`
- UV-C behavior when cycle ends — `TBD`

---

## 6. Timing

- sensor sampling interval — `TBD`
- telemetry transmission interval — `TBD`
- database persistence interval — `TBD`
- dashboard refresh interval — `TBD`
- offline-device timeout — `TBD`

Client selected approximately 30 seconds as an initial recording target, but
also marked timing as subject to testing.

---

## 7. Offline Data

- whether ESP32 buffers readings — `TBD`
- maximum offline queue size — `TBD`
- local storage method — `TBD`
- retry policy — `TBD`
- duplicate/idempotency handling — `TBD`

Critical local control does not depend on these decisions.

---

## 8. API and Device Security

- device authentication mechanism — `TBD`
- device credential provisioning — `TBD`
- API versioning policy — `TBD`
- rate limits — `TBD`
- idempotency strategy — `TBD`
- standard error codes — `TBD`

---

## 9. Users and Authorization

Grounded in `docs/THESIS_PAPER.md` (§725–747) stakeholder and evaluation taxonomy
(5 Technical Specialists and BUCIT community end-users):

- final user roles — `Administrator`, `Researcher`, `Viewer`
- administrator permissions — Full access (accounts, devices, settings, calibration, validation)
- normal user permissions — `Viewer`: read-only access to real-time water quality monitoring
- who may operate remote controls — `Administrator` / `Researcher`
- who may edit laboratory results — `Administrator` / `Researcher`
- who may edit thresholds/configuration — `Administrator` / `Researcher`

---

## 10. Remote Commands

- command delivery method — `TBD`
- command expiration — `TBD`
- acknowledgment method — `TBD`
- rejection/error behavior — `TBD`
- audit-history requirements — `TBD`

---

## 11. Database

- final schema — 15 public tables implemented via Supabase migrations
- migration tool/workflow — Supabase CLI (`supabase/migrations/`)
- retention policy — Automated purge job (`retentionJob.ts`) active; retention period configurable
- backup strategy — `TBD` (hosted Supabase automatic backups vs local pg_dump)
- Row-Level Security policy — Deny-by-default active on all 15 tables (`20260919090000_enable_rls.sql`)
- production-data deletion rules — `TBD`

---

## 12. Research Workflow

- final test-run required fields — `{ id, deviceId, status, startedAt, endedAt, targetVolumeLiters, notes }`
- calibration workflow — Laboratory calibration against standard solutions (`docs/THESIS_PAPER.md` §752)
- calibration formulas/factors — `TBD` (specific curve parameters per physical probe)
- laboratory-validation workflow — Comparative testing before and after filtration against PNSDW/DENR/WHO standards (`docs/THESIS_PAPER.md` §754–756)
- laboratory result fields — `{ stage, parameter, referenceResult, sensorReading, unit, conclusion, notes }`
- percentage-error formula confirmation — **Confirmed** in `docs/THESIS_PAPER.md` §768:
  $$\text{Percentage Error} = \frac{\text{Experimental Value} - \text{Actual Value}}{\text{Actual Value}} \times 100$$
  (Also confirmed: Percentage Reduction formula for water treatment efficiency: $\frac{\text{Initial Value} - \text{Final Value}}{\text{Initial Value}} \times 100$)
- CSV column order — Confirmed standard export schemas in `backend/docs/API_REFERENCE.md`

---

## 13. Power Consumption

Calculation formula **confirmed** in `docs/THESIS_PAPER.md` §768 (lines 1318–1326):
$$P = IV \quad (\text{Watts} = \text{Current} \times \text{Voltage})$$

Hardware instrumentation unresolved:

- measurement device/source — `TBD` (bench multimeter during testing vs onboard power monitor)
- voltage source — `TBD`
- current source — `TBD`
- sampling method — `TBD`
- whether values are manual or automatic — `TBD`

---

## 14. Fault Detection

Client requested warnings for pump, UV-C, and filter clogging.

Detection method remains unresolved:

- pump-fault detection — `TBD`
- UV-C fault detection — `TBD`
- filter-clog detection — `TBD`

Do not claim the software can detect a fault unless hardware provides evidence
that allows detection.

---

## 15. Maintenance

- filter replacement interval — `TBD`
- UV-C service interval — `TBD`
- reminder logic — `TBD`
- UV-C runtime-tracking method — `TBD`

---

## 16. Notifications

- SMS provider — `TBD`
- SMS recipients — `TBD`
- which alerts produce SMS — `TBD`
- retry/rate-limit behavior — `TBD`

SMS is not part of the critical hardware safety loop.

---

## 17. Realtime Web Updates

- API polling vs Supabase Realtime — `TBD`
- stale-data timeout — `TBD`
- UI offline behavior details — `TBD`

---

## 18. Local-Network Website Access

The client requested both public internet and local-network website access.

Unresolved:

- local deployment method — `TBD`
- behavior when public internet is unavailable — `TBD`
- whether local dashboard operation is required without cloud database access
  — `TBD`

---

## Decision Rule

Until a decision is formally confirmed, software and documentation must use
neutral placeholders and must not imply a final:

- component,
- electrical design,
- threshold,
- GPIO,
- formula,
- control rule,
- timing value,
- research result,
- safety conclusion.