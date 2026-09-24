# Security posture

Consolidates the access-control state of this backend after the
`docs/tracker/todo.md` "Authorization" round (RLS + the account-management
role gate). See `docs/PENDING_DECISIONS.md` for what's still open —
nothing here resolves a pending business decision, it closes gaps that
don't require one.

## Row-Level Security

`supabase/migrations/20260919090000_enable_rls.sql` enables RLS on all 15
`public` tables with **no policies**.

Before this migration, `anon`/`authenticated` held full `SELECT`/`INSERT`/
`UPDATE`/`DELETE` grants on every table via Supabase's default schema
privileges — confirmed locally: a direct PostgREST request with the public
anon key returned every row in `devices` with no authentication at all,
completely bypassing this Express API. Enabling RLS with zero policies
makes those two roles deny-by-default (reads now return `[]`, writes are
rejected).

This has **zero effect on this backend's own behavior**: every route uses
`supabaseAdmin` (`src/config/supabaseClient.ts`), authenticated as
`service_role`, which has `BYPASSRLS` and always did. RLS only closes the
direct-to-Postgres path that nothing in this codebase was ever supposed to
use.

**What's still open**: no per-role policies exist. If anything is ever
added that talks to Supabase directly as an end user (rather than through
this Express API), `anon`/`authenticated` will need real policies designed
around the eventual permissions model — that's `PENDING_DECISIONS.md`
("user authorization"), not decided here.

## Account-management role gate

`src/middleware/auth.ts` adds `requireRole(...roles)`, applied to 4 routes
in `src/routes/users.routes.ts`:

| Route | Gate |
| --- | --- |
| `POST /users` | `Administrator` |
| `PATCH /users/:id/role` | `Administrator` |
| `PATCH /users/:id/status` | `Administrator` |
| `DELETE /users/:id` | `Administrator` |

Before this, every route only required `requireAuth` (any valid session) —
including these four. A freshly-created `Viewer` could call
`PATCH /users/:id/role` on their own account and grant themselves
`Administrator`.

**This is not the full permissions matrix.** Every other route in the API
— telemetry, alerts, test runs, calibration, laboratory validation,
maintenance, settings, devices — remains `requireAuth`-only, exactly as
before. Deciding who may call those is `PENDING_DECISIONS.md` ("user
authorization"), still open; this gate only closes the one route group
that was an obvious self-escalation hole regardless of what that decision
ends up being.

## Device ingestion auth (unchanged)

`src/middleware/deviceAuth.ts`'s `X-Device-Key` shared secret is untouched
by this round. It remains exactly what it always was: a placeholder so
`POST /devices/:id/readings` (the one route reachable without a user
session) isn't wide open, not a resolution of the real device-
authentication mechanism (`PENDING_DECISIONS.md`). A stronger placeholder
(e.g. per-device secrets) was deliberately not built here — see
`docs/tracker/todo.md` → "Device authentication" for why.

## Alert-engine triggers

Not an access-control mechanism, but part of this round's security/
reliability posture: `src/lib/alertEngine.ts` and
`src/lib/deviceWatchdog.ts` now generate `alerts` rows automatically for
threshold breaches, sensor faults, and devices gone offline. See
`docs/API_REFERENCE.md` → Alerts → "What generates alerts automatically"
for the full behavior.

## Summary of what remains open

Everything below is a business/product decision, not an engineering gap —
see `docs/PENDING_DECISIONS.md`:

- Full per-route permissions matrix (which roles may call which domain
  routes)
- Real device-authentication mechanism
- Approved alert thresholds (the alert engine is wired up but inert until
  these are set)
- Actuator (pump/UV-C) control authority — blocks any command/audit
  infrastructure
