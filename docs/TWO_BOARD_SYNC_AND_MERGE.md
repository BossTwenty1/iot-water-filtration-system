# Two-board sync and before/after merge — proposal

Status: **Fix 2 backend implemented** on `fix/backend-telemetry-pairing`
(migration, pairing mapper, API fields, `pair:devices` script, simulator
aligned mode). Fix 1 (firmware) and the Fix 2 frontend changes are **not
implemented**. Values marked `TBD` are open decisions; the backend uses
provisional defaults for them.

## Problem

The installation uses two independent ESP32 boards:

| Board | Position | Uploads to |
| --- | --- | --- |
| ESP32 DevKit V1 | `pre_filtration` | `POST /api/v1/devices/<pre-uuid>/readings` |
| ESP32-S3 | `post_filtration` | `POST /api/v1/devices/<post-uuid>/readings` |

Each board uploads its latest snapshot every 60 s (`kTelemetryIntervalMs`),
counted from when **that board's** telemetry task started
(`firmware/esp32/telemetry.h`, `telemetryTask`). The boards do not communicate
with each other; the only thing they share is UTC time from SNTP.

The backend builds history rows in `groupReadingsIntoTelemetry`
(`backend/src/lib/mappers.ts:223`) with this key:

```ts
const key = `${row.device_id}|${row.test_run_id ?? ''}|${row.measured_at}`
```

Because the key contains `device_id` and the exact `measured_at`, a
pre-filtration reading and a post-filtration reading can never land in the
same row. The Sensor history table therefore shows alternating half-empty
rows, for example:

| Time recorded | Device | Before / after pH |
| --- | --- | --- |
| 11:37:24 | Device 0006 | 6.74 / — |
| 11:37:22 | Device 0007 | — / 7.06 |
| 11:37:09 | Device 0006 | 6.72 / — |

The two boards also drift apart over time (reboots, Wi-Fi drops, menu pauses
that skip an upload), so a display-only fix cannot reliably pair them.

The fix has two parts: align **when** both boards measure (Fix 1), and
**merge** the two boards' readings into one row (Fix 2).

---

## Fix 1 — Align board uploads to UTC time slots (firmware)

### Idea

Both boards already have a synced UTC clock (it is required for HTTPS). Instead
of uploading 60 s after their own boot, both boards upload on the **same UTC
slot boundary** (for example every whole minute) and send that slot as
`measuredAt`. Identical timestamps then come from both boards without any
board-to-board link.

### Change in `firmware/esp32/telemetry.h` (`telemetryTask`)

Replace the boot-relative interval check:

```cpp
if (millis() - lastAttemptMs < config::kTelemetryIntervalMs) continue;
```

with a slot check:

```cpp
static time_t lastSlot = 0;
const time_t intervalS = config::kTelemetryIntervalMs / 1000;
const time_t now = time(nullptr);
const time_t slot = now - (now % intervalS);   // e.g. 11:37:00Z
if (slot == lastSlot) continue;

// existing freshness check stays: the sensor loop runs every 1 s,
// so the snapshot is <= ~1 s old at the slot boundary
if (!snap.hasData || ageMs > config::kTelemetryMaxAgeMs) continue;

lastSlot = slot;
time_t measuredAt = slot;                      // both boards send the same value
```

### Behaviour

- No board-to-board link (no ESP-NOW/UART). SNTP is the shared reference.
- Critical local control is unaffected: only the upload schedule changes, and
  sensors and control keep running without the cloud.
- A board that is offline, unsynced, or has the menu open simply misses that
  slot. The merged row then shows `—` for that side, which keeps gaps visible.
- No retry or offline queue is added; that policy remains `TBD`
  (`docs/HARDWARE_INTEGRATION.md`).
- Both boards hit the backend in the same second each slot. That is negligible
  at this volume; a small fixed per-board upload delay can be added if needed,
  as long as `measuredAt` stays the slot value.

### Accuracy limits

- SNTP accuracy is in the milliseconds, and snapshot age at the boundary is
  ≤ ~1 s, so `measuredAt = slot` is accurate to about 1 s.
- An identical timestamp means **sampled at the same moment**, not **the same
  water**. Water takes time to travel from the pre sensor to the post sensor;
  whether to apply a transit offset, and how large, is `TBD`.

### Simulator

`backend/scripts/esp32BoardSimulator.ts` should get the same slot alignment
(behind a flag such as `ESP32_SIM_ALIGNED=1`) so Fix 2 can be tested before
the real boards are reflashed.

