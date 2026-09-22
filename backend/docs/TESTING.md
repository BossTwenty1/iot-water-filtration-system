# Testing

Test infrastructure (`vitest` + `supertest`), added after everything in
`docs/API_REFERENCE.md`/`docs/SECURITY.md` was already built. Nothing here
resolves a `PENDING_DECISIONS.md` item — it verifies the engineering that
already exists.

## Running tests

```bash
npm test              # unit + route tests only (excludes integration/)
npm run test:watch    # same, in watch mode
npm run test:integration  # integration/ only — needs the local Supabase stack running
```

`vitest.config.ts` points at `src/**/*.test.ts` with
`src/__tests__/setup.ts` as a global setup file — it fills in dummy
`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY`/
`DEVICE_INGEST_KEY` env values (only if not already set by `backend/.env`)
so that unit tests whose Supabase client is mocked don't fail on
`src/config/env.ts`'s import-time validation.

## Unit tests (mocked, no network)

Colocated as `*.test.ts` next to the module under test:

| File | Covers |
| --- | --- |
| `src/lib/apiError.test.ts` | `ApiError` construction/status codes |
| `src/lib/params.test.ts` | route-param extraction helper |
| `src/lib/queryHelpers.test.ts` | `orThrow` and Supabase result unwrapping |
| `src/lib/mappers.test.ts` | row → frontend-shape mapping, incl. `groupReadingsIntoTelemetry` |
| `src/lib/alertEngine.test.ts` | threshold-breach and sensor-fault alert logic |
| `src/middleware/deviceAuth.test.ts` | `X-Device-Key` check |
| `src/middleware/errorHandler.test.ts` | error → HTTP status mapping, incl. the `503` cloud-outage classification |
| `src/routes/auth.routes.test.ts` | `/auth/*`, incl. the zod `validateBody` 400 path |
| `src/routes/devices.routes.test.ts` | device registration + readings ingestion, incl. zod envelope validation |

`src/__tests__/helpers/supabaseMock.ts` provides a chainable stub covering
the subset of the Supabase query-builder surface this codebase actually
calls (`.select().eq().order().limit().maybeSingle()/.single()`, `.insert()`,
`.update()`, `.delete()`) — route/lib tests configure it with a canned
`{ data, error }` result rather than hitting a real database.

## Integration tests (real local Supabase, not mocked)

`src/__tests__/integration/` — require `npx supabase start` (and usually
`npx supabase db reset` first for a known state):

- `auth.integration.test.ts` — real login against Supabase Auth.
- `deviceReadings.integration.test.ts` — a real ingestion round-trip through
  `POST /devices/:id/readings`.
- `rls.integration.test.ts` — exercises
  `supabase/migrations/20260919090000_enable_rls.sql` against a real
  Postgres instance (an anon-key read returning `[]` isn't something a mock
  can meaningfully verify).

These are excluded from the default `npm test` run (slow, and not runnable
in an environment without Docker/Supabase) — run them explicitly with
`npm run test:integration` when the local stack is up.

## What isn't covered yet

Most route files have no test at all yet — only `auth.routes.ts` and
`devices.routes.ts` do. The zod validation rollout
(`docs/API_REFERENCE.md` → "Error format") and test coverage have grown
together so far; extending one to the remaining routes (test runs,
calibration, laboratory validation, maintenance, settings, users) is
tracked as ongoing, not a decision blocked on anything external.
