
# Database

The planned database platform is Supabase PostgreSQL.

This document describes the proposed logical schema. The database is not yet
implemented.

---

## 1. Principles

The database must:

- preserve pre/post measurement identity,
- preserve device identity,
- preserve timestamps,
- preserve test-run context,
- separate sensor data from laboratory data,
- distinguish simulated from real records,
- preserve calibration context,
- support historical analysis,
- support CSV export,
- support audit-relevant fault and maintenance records.

---

## 2. Normal Data Path

Device/simulator write path:

```text
ESP32 / Simulator
       ↓
Express API
       ↓
Supabase PostgreSQL
```

Frontend request path:

```text
React
  ↓
Express API
  ↓
Supabase PostgreSQL
```

---

## 3. Logical Record Domains

The logical database design should support, subject to final schema approval:

- users and authorization references,
- devices,
- telemetry with explicit pre-filtration/post-filtration sensor position,
- test runs,
- alerts,
- calibration records,
- laboratory tests, and
- maintenance records.

Telemetry should also preserve device identity, test-run context, measurement
timestamp, calibration context, and a source identity distinguishing real
hardware from simulator data. Exact table names, fields, relationships, and
constraints remain `TBD`.

## Approved software RBAC extension

Review-only migration `backend/supabase/migrations/20261011090000_user_management_rbac.sql`
adds role/status checks (NOT VALID initially to preserve legacy rows), a pending
deletion marker, append-only `account_audit`, transactional `manage_account`,
offline `provision_super_administrator`, metadata-safe profile creation and
last-active-Super-Administrator guards. New profiles default to Viewer/Inactive.
Existing profiles are not rewritten or promoted; invalid legacy roles fail closed
in Express and require separate review before constraint validation. Preserve
the existing deny-default RLS baseline. See [RBAC](RBAC.md) for provisioning.

Local SQL regression fixtures in `backend/supabase/tests/rbac.sql` roll back.
The runner requires `RBAC_LOCAL_TEST_DATABASE_URL` on a literal loopback host,
`psql`, and an empty migrated disposable local database. From `backend`, run
`npx ts-node scripts/testRbacDatabase.ts`. No hosted fallback or automatic
migration application is implemented. Concurrency/locking needs a separate
two-connection local test before deployment; no live database proof is claimed.
