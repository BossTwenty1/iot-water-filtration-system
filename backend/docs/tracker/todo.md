# Backend TODO

Follow-up work identified while implementing `docs/plans/API ROUTES PLAN.md`
(commits `f4b9ce9`, `598f0e1` on `feature/backend-init`). Cross-referenced to
task IDs in `IoT Water Filtration - Project Tracker.xlsx` → **Project
Tracker** where one exists. See `docs/API_REFERENCE.md` for what's already
built.

## Next up (blocks other tracker tasks)

- [x] **Telemetry ingestion endpoint** (`P2-02`) — done. `POST
      /devices/:id/readings`, batched, authenticated with a placeholder
      `X-Device-Key` shared secret (not the real device-auth decision —
      `docs/PENDING_DECISIONS.md` §8), validates each reading's
      category/position/value against the device's registered `sensors`
      rows and skips (not fails) unregistered/invalid entries individually.
      On success, also bumps `devices.last_seen_at`/`connection_state` as a
      heartbeat. See `docs/API_REFERENCE.md` → Devices →
      `POST /devices/:id/readings`.
- [x] **Live simulator** (`P1-05`) — done. `scripts/liveSimulator.ts` POSTs
      a reading batch to `POST /devices/:id/readings` every 5s
      (`LIVE_SIM_INTERVAL_MS` to change it), authenticated with
      `X-Device-Key`, against the same `SIM-DEV-001` device as
      `seedTestData.ts`, with small per-parameter random drift and an
      occasional simulated `value: null` / `status: "unavailable"` reading.
      Run with `npm run simulate` (needs `npm run dev` running). See
      `docs/API_REFERENCE.md` → "Seed data".
- [ ] **CSV export** (`P2-06`) — not started. `docs/API_ROUTES_DRAFT.md` §8
      proposes `GET /export/csv`; exact record types and column order are
      still `TBD` per `docs/PENDING_DECISIONS.md` §12 — needs a decision
      before implementing, not just an endpoint.
- [ ] **Alert-generation logic** (`P2-05`, partially done) — storage and the
      acknowledge/resolve/stream API exist, but nothing currently evaluates
      sensor readings or device faults and inserts an `alerts` row. Blocked
      on `P0-06` (approved thresholds) and `P0-05` (pump/UV-C control
      authority) — implement once those land, likely as a check that runs
      alongside the ingestion endpoint above.

## Authorization

- [ ] **Role-based authorization enforcement** (`P2-04`, partially done) —
      login/session/role-storage all work; every route only requires *some*
      authenticated user right now (`requireAuth`), not a specific role.
      `req.profile.role` is already available in
      `src/middleware/auth.ts` — add `requireRole(...)` gates once the team
      decides who may do what (`docs/PENDING_DECISIONS.md` §9).
- [x] **Row-Level Security policies** — done. `supabase/migrations/
      20260919090000_enable_rls.sql` enables RLS on all 15 tables with no
      policies, so `anon`/`authenticated` are deny-by-default (a direct
      PostgREST read with the anon key now returns `[]`); `service_role`
      (this backend's only DB client) is unaffected via `BYPASSRLS`. No
      per-role policies yet — that's a permissions design, still open
      (`docs/PENDING_DECISIONS.md` "user authorization"). See
      `docs/SCHEMA_TBD_LOG.md`.
- [ ] **Device authentication** — `devices.device_identifier` has no
      enforced link to how an ESP32/simulator proves its identity
      (`docs/PENDING_DECISIONS.md` §8). Relevant once the ingestion endpoint
      above is built — right now only the frontend/admin API has auth.

## Data & schema

- [ ] Regenerate `src/types/database.types.ts` (`npx supabase gen types
      typescript --local`) after every new migration — it's checked in, not
      generated at build time, so it goes stale silently otherwise.
- [ ] Data retention: `data_retention_policy` is just a config row today —
      nothing reads it or purges old rows. Needs a scheduled job (Supabase
      cron function, or an external scheduler) once a retention policy is
      approved.
- [ ] Remote command delivery / audit table for pump/UV-C control
      (`docs/PENDING_DECISIONS.md` §10) — only relevant once `P0-05`
      confirms actuators are controllable, not monitor-only.

## Realtime

- [ ] Current SSE streams (`/telemetry/stream`, `/alerts/stream`,
      `/realtime/stream`) poll the DB every `SSE_POLL_INTERVAL_MS` (default
      3s) — see `src/lib/sse.ts`. Fine for a dashboard; revisit with
      Supabase Realtime (already running in the local stack) if the project
      ends up needing sub-second updates.

## Deployment (Phase 8)

- [ ] Production Supabase project (`P8-01`) — everything so far is the
      local Docker stack (`npx supabase start`); no hosted project exists.
- [ ] CORS_ORIGIN / env values need real production values before deploy —
      `.env.example` only has local defaults.

## Frontend integration

- [ ] Swap `frontend/src/services/*Service.ts` (on
      `feature/frontend-foundation`) from their mock in-memory arrays to
      `apiRequest()` calls against these routes — `docs/API_REFERENCE.md`
      has the exact request/response shape for every endpoint, written so
      this should be closer to a drop-in swap than a rewrite. Not started;
      needs coordination with Nash since it touches the frontend branch.
