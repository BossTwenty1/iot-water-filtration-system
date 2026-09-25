# API Routes Draft

> **Status: unapproved draft, not implementation.** This document proposes
> Express route groupings for team review only. It does not resolve any item
> in [PENDING_DECISIONS.md](PENDING_DECISIONS.md) or
> [API_CONTRACT.md](API_CONTRACT.md). No route is implemented yet. Do not
> treat any path, verb, or field name below as final until the team approves
> it.

## Purpose

[API_CONTRACT.md](API_CONTRACT.md) lists candidate interface areas but marks
all of them, plus auth, versioning, and error format, as `TBD`. This draft
turns those candidate areas into concrete route shapes — mapped to the tables
in [DATABASE_SCHEMA_DRAFT.md](DATABASE_SCHEMA_DRAFT.md) — so the team has
something specific to react to. Every route below is a proposal, not a
commitment.

Base path shown as `/api/v1/...` as a placeholder convention only —
versioning policy is `TBD` (PENDING_DECISIONS §8).

---

## 1. Health / status

Satisfies API_CONTRACT.md candidate area "Health/status."

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/health` | Liveness check — API process is up. Does **not** report device online/offline status (that logic is `TBD`, PENDING_DECISIONS §6). |

No auth required — this is the one route that shouldn't depend on any TBD
decision.

---

## 2. Devices

Not an explicit API_CONTRACT.md row, but needed to support "Device readings"
and reference `devices` in the schema draft.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/devices` | List known devices |
| GET | `/api/v1/devices/:id` | Get one device |
| POST | `/api/v1/devices` | Register a device — device authentication/provisioning mechanism is `TBD` (PENDING_DECISIONS §8), so this route's auth is a placeholder only |

---

## 3. Device readings

Satisfies API_CONTRACT.md candidate area "Device readings."

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/readings` | Device (or simulator) submits one or more sensor readings. Batch size, retry/idempotency rules are `TBD` (PENDING_DECISIONS §7, §8). Must mark `is_simulated` at the device level, never inferred per-request. |
| GET | `/api/v1/readings` | Query readings; filters: `device_id`, `sensor_category`, `position`, `test_run_id`, date range |
| GET | `/api/v1/devices/:id/readings` | Readings scoped to one device |

Per API_CONTRACT.md's data contract principles, the response must
distinguish an unavailable value (`value: null`) from a measured one, and a
stale/invalid reading from a valid one (`reading_status`) — exact validation
rule is `TBD` (PENDING_DECISIONS §3).

---

## 4. Test runs

Satisfies API_CONTRACT.md candidate area "Test runs."

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/test-runs` | Start a test run |
| GET | `/api/v1/test-runs` | List test runs |
| GET | `/api/v1/test-runs/:id` | Get one test run, with its readings |
| PATCH | `/api/v1/test-runs/:id` | Update status / mark ended — cycle-completion logic (1 L target vs. 1-hour timeout) is `TBD` (PENDING_DECISIONS §5) |

---

## 5. Alerts

Satisfies API_CONTRACT.md candidate area "Alerts."

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/alerts` | List alerts; filters: `status`, `device_id`, `severity` |
| GET | `/api/v1/alerts/:id` | Get one alert with its `alert_state_changes` history |
| PATCH | `/api/v1/alerts/:id/acknowledge` | Acknowledge an alert |

No `POST /alerts` — alerts are assumed system-generated from readings against
thresholds, not client-created. **This assumption itself is `TBD`:** whether
alert-triggering logic lives on the ESP32, the backend, or both is unresolved
(PENDING_DECISIONS §2, §4). Who may acknowledge an alert is also `TBD`
(PENDING_DECISIONS §9).

---

## 6. Calibration

Satisfies API_CONTRACT.md candidate area "Calibration."

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/calibrations` | Record a calibration event for a sensor |
| GET | `/api/v1/calibrations` | List calibration records; filter by `sensor_id` |
| GET | `/api/v1/sensors/:id/calibrations` | Calibration history for one sensor |

Calibration formulas/factors and who may perform calibration are `TBD`
(PENDING_DECISIONS §9, §12).

---

## 7. Laboratory validation

Satisfies API_CONTRACT.md candidate area "Laboratory validation."

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/lab-validations` | Record an externally produced validation result |
| GET | `/api/v1/lab-validations` | List; filter by `test_run_id` |

Required fields and percentage-error formula are `TBD` (PENDING_DECISIONS
§12). Response payloads from this route must never be phrased as proof that
water is safe to drink, per REQUIREMENTS.md.

---

## 8. CSV export

Satisfies API_CONTRACT.md candidate area "CSV export."

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/export/csv` | Export approved historical records as CSV; query params TBD |

Which record types are exportable and CSV column order are both `TBD`
(PENDING_DECISIONS §12).

---

## Cross-cutting concerns (all `TBD` — not decided by this draft)

- **Auth/authorization** — device auth mechanism, user roles, who may call
  write/acknowledge routes (PENDING_DECISIONS §8, §9)
- **Versioning policy** — whether `/api/v1` is the right convention long-term
- **Rate limiting** — none proposed here
- **Error format** — no standard error shape proposed yet
- **Idempotency / retry** — relevant to `POST /readings` particularly
- **Realtime updates** — whether the dashboard polls these GET routes or uses
  Supabase Realtime instead is `TBD` (PENDING_DECISIONS §17)

## Next steps

1. Team review (Alejandro, Nash, Edgar) of route shapes against
   `DATABASE_SCHEMA_DRAFT.md` and the frontend's expected data needs.
2. Resolve auth/versioning/error-format decisions before writing real route
   handlers.
3. Implement only the routes the team confirms, against the approved schema.
4. Update `API_CONTRACT.md` and `PENDING_DECISIONS.md` as decisions land.
