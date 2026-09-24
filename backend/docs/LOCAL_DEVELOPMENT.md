# Local Development

> Merged from the former `LOCAL_SUPABASE.md` (running the local Supabase
> stack) and `script.md` (the seed/simulate scripts that run against it) —
> both were "how do I get a working backend on my machine" concerns.

## Running Supabase locally (Docker)

How to run the local Supabase stack (Postgres, Studio, Auth, Storage, etc.)
for backend development, using the Supabase CLI already installed in
`backend/package.json` (devDependency `supabase`). This is for local
development only — it is separate from, and does not require, a Supabase
cloud project.

### Prerequisites

- Docker Engine, running and accessible without `sudo` (your user in the
  `docker` group)
- Node/pnpm already set up for `backend/` (see `docs/DEVELOPMENT.md`)

#### Installing Docker on Debian 13 (trixie)

As of writing, Docker's official apt repo does not yet publish `trixie`
packages. The Debian 12 (`bookworm`) build installs and runs fine on Debian
13 hosts:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  bookworm stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker $USER
```

**Log out and back in** (or run `newgrp docker`) afterward — the new group
membership does not apply to already-open shell sessions.

Verify with:

```bash
docker info
```

If this hangs or errors with a permission message, the group change hasn't
taken effect yet in your current session — open a fresh terminal.

### Starting the local stack

From `backend/`:

```bash
cd backend
npx supabase start
```

First run pulls several Docker images (Postgres, Studio, Auth/GoTrue,
Storage, Realtime, Kong, etc.) — this can take a while and is a one-time
cost per machine. Subsequent runs are fast.

On success, the CLI prints a JSON block with local URLs and keys, for
example:

```json
{
  "DB_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  "API_URL": "http://127.0.0.1:54321",
  "STUDIO_URL": "http://127.0.0.1:54323",
  "ANON_KEY": "...",
  "SERVICE_ROLE_KEY": "..."
}
```

| Service | Local URL |
| --- | --- |
| REST/GraphQL/Functions API | `http://127.0.0.1:54321` |
| Studio (dashboard UI) | `http://127.0.0.1:54323` |
| Postgres (direct connection) | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |
| Mailpit (test email inbox) | `http://127.0.0.1:54324` |

These `ANON_KEY`/`SERVICE_ROLE_KEY` values are fixed local-dev demo keys —
safe only against this local instance. **Never reuse them against the real
Supabase cloud project, and never commit real project keys.**

### Connecting the backend to it

Copy `.env.example` to `backend/.env` (never commit `.env`) and set:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<ANON_KEY from the supabase start output>
BACKEND_PORT=<your chosen port>
```

### Useful commands

```bash
npx supabase status   # reprint URLs/keys for an already-running stack
npx supabase stop     # stop and remove the local containers
npx supabase db reset # drop and recreate the local DB from migrations + seed
```

### Stopping

```bash
cd backend
npx supabase stop
```

This stops the containers; it does not uninstall Docker or delete migration
files.

### Notes

- No schema is applied automatically — migrations under
  `backend/supabase/migrations/` are what defines the local database
  structure (see [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md)).
- This local instance is for development/testing only. It has no
  relationship to production data or the eventual Supabase cloud project
  referenced in `docs/DATABASE.md`.

---

## Scripts

Reference for everything in `backend/scripts/`. Both scripts assume the
local Supabase stack above is already running and `backend/.env` is filled
in.

### `seedTestData.ts` — one-shot database seed

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

### `liveSimulator.ts` — continuous HTTP telemetry feed

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

For automated tests instead of manual scripts, see [TESTING.md](TESTING.md).
