# RBAC implementation verification — 2026-10-11

## Scope and branch

Feature worktree: `feature/user-management-rbac`, based on
`integration/frontend-api-connection` at `a04b2a815d62992ff1d20765c4ae1d01a8ff8387`.
The original integration checkout and its pre-existing local CORS/environment
setup were preserved. No commit, push, merge or deployment was performed.
No hosted migration, bootstrap, or real-account change was performed.

See [RBAC policy and bootstrap](RBAC.md), [API contract](API_CONTRACT.md) and
[database migration notes](DATABASE.md). The migration must be reviewed and
applied in a separately approved environment before this feature backend is used.

## Initial implementation checks and evidence (before Phase 2)

| Check | Result |
| --- | --- |
| Backend `npm run build` | Passed |
| Backend `npm run typecheck` | Passed |
| Backend `npm test` | Passed: 180 tests in 12 files; unit/mocked API tests, not hosted integration |
| Backend lint | No existing lint script |
| Frontend `npm run build` | Passed, including TypeScript; loopback fixture build used `VITE_API_BASE_URL=/api/v1` |
| Frontend `npm run lint` | Passed |
| Frontend Node tests | Passed: 12 tests (5 permission, 6 session-client, 1 read-only preview isolation) |
| Scoped design detector | No findings; run once on changed UI targets |
| Focused UI fix review | `disposition: ship` for all four scored fixes; not production/integration certification |
| `git diff --check` and untracked-file whitespace scan | Passed |
| Changed-file private-key/JWT/GitHub-token pattern scan | No matches; no environment files copied |
| Browser verification | Synthetic read-only loopback API only; desktop 1440, user viewport 1280, mobile 390 |
| PostgreSQL migration and rollback SQL regression | **Not Confirmed**; local PostgreSQL/psql unavailable and Docker daemon unavailable |
| Concurrent last-Super-Administrator protection | **Not Confirmed**; separate two-connection database test required |
| Hosted login, account provisioning/deletion and audit persistence | **Not Confirmed**; no hosted writes or new feature live-account testing |
| SMTP, invitation delivery, recovery and first-password-change policy | **Not Confirmed**; not claimed as implemented production provisioning |

Backend tests cover four-role grants, denied and authorized real Express handlers,
inactive login/refresh/existing-token access, metadata escalation, SSE closure,
account listing/audit permissions, schema validation, trusted-actor RPC calls,
partial deletion and bootstrap CLI guards. Database functions are mocked in these
tests; last-Super-Administrator SQL/cascade/audit fixtures exist but were not run.

Session-client tests transpile the actual TypeScript modules using the already
installed TypeScript compiler, with synthetic fetch/storage mocks. They check
bearer attachment, role synchronization after 403, inactive refresh after 401,
invalid-role envelopes, offline local logout, and isolation of a newer login from
an older failed profile check. No real credentials or network are used.

Browser checks confirmed manager-only directory navigation, Administrator-only
lower-role choices, Super-Administrator audit visibility, restricted self-actions,
status filtering, empty and error states, inactive-session return to login,
read-only settings for Viewer/Researcher, confirmation dialogs, failure recovery,
and the accessible details announcement. Mobile has no document-wide overflow;
the local table remains horizontally scrollable. Account submissions were refused
by the test-only API; this is not evidence of successful Supabase mutations.

The focused UI review led to compact action rows, discoverable keyboard-accessible
table scrolling, disabled role/form fields while pending, explicit dialog
close-and-refresh recovery and a live account-details announcement. Existing
themes, tokens, components and page layouts were retained.

## Repeat local checks

From `backend`:

```
npm run build
npm run typecheck
npm test
```

From `frontend`, the independent tests need no backend:

```
npm run build
npm run lint
node --experimental-strip-types --test tests/permissions.test.mjs tests/apiClient.test.mjs
```

Optional synthetic browser verification in PowerShell, from `frontend`:

```
$env:VITE_API_BASE_URL='/api/v1'
npm run build
node tests/rbac-preview.mjs
```

Use a separate terminal for `node --test tests/rbac-preview.test.mjs`.
The read-only fixture serves `http://127.0.0.1:5185/users`; supported role query
values are the four approved roles, and `mode=empty`, `mode=error`,
`mode=inactive` expose test states. It supplies labeled synthetic sessions and
records only from the test server, loads no Supabase/environment configuration,
and refuses all account writes. Never deploy it or treat it as live API proof.
Stop it with Ctrl+C; rebuild normally before using a different approved API target.
The application's shipping services still use actual authenticated API records.