---

## Fix 2 — Merge before/after readings into one row (backend + frontend)

### 2a. Record which boards form a pair (database)

Add an installation/pair concept so the backend knows which pre board belongs
with which post board:

```sql
alter table public.devices add column installation_id uuid;
-- both boards of one filtration unit get the same installation_id
```

- New migration in `backend/supabase/migrations/`.
- Update `docs/DATABASE.md`.
- Devices with no `installation_id` keep today's per-device rows.

### 2b. Change the grouping key (`backend/src/lib/mappers.ts`)

```ts
// before
const key = `${row.device_id}|${row.test_run_id ?? ''}|${row.measured_at}`
// after
const key = `${installationId ?? row.device_id}|${row.test_run_id ?? ''}|${row.measured_at}`
```

- **Slot-aligned data (after Fix 1):** both boards share `measured_at`, so they
  merge on an exact match.
- **Legacy, unaligned data:** match each before cycle to the **nearest** after
  cycle from the same installation within a tolerance (proposed ±30 s, `TBD`).
  Each cycle is used at most once. Unmatched cycles stay as half rows.
- Never carry an older value forward to fill a gap.
- The `GET /telemetry?stage=…` query must load the paired device's readings
  for the same time range before grouping.

### 2c. Keep provenance on each merged row (API)

Extend `TelemetryRecord`:

```ts
interface TelemetryRecord {
  id: string
  timestamp: string            // slot / matched time
  installationId: string | null
  beforeDeviceId: string | null
  afterDeviceId: string | null
  beforeMeasuredAt: string | null
  afterMeasuredAt: string | null
  pairing: 'exact' | 'nearest' | 'unpaired'
  testRunId: string | null
  before: Partial<Record<Parameter, number>>
  after: Partial<Record<Parameter, number>>
}
```

Update `docs/API_CONTRACT.md` and `backend/docs/API_REFERENCE.md`.

### 2d. Frontend (History and Dashboard)

- One row per slot: `Before / After` values side by side, with both device
  labels (e.g. `Device 0006 → Device 0007`).
- Show a time-gap note when `pairing === 'nearest'` (e.g. "after +13 s").
- Keep `—` for a missing side.
- CSV export keeps both device UUIDs and both original timestamps.

### Expected result

| Time recorded | Devices | Before / after pH | Pairing |
| --- | --- | --- | --- |
| 11:38:00 | 0006 → 0007 | 6.74 / 7.06 | exact |
| 11:37:00 | 0006 → 0007 | 6.72 / 7.01 | exact |
| 11:36:00 | 0006 → — | 6.70 / — | unpaired |

---

## Decisions required before implementation

| Decision | Proposal | Status |
| --- | --- | --- |
| Upload slot length | 60 s, aligned to UTC | `TBD` |
| Pre→post transit offset | none until measured | `TBD` |
| Legacy nearest-match tolerance | ±30 s | `TBD` |
| How boards are paired | `devices.installation_id` | `TBD` |
| Wording on merged rows | "time-aligned", not "matched sample" | `TBD` |

`docs/TELEMETRY_DISPLAY.md` currently states that the two boards are "not
silently merged". It must be updated with the approved decision, and merged
rows must not be presented as an experimentally matched sample or as evidence
that the water is safe to drink.

## Backend implementation notes

- Migration: `backend/supabase/migrations/20261118120000_device_installation_pairing.sql`
  adds `devices.installation_id` (nullable). No device is paired by it.
- Pairing: `groupReadingsIntoTelemetry` in `backend/src/lib/mappers.ts`; tolerance
  from `TELEMETRY_PAIR_TOLERANCE_MS` (default 30000, `0` = exact only).
- `deviceDisplayId` of a merged row is `"Device 0006 + Device 0007"`, so the
  current table already shows both boards before any frontend change.
- Pair the real boards (dry run first):
  `npm run pair:devices -- <pre-uuid> <post-uuid> --dry-run`, then `--apply`.
- Simulator: `ESP32_SIM_ALIGNED=1 npm run simulate:esp32` simulates Fix 1;
  the simulated boards are paired automatically.

## Rollout order

1. Approve the decisions above.
2. Fix 2 (migration, mapper, API, frontend) and the simulator flag. Test with
   the simulator in aligned and unaligned modes.
3. Fix 1: reflash both boards. Exact pairing takes over from that point;
   older data keeps nearest-match pairing.
