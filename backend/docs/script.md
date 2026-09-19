# Scripts

Reference for everything in `backend/scripts/`. Both scripts assume the
local Supabase stack is running (`npx supabase start`) and `backend/.env` is
filled in — see `docs/LOCAL_SUPABASE.md`.

## `seedTestData.ts` — one-shot database seed

```bash
npm run seed
```

Writes straight into the database via the Supabase service-role client (no
running API server required). On each run it:

- Deletes and recreates a test user — `seed-admin@aquasense.test` /
  `SeedTest123!` — so the login/password/token are always known.
- Reuses the `SIM-DEV-001` device and its 10 sensors if they already exist
  (from `supabase/seed.sql`), otherwise creates them.
- Inserts fresh fixture data on every run: two test runs (one `In Progress`,
  one `Completed`) with 100 sensor readings across 5 reading cycles, 3
  alerts, 3 calibration records, 2 laboratory validation records (one
  `Available`, one `Pending`), 2 maintenance records, 2 maintenance
  reminders, and threshold + notification-provider config.
- Logs in as the test user and prints the access token plus copy-pasteable
  `curl` commands for the routes in `docs/API_REFERENCE.md`.

Safe to re-run. Run `npx supabase db reset` first if you want a fully clean
slate before seeding again (this also re-applies `supabase/seed.sql`).

Use this when you need a populated database and a token to poke at routes
by hand — it does not exercise anything over HTTP itself.

## `liveSimulator.ts` — continuous HTTP telemetry feed

```bash
npm run dev        # in one terminal — the API server this posts to
npm run simulate   # in another
```

Behaves like a real ESP32 device instead of writing to the database
directly: it POSTs a reading batch to `POST /devices/:id/readings` on an
interval, authenticated with `X-Device-Key` (see
`src/middleware/deviceAuth.ts`) — the same path real hardware will use once
it exists. Use this to exercise the "live" surfaces that a one-shot seed
can't: SSE streams (`/telemetry/stream`, `/alerts/stream`,
`/realtime/stream`) and the dashboard's `SensorGrid`.

On start it ensures the `SIM-DEV-001` device and its 10 sensors exist (same
device the seed script uses, so both can be run against the same data), then
every tick:

- Drifts each of the 5 parameters (pH, turbidity, TDS, temperature, flow
  rate) by a small random step, separately for pre- and post-filtration,
  continuing from the same baselines `seedTestData.ts`'s last reading cycle
  ends on.
- Has a small chance (~3%) per reading of reporting `value: null` with
  `status: "unavailable"` instead of a measured value, to exercise that
  path (see `docs/DATABASE.md` on the unavailable-vs-measured distinction).
- Logs `inserted`/`skipped` counts from the endpoint's response.

Configuration:

| Env var                 | Default | Effect                                   |
| ------------------------ | ------- | ----------------------------------------- |
| `LIVE_SIM_INTERVAL_MS`   | `5000`  | Milliseconds between reading batches.     |
| `DEVICE_INGEST_KEY`      | —       | Read from `backend/.env`; must match the API server's value. |
| `BACKEND_PORT`           | `3000`  | Read from `backend/.env`; where it POSTs. |

Stop with Ctrl+C. Does not attach a `testRunId` — readings post with no test
run, which every read route already treats as valid (unfiltered results
include them).

Requires the API server to already be running; if it isn't, each tick logs
a connection error and retries on the next interval rather than crashing.
