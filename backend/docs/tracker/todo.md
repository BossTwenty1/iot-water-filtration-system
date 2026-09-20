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
- [x] **CSV export** (`P2-06`) — done. `GET /export/csv?type=telemetry|
      test-runs|alerts|laboratory-validation` (`src/routes/export.routes.ts`,
      `src/lib/csv.ts`), filters mirror the equivalent JSON routes, capped
      at 5000 rows. Column set/order is explicitly documented as a
      placeholder, not a final contract — `docs/PENDING_DECISIONS.md`
      still lists "CSV column order" as open. See `docs/API_REFERENCE.md`
      → Export.
- [x] **Alert-generation logic** (`P2-05`, sensor/threshold scope) — done
      for everything not blocked on a pending decision.
      `src/lib/alertEngine.ts` evaluates every ingested reading: threshold
      breach (reads the `thresholds` table — does nothing until one is
      configured, since approved values are still `TBD`) and sensor fault
      (`status: "unavailable"`/etc). `src/lib/deviceWatchdog.ts` separately
      polls for devices gone quiet, marks them `Offline`, raises `"ESP32
      Offline"`, and auto-resolves it on the device's next reading. Both
      dedupe on `(device_id, source)`. See `docs/API_REFERENCE.md` →
      Alerts → "What generates alerts automatically". **Still blocked**:
      pump/UV-C/filter alert categories — no such telemetry exists in this
      schema, and `P0-05` (control authority) remains open.

## Authorization

- [x] **Role-based authorization enforcement** (`P2-04`, narrow fix) —
      `requireRole(...roles)` now exists in `src/middleware/auth.ts` and
      gates the 4 account-management routes in `src/routes/users.routes.ts`
      (`POST /`, `PATCH /:id/role`, `PATCH /:id/status`, `DELETE /:id`) to
      `Administrator` — previously any authenticated user, including a
      freshly-created `Viewer`, could grant themselves `Administrator`.
      This is **not** the full permissions matrix — every other route in
      the API is still `requireAuth`-only, since who-may-call-what for
      domain routes (telemetry, alerts, test runs, ...) remains an open
      decision (`docs/PENDING_DECISIONS.md` "user authorization").
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
      (`docs/PENDING_DECISIONS.md`). Relevant once the ingestion endpoint
      above is built — right now only the frontend/admin API has auth.
      **Deliberately not touched in this round**: the shared-secret
      `X-Device-Key` placeholder already exists and is explicitly
      documented as not the real mechanism; a "better" placeholder (e.g.
      per-device secrets) still isn't the decided mechanism, and
      guessing at one risks pre-empting a decision PENDING_DECISIONS.md
      says must go through team approval first.

## Data & schema

- [ ] Regenerate `src/types/database.types.ts` (`npx supabase gen types
      typescript --local`) after every new migration — it's checked in, not
      generated at build time, so it goes stale silently otherwise. (An
      ongoing process reminder, not a one-off task — followed for the RLS
      migration in this round; no diff, as expected since RLS isn't
      reflected in generated types.)
- [x] Data retention — done. `src/lib/retentionJob.ts` polls
      `data_retention_policy` every `RETENTION_JOB_INTERVAL_MS` (default
      24h) and deletes `sensor_readings` rows older than `retentionDays`
      days. No-ops while `retentionDays` is `null` (the default) — the
      actual number is a policy decision, not hardcoded here. Verified:
      backdating rows + setting `retentionDays` to a small number purged
      exactly the old rows; clearing it back to `null` made the job a
      no-op again. See `docs/API_REFERENCE.md` → Settings →
      `GET /data-retention`.
- [ ] Remote command delivery / audit table for pump/UV-C control
      (`docs/PENDING_DECISIONS.md`) — only relevant once `P0-05` confirms
      actuators are controllable, not monitor-only. **Deliberately not
      touched in this round**: building command-issuing endpoints now
      would imply actuator control is possible, which is exactly the
      undecided question — not something to build ahead of the decision.

## Risk register follow-ups

- [x] **R-08, "SMS provider not chosen"** — done, scoped to what the
      mitigation actually asks for ("build provider-neutral notification
      service first"). `src/lib/notificationService.ts` is a
      provider-registry dispatch layer wired into `raiseAlertIfNotActive`
      (`src/lib/alertEngine.ts`): every newly-raised alert checks the
      matching `AppSettings.notifications` toggle, then dispatches through
      a built-in `log` provider plus any `notification_providers` row
      that's `enabled` and has a matching registry entry. No SMS provider
      is implemented — enabling one that isn't in the registry (e.g. the
      seeded `twilio` row) logs a warning rather than sending anything,
      since the provider itself is still `TBD`
      (`docs/PENDING_DECISIONS.md` "SMS provider"). See
      `docs/API_REFERENCE.md` → Settings → "Notification dispatch (R-08)".
- [x] **R-07, "Internet/cloud dependency during demo"** — backend half
      done; the mitigation's other half (local ESP32 autonomy/fallback) is
      firmware, not backend, and `firmware/esp32/` is still empty — nothing
      to build on yet. What's done: `src/middleware/errorHandler.ts` now
      classifies a Supabase network-level failure (fetch throws before a
      PostgrestError even exists — `ECONNREFUSED`/`ENOTFOUND`/`ETIMEDOUT`/
      etc.) as a `503` instead of a generic `500`, so a real cloud outage is
      distinguishable from a server bug; added `GET /health/cloud`, which
      actually queries Supabase (unlike the existing pure-liveness
      `GET /health`), so a demo can tell "server's fine, cloud is down"
      apart from either extreme. See `docs/API_REFERENCE.md` → "Health".

## Realtime

- [ ] Current SSE streams (`/telemetry/stream`, `/alerts/stream`,
      `/realtime/stream`) poll the DB every `SSE_POLL_INTERVAL_MS` (default
      3s) — see `src/lib/sse.ts`. Fine for a dashboard; revisit with
      Supabase Realtime (already running in the local stack) if the project
      ends up needing sub-second updates. **Deliberately not touched in
      this round** — not blocking anything, and rewriting a working
      real-time path for marginal benefit wasn't worth the risk alongside
      everything else that landed this round.

## Deployment (Phase 8)

- [ ] Production Supabase project (`P8-01`) — everything so far is the
      local Docker stack (`npx supabase start`); no hosted project exists.
- [ ] CORS_ORIGIN / env values need real production values before deploy —
      `.env.example` only has local defaults.

Both **out of scope for this round** — they need a real cloud account and
a real production domain, neither of which can be provisioned from here.

## Frontend integration

- [ ] Swap `frontend/src/services/*Service.ts` (on
      `feature/frontend-foundation`) from their mock in-memory arrays to
      `apiRequest()` calls against these routes — `docs/API_REFERENCE.md`
      has the exact request/response shape for every endpoint, written so
      this should be closer to a drop-in swap than a rewrite. Not started;
      needs coordination with Nash since it touches the frontend branch.
      **Out of scope for this round** per that same coordination note.
