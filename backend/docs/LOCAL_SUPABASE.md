# Running Supabase Locally (Docker)

This describes how to run the local Supabase stack (Postgres, Studio, Auth,
Storage, etc.) for backend development, using the Supabase CLI already
installed in `backend/package.json` (devDependency `supabase`). This is for
local development only — it is separate from, and does not require, a
Supabase cloud project.

## Prerequisites

- Docker Engine, running and accessible without `sudo` (your user in the
  `docker` group)
- Node/pnpm already set up for `backend/` (see `docs/DEVELOPMENT.md`)

### Installing Docker on Debian 13 (trixie)

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

## Starting the local stack

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

## Connecting the backend to it

Copy `.env.example` to `backend/.env` (never commit `.env`) and set:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<ANON_KEY from the supabase start output>
BACKEND_PORT=<your chosen port>
```

## Useful commands

```bash
npx supabase status   # reprint URLs/keys for an already-running stack
npx supabase stop     # stop and remove the local containers
npx supabase db reset # drop and recreate the local DB from migrations + seed
```

## Stopping

```bash
cd backend
npx supabase stop
```

This stops the containers; it does not uninstall Docker or delete migration
files.

## Notes

- No schema is applied automatically — migrations under
  `backend/supabase/migrations/` (once they exist, per
  `docs/DATABASE_SCHEMA_DRAFT.md`) are what defines the local database
  structure.
- This local instance is for development/testing only. It has no
  relationship to production data or the eventual Supabase cloud project
  referenced in `docs/DATABASE.md`.