Database fixtures require an empty, migrated, disposable **local** Supabase
database and `psql`, either on the host or inside a positively identified disposable
container. Set `RBAC_LOCAL_TEST_DATABASE_URL` privately to its loopback connection,
then run `npx ts-node scripts/testRbacDatabase.ts` from `backend`. Docker mode also
requires `RBAC_LOCAL_TEST_CONTAINER`, a `supabase_db_safe-rbac-*` project with the
`safe.rbac.disposable=true` label and an exclusively loopback-published DB port
matching the URL. The runner never falls back to hosted credentials; fixtures roll back.
Do not run migration or bootstrap commands against hosted accounts without
separate explicit approval.

## Security-sensitive review for Alejandro

- Current trusted profiles are checked on every protected request; unknown routes
  and unapproved hardware/threshold/provider/retention mutations fail closed.
  Authorization path matching follows Express's case-insensitive routes.
- Account mutations recheck actor and target inside a locked database function.
  Audit records are trigger-backed and browser account writes/audit reads denied.
- Deletion is reserve-as-inactive first, Auth deletion second. An Auth failure
  leaves a pending profile that ordinary APIs cannot reactivate; review
  operational recovery before rollout. No distributed transaction is claimed.
- Inspect migration locking and failure behavior, exercise Auth cascades, and run
  concurrent last-administrator tests before deployment. Mock tests are not SQL proof.
- Review existing legacy role/status data separately; NOT VALID constraints avoid
  rewriting existing records but future writes must satisfy the approved values.
- Temporary passwords are supplied by the authorized manager and shared privately.
  The feature does not claim delivered email confirmation/invitations or enforce
  first-login password rotation. These are production rollout gates.
- Access tokens remain in memory and refresh tokens in per-tab sessionStorage,
  consistent with existing auth. They remain JavaScript-readable; HttpOnly-cookie
  migration is outside this feature. Provider logout revocation is not live-verified.
- Software device registration is permitted; opaque device safety/config updates,
  hardware control, thresholds and final scientific approval remain withheld.

## Phase 2: real local PostgreSQL verification — 2026-10-11

Docker Desktop 29.7.2 and the existing Supabase CLI 2.117.0 were used; Windows
PostgreSQL tools were not installed. A fresh project,
`safe-rbac-20261011-92a0f5c0`, ran PostgreSQL 17.6 with a new dedicated volume.
The existing GraveNav stack and its volumes were not modified. The disposable
project's API and DB ports were explicitly bound to `127.0.0.1:55431` and
`127.0.0.1:55432`. Seeds were disabled, and zero users/profiles/audits were
confirmed before fixtures. No existing development database was reset.

All four checked-in migrations applied in order, including
`20261011090000_user_management_rbac.sql`; no migration defect was found in these
checks. The original rollback fixture and its focused constraint/permission
additions passed on PostgreSQL. Independent post-fixture counts were zero for
`auth.users`, `public.profiles` and `public.account_audit`.

| Real local check | Result |
| --- | --- |
| Viewer/Inactive defaults despite forged role metadata; initial/idempotent Super Administrator designation | Passed |
| Invalid/null role and invalid status writes; rejected invalid management inputs | Passed |
| Administrator lower-role limits, self/higher-privilege denials, pending-deletion protections | Passed |
| Last active Super Administrator deactivation, demotion and Auth cascade deletion | Passed |
| Actual anon/authenticated privileged RPC calls, profile writes and audit reads | Rejected as required |
| Actual service-role direct audit insertion | Rejected as required |
| Two concurrent sessions: deactivate, demote, Auth-cascade delete, direct profile delete | All four passed; first committed, competing last-administrator removal rejected, one active survivor |
| Audit persistence after committed operations, read from separate connections | Passed |
| Real local Auth API public signup | Rejected with signup disabled |
| Real local Auth API synthetic account creation with forged role metadata | Viewer/Inactive; no escalation |
| Real local Auth API ordinary deletion and profile cascade | Passed; committed deletion audit persisted |
| Real local Auth API last-active-Super-Administrator deletion | Rejected; Auth user and active profile retained |

The race verifier waits for the first session's protection lock before starting
the competing session. These are four controlled default READ COMMITTED races,
not exhaustive stress testing or proof for every transaction isolation level.
`scripts/testRbacConcurrency.ts` reuses the existing runner's guarded psql
transport and existing Supabase client; it is not a new test framework. It commits
only synthetic `@example.test` fixtures into an initially empty disposable project.
Unlike `rbac.sql`, it intentionally requires destruction of that test project's
volume after verification. `--auth-only` can resume its API checks on the same
disposable project containing only synthetic fixtures.

