# Simulator → Backend → Local/Test Database — Telemetry Persistence Proof

**Sprint task:** ALEJANDRO — Simulator to local/test database proof
**Branch:** `feature/backend-local-telemetry-proof`
**Date:** 2026-09-24
**Scope:** `backend/` only. Executed entirely against a local Supabase Docker stack (project `backend`, ports `127.0.0.1:54321-54327`) — no write ever targeted production or an unverified remote database.

## Why this exists

The simulator's payload already matched the backend's ingestion contract by code inspection (`backend/src/routes/devices.routes.ts` vs. `backend/scripts/liveSimulator.ts`), but that had never been proven at runtime: backend running, simulator posting, rows actually landing in Postgres, and an authenticated read-back returning those exact values. This report is that runtime proof.

## Setup requirements

- Docker (for the Supabase CLI's local stack)
- Node.js 20, `pnpm` (repo uses `backend/pnpm-lock.yaml`)
- Supabase CLI, invoked via `npx supabase` (devDependency, no global install needed)
- `psql` client (for the direct-database verification step)

## 1. Confirm the target database is local/test-only

```
cd backend
npx supabase status
```

Result (secrets redacted — these are ordinary Supabase local-dev credentials, not shared here regardless):

```
DB_URL:      postgresql://postgres:postgres@127.0.0.1:54322/postgres
API_URL:     http://127.0.0.1:54321
STUDIO_URL:  http://127.0.0.1:54323
ANON_KEY / SERVICE_ROLE_KEY / JWT_SECRET: <redacted — local fixed demo values>
```

`backend/.env` was checked and matches this stack exactly:

```
SUPABASE_URL=http://127.0.0.1:54321
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
BACKEND_PORT=3000
DEVICE_INGEST_KEY=<redacted>
```

No hostname other than `127.0.0.1` appears anywhere in the configuration used for this proof.

## 2. Start the backend (documented steps)

```
pnpm install
pnpm run dev
```

Log excerpt:

```
API listening on http://localhost:3000/api/v1
[notify] Warning Device Offline — ESP32 Offline: Simulated Filtration Unit has not reported since 2026-09-21T14:29:22.868+00:00. (device 76afa61b-0790-4051-a5c8-16eb5ec4187f)
```

Sanity checks: `GET /api/v1/telemetry/current` without a token → `401`; with a valid token → `200` with data. Server confirmed live and routing correctly.

## 3. Seed known fixtures

```
pnpm run seed
```

Output (token redacted):

```
✓ Test user: seed-admin@aquasense.test / SeedTest123!
✓ Device: 76afa61b-0790-4051-a5c8-16eb5ec4187f (SIM-DEV-001)
✓ Sensors: 10
✓ Sensor readings: 100
export TOKEN="<redacted>"
deviceId=76afa61b-0790-4051-a5c8-16eb5ec4187f
```

The printed `TOKEN` (a real Supabase Auth JWT for `seed-admin@aquasense.test`) was used for all authenticated calls below.

## 4. Run the documented simulator, then stop it

```
pnpm run simulate
```

Ran for ~14s (3 posting cycles), then stopped (SIGTERM) before the verification batch, so it can't race the later read-back check:

```
Posting a reading batch every 5000ms to POST /devices/76afa61b-0790-4051-a5c8-16eb5ec4187f/readings. Ctrl+C to stop.
✓ 8:52:40 PM inserted=10 skipped=0
✓ 8:52:45 PM inserted=10 skipped=0
✓ 8:52:50 PM inserted=10 skipped=0
```

This confirms the documented simulator startup path works end-to-end against the local database (30 readings inserted, 0 skipped, across 3 cycles).

## 5. Send one clearly identified synthetic batch

A dedicated test run was created first to tag the batch:

```
POST /api/v1/test-runs
{"deviceId":"76afa61b-0790-4051-a5c8-16eb5ec4187f","notes":"SYNTHETIC-PROOF-20260924T125405Z"}

→ 201 {"id":"bdb9d883-b7b6-462b-9b58-d324de873481", ..., "notes":"SYNTHETIC-PROOF-20260924T125405Z"}
```

Then a hand-built batch with deliberately distinctive sentinel values (not simulator-generated noise) was sent, carrying that `testRunId`:

```
POST /api/v1/devices/76afa61b-0790-4051-a5c8-16eb5ec4187f/readings
X-Device-Key: <redacted>

{
  "measuredAt": "2026-09-24T12:54:42.000Z",
  "testRunId": "bdb9d883-b7b6-462b-9b58-d324de873481",
  "readings": [
    {"category":"ph","position":"pre_filtration","value":6.10,"status":"valid"},
    {"category":"ph","position":"post_filtration","value":7.90,"status":"valid"},
    {"category":"turbidity","position":"pre_filtration","value":50.50,"status":"valid"},
    {"category":"turbidity","position":"post_filtration","value":1.10,"status":"valid"},
    {"category":"tds","position":"pre_filtration","value":555.50,"status":"valid"},
    {"category":"tds","position":"post_filtration","value":111.10,"status":"valid"},
    {"category":"temperature","position":"pre_filtration","value":20.20,"status":"valid"},
    {"category":"temperature","position":"post_filtration","value":20.10,"status":"valid"},
    {"category":"flow_rate","position":"pre_filtration","value":9.90,"status":"valid"},
    {"category":"flow_rate","position":"post_filtration","value":9.10,"status":"valid"}
  ]
}

→ 201 {"deviceId":"76afa61b-0790-4051-a5c8-16eb5ec4187f","inserted":10,"skipped":[]}
```

Identification: every reading carries `test_run_id = bdb9d883-b7b6-462b-9b58-d324de873481` (notes: `SYNTHETIC-PROOF-20260924T125405Z`), and the device itself is flagged `is_simulated = true`.

## 6. Verify persistence directly against the local database

```sql
select s.category, s.position, r.value, r.reading_status, r.measured_at
from sensor_readings r
join sensors s on s.id = r.sensor_id
where r.test_run_id = 'bdb9d883-b7b6-462b-9b58-d324de873481'
order by s.category, s.position;
```

```
  category   |    position     | value | reading_status |      measured_at
-------------+-----------------+-------+----------------+------------------------
 flow_rate   | post_filtration |   9.1 | valid          | 2026-09-24 12:54:42+00
 flow_rate   | pre_filtration  |   9.9 | valid          | 2026-09-24 12:54:42+00
 ph          | post_filtration |   7.9 | valid          | 2026-09-24 12:54:42+00
 ph          | pre_filtration  |   6.1 | valid          | 2026-09-24 12:54:42+00
 tds         | post_filtration | 111.1 | valid          | 2026-09-24 12:54:42+00
 tds         | pre_filtration  | 555.5 | valid          | 2026-09-24 12:54:42+00
 temperature | post_filtration |  20.1 | valid          | 2026-09-24 12:54:42+00
 temperature | pre_filtration  |  20.2 | valid          | 2026-09-24 12:54:42+00
 turbidity   | post_filtration |   1.1 | valid          | 2026-09-24 12:54:42+00
 turbidity   | pre_filtration  |  50.5 | valid          | 2026-09-24 12:54:42+00
(10 rows)
```

All 10 rows persisted, values exactly matching what was sent.

## 7. Verify via authenticated `GET /api/v1/telemetry/current`

```
GET /api/v1/telemetry/current?deviceId=76afa61b-0790-4051-a5c8-16eb5ec4187f
Authorization: Bearer <redacted>
```

```json
[
  {"parameter":"flowRate","label":"flow_rate","value":9.1,"unit":"L/min","stage":"after"},
  {"parameter":"flowRate","label":"flow_rate","value":9.9,"unit":"L/min","stage":"before"},
  {"parameter":"temperature","label":"temperature","value":20.1,"unit":"°C","stage":"after"},
  {"parameter":"temperature","label":"temperature","value":20.2,"unit":"°C","stage":"before"},
  {"parameter":"TDS","label":"tds","value":111.1,"unit":"ppm","stage":"after"},
  {"parameter":"TDS","label":"tds","value":555.5,"unit":"ppm","stage":"before"},
  {"parameter":"turbidity","label":"turbidity","value":1.1,"unit":"NTU","stage":"after"},
  {"parameter":"turbidity","label":"turbidity","value":50.5,"unit":"NTU","stage":"before"},
  {"parameter":"pH","label":"ph","value":7.9,"unit":"pH","stage":"after"},
  {"parameter":"pH","label":"ph","value":6.1,"unit":"pH","stage":"before"}
]
```

Every value matches the batch sent in step 5 (`pre_filtration` → `stage: before`, `post_filtration` → `stage: after`). Because the simulator was stopped before this batch was sent, this batch was the most recent write for every sensor on the device, so the "current" read-back is unambiguous.

## Definition of Done — checklist

| Requirement | Result |
|---|---|
| Start the backend and simulator using documented steps | ✅ `pnpm run dev` + `pnpm run simulate`, both per `backend/docs/LOCAL_DEVELOPMENT.md` |
| Send a clearly identified synthetic telemetry batch | ✅ Tagged with `test_run_id` (notes `SYNTHETIC-PROOF-20260924T125405Z`) + distinctive sentinel values, on the already-flagged `is_simulated` device |
| Verify the readings persisted in the local/test database | ✅ Direct `psql` query, 10/10 rows match exactly |
| Authenticated `GET /api/v1/telemetry/current` returns the same sent values | ✅ All 10 values match |
| Local/test database only, no production writes | ✅ `SUPABASE_URL`/`DATABASE_URL` confirmed `127.0.0.1` throughout; no remote host ever configured or used |
| Secrets kept out of this report | ✅ `DEVICE_INGEST_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, and the bearer token are all redacted above |

## Reproducing this proof

```bash
cd backend
npx supabase start          # or `npx supabase status` if already running
pnpm install
pnpm run dev &               # terminal 1 (or background)
pnpm run seed                # prints TOKEN + deviceId
pnpm run simulate            # terminal 2, Ctrl+C after a couple of cycles

export TOKEN="<from seed output>"
export DEVICE_ID="<from seed output>"

# Tag + send a synthetic batch
curl -s -X POST http://localhost:3000/api/v1/test-runs \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"deviceId\":\"$DEVICE_ID\",\"notes\":\"SYNTHETIC-PROOF-$(date -u +%Y%m%dT%H%M%SZ)\"}"
# then POST /api/v1/devices/$DEVICE_ID/readings with X-Device-Key and the returned testRunId

# Verify in DB
psql "$DATABASE_URL" -c "select * from sensor_readings where test_run_id = '<id>';"

# Verify via API
curl -s "http://localhost:3000/api/v1/telemetry/current?deviceId=$DEVICE_ID" \
  -H "Authorization: Bearer $TOKEN"
```
