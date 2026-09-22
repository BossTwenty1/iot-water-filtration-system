# Database

## Target

The planned persistence layer is Supabase PostgreSQL. No Supabase project,
database migration, seed data, or generated types are included in Phase 1.

The normal database path is:

`ESP32 or React -> Express API -> Supabase PostgreSQL`

## Planned data domains

The eventual schema is expected to cover these domains, subject to approval:

- devices and device status;
- sensor definitions and sensor positions;
- time-series readings for pH, turbidity, TDS, temperature, and flow rate;
- test runs;
- alerts and alert state changes;
- calibration records;
- laboratory validation records; and
- export/audit context where required.

These are domain boundaries, not a finalized schema. Table names, columns,
relationships, retention, indexing, access policies, and migration strategy are
`TBD`.

## Data integrity principles

- Preserve whether a reading came from the pre-filtration or post-filtration
  sensor position.
- Preserve measurement time and device context.
- Keep calibration records separate from laboratory validation records.
- Do not derive a drinking-water safety claim from sensor data alone.
- Keep synthetic development fixtures clearly separated from real project data.
- Define authorization and row-level access before exposing production data.

## Phase 1 boundary

No database service is provisioned and no schema implementation is started.
The database design must be approved after the API and hardware data contract
decisions are resolved.

A structural draft proposal for review is tracked in
[DATABASE_SCHEMA_DRAFT.md](DATABASE_SCHEMA_DRAFT.md), pending team approval.
