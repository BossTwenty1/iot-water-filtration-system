
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

- is the booster pump controlled by ESP32? — `TBD`
- is UV-C controlled by ESP32? — `TBD`
- are either only monitored? — `TBD`
- meaning of client phrase "automatic sensor control" — `TBD`
- physical mechanism used to stop water flow — `TBD`
- sensor-failure shutdown sequence — `TBD`
- power-up default states — `TBD`
- fail-safe relay states — `TBD`
- remote-control permission for pump — `TBD`
- remote-control permission for UV-C — `TBD`

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

- approved pH range — `TBD`
- approved turbidity limit — `TBD`
- approved TDS limit — `TBD`
- approved temperature range — `TBD`
- approved flow requirement — `TBD`

Thresholds must come from the approved research/adviser methodology.

---

## 5. Filtration Cycle

Client/adviser inputs currently mention:

- one-liter processing concept,
- maximum one-hour cycle.

Final logic remains unresolved:

- is 1 L the normal cycle-completion target? — `TBD`
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

- final user roles — resolved: Super Administrator, Administrator, Researcher, Viewer; see [RBAC](RBAC.md).
- administrator permissions — resolved for approved software actions; see [RBAC](RBAC.md).
- normal user permissions — resolved: Viewer read-only, Researcher permitted record writes/export.
- who may operate remote controls — `TBD`
- who may edit laboratory records — Researcher and above; final scientific approval/workflow remains `TBD`.
- who may edit approved application settings — Administrator and above. Threshold/hardware configuration remains `TBD` and denied to all roles.

---

## 10. Remote Commands

- command delivery method — `TBD`
- command expiration — `TBD`
- acknowledgment method — `TBD`
- rejection/error behavior — `TBD`
- audit-history requirements — `TBD`

---

## 11. Database

- final schema — `TBD`
- migration tool/workflow — `TBD`
- retention policy — `TBD`
- backup strategy — `TBD`
- Row-Level Security policy — `TBD`
- production-data deletion rules — `TBD`

---

## 12. Research Workflow

- final test-run required fields — `TBD`
- calibration workflow — `TBD`
- calibration formulas/factors — `TBD`
- laboratory-validation workflow — `TBD`
- laboratory result fields — `TBD`
- percentage-error formula confirmation — `TBD`
- CSV column order — `TBD`

---

## 13. Power Consumption

The client requested power-consumption records.

Unresolved:

- measurement device/source — `TBD`
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

## Temperature integration test boundary

The first temperature path reuses the existing deployed UUID-scoped `/readings`
route and shared `X-Device-Key` mechanism; final provisioning/security remain TBD.
Edgar reports GPIO26/DS18B20 working on the PR #5 harness. This evidence does not
resolve the final GPIO map, filtration-stage assignment or second sensor group.

Still required before transmission: existing real-device UUID and MAC match,
probe ROM and physical filtration stage, matching temperature sensor registry row,
private device key, approved HTTPS origin/verified CA and explicit local opt-in.
No registry writes or hardware test have been performed by this preparation.

750 ms is the DS18B20 conversion guard. The 30-second send interval is a provisional
first-test setting, not resolution of final sampling/persistence/retry policy.
Faults remain null; exactly 85 C is conservatively withheld in this test, and
parasite power is unsupported. No research water-quality thresholds are added.