From `backend`, after separately establishing a fresh empty disposable stack and
matching its labeled containers/ports (the identifiers below are examples):

```powershell
$env:RBAC_LOCAL_TEST_DATABASE_URL='postgresql://postgres@127.0.0.1:55432/postgres'
$env:RBAC_LOCAL_TEST_CONTAINER='supabase_db_safe-rbac-example'
$env:RBAC_LOCAL_TEST_API_URL='http://127.0.0.1:55431'
npx ts-node scripts/testRbacDatabase.ts
npx ts-node scripts/testRbacConcurrency.ts
```

Use a separate temporary Supabase project ID, fresh storage and explicit loopback
bindings; never substitute an existing project. The CLI's network default did not
override explicit wildcard bindings on this run, so published bindings were
checked and corrected on only the fresh test containers. Credentials/runtime files
were kept out of source and logs. The local Auth signing secret was used only in
memory for local test tokens; backend/hosted environment configuration was not read.

Two testing issues were corrected: the runner now supports the existing container
client and displays SQL errors; an added probe that attempted an unsupported
`session_replication_role` change was replaced with normal guarded invalid writes.
The checked-in **local-only** config now disables general and email signup to
match the administrator-managed policy. Hosted Auth settings were not inspected
or changed. No earlier frontend/backend audits or mocked suites were rerun.

The runner also correctly refused a non-loopback URL, the unrelated GraveNav
container and a mismatched local published port before running SQL. Before teardown,
only two synthetic Auth users, one profile, 22 committed audit rows and one active
Super Administrator remained; every other public application table was empty.
The disposable project's containers and database volume were then destroyed, with
no matching containers or DB volume left. The original GraveNav DB retained its
same container ID and remained running. No real-account data was deleted.

Hosted migration, real client accounts, production Auth settings, SMTP/invites,
password recovery/rotation, provider logout revocation, live application session
behavior and alternate-isolation/stress coverage remain **Not Confirmed**.
No commit, push, merge, deployment or PR update is authorized by Phase 2.

## Initial implementation changed-file inventory

45 intended implementation, test and directly affected documentation files:

```
backend/scripts/bootstrapSuperAdmin.ts
backend/scripts/testRbacDatabase.ts
backend/src/__tests__/bootstrapSuperAdmin.test.ts
backend/src/config/supabaseClient.ts
backend/src/lib/permissions.test.ts
backend/src/lib/permissions.ts
backend/src/lib/sse.ts
backend/src/middleware/auth.ts
backend/src/routes/auth.routes.ts
backend/src/routes/devices.routes.test.ts
backend/src/routes/rbac.test.ts
backend/src/routes/realtime.routes.ts
backend/src/routes/users.routes.ts
backend/src/types/domain.ts
backend/src/types/rbacDatabase.ts
backend/supabase/migrations/20261011090000_user_management_rbac.sql
backend/supabase/tests/rbac.sql
docs/API_CONTRACT.md
docs/DATABASE.md
docs/PENDING_DECISIONS.md
docs/RBAC.md
docs/RBAC_VERIFICATION.md
frontend/src/App.tsx
frontend/src/components/common/Filters.tsx
frontend/src/components/layout/Header.tsx
frontend/src/components/layout/Sidebar.tsx
frontend/src/hooks/useActionFeedback.ts
frontend/src/hooks/usePermission.ts
frontend/src/hooks/useServiceData.ts
frontend/src/pages/AlertsPage.tsx
frontend/src/pages/CalibrationPage.tsx
frontend/src/pages/HistoryPage.tsx
frontend/src/pages/LaboratoryValidationPage.tsx
frontend/src/pages/MaintenancePage.tsx
frontend/src/pages/SettingsPage.tsx
frontend/src/pages/TestRunsPage.tsx
frontend/src/pages/UsersPage.tsx
frontend/src/services/apiClient.ts
frontend/src/services/usersService.ts
frontend/src/types/index.ts
frontend/src/utils/permissions.ts
frontend/tests/apiClient.test.mjs
frontend/tests/permissions.test.mjs
frontend/tests/rbac-preview.mjs
frontend/tests/rbac-preview.test.mjs
```

Build outputs and dependency junctions are ignored and uncommitted. The original
checkout's `.pnpm-store/` remains untouched/untracked and is not part of this
feature. No environment file or credentials were added to the feature worktree.
