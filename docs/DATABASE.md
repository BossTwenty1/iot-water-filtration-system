
# Database

The planned database platform is Supabase PostgreSQL.

The original logical plan is retained below. The implemented schema is in
`backend/supabase/migrations`; readable IDs supplement that schema as follows.

## Readable record numbers (approved October 27, 2026)

`20261027090000_readable_display_ids.sql` adds a positive, unique,
database-generated `display_number` to `devices`, `test_runs`, `alerts`,
`calibration_records`, `laboratory_validation_records`, `maintenance_records`,
`maintenance_reminders`, and `profiles`. Every table has its own identity
sequence. The API combines a number with its record type, padding to at least
four digits (for example, `Test 0001`; numbers above 9999 are not truncated).

Existing rows receive numbers once during migration. These numbers do not
claim chronological test order. New records receive numbers from the database,
including inserts made by the simulator or another client. Filtering, sorting,
deleting another record, and server restarts do not renumber existing records.
Gaps are allowed; sequence numbers are not a count of records. An identity
column and update trigger prevent ordinary writes from replacing a number.

UUID primary keys, foreign keys, device identifiers, timestamps, measurements,
sample references, and all existing research values remain intact. The atomic
migration briefly locks only these eight tables and compares their original
row contents before and after adding numbers; any unexpected data change rolls
back the migration. It does not issue record updates during backfill, so
existing timestamp/audit triggers are not fired. Existing RLS policies remain
unchanged; sequence access is explicitly granted to the backend service role.

`backend/supabase/tests/readable_display_ids.sql` tests numbering, uniqueness,
immutability, and non-reuse using a temporary table and rolls back. It does not
change saved research records or their sequences. Database row aliases in
`backend/src/types/db.ts` describe the additive column and joined references
without editing the older generated schema snapshot.

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
