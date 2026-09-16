# Schema TBD Log

> Companion to migration `supabase/migrations/20260916110448_initial_schema.sql`,
> which implements [DATABASE_SCHEMA_DRAFT.md](DATABASE_SCHEMA_DRAFT.md) as-is.
> This log tracks every place that migration left a field unconstrained
> because the underlying decision is still open, so the gap doesn't get lost
> once the schema is in the database. Cross-references are to
> `docs/PENDING_DECISIONS.md` at the repo root.

## What was implemented

All 9 tables from `DATABASE_SCHEMA_DRAFT.md`, with the same columns, types,
and foreign keys described there. No CHECK constraints, RLS policies, or
enum types were added — every "confirmed set" or "TBD" column from the draft
was implemented as plain `text` or `jsonb` so nothing had to be guessed.

## Open items carried over as unconstrained columns

| Table.column | Currently | Resolve via |
| --- | --- | --- |
| `sensors.category` | free `text` | REQUIREMENTS.md already confirms the set (ph, turbidity, tds, temperature, flow_rate) — add a CHECK or enum once the team wants it enforced |
| `sensors.position` | free `text` | REQUIREMENTS.md already confirms the set (pre_filtration, post_filtration) — same as above |
| `sensor_readings.reading_status` | free `text` | PENDING_DECISIONS §3 — per-sensor validity rule not decided |
| `test_runs.status` | free `text` | PENDING_DECISIONS §5 — cycle-completion logic (1 L target vs. timeout) not decided |
| `alerts.category` | free `text` | PENDING_DECISIONS §4 — alert taxonomy not decided |
| `alerts.severity` | free `text` | PENDING_DECISIONS §4 — severity scale not decided |
| `alerts.status` | free `text` | PENDING_DECISIONS §4 — lifecycle (open/acknowledged/resolved?) not decided |
| `profiles.role` | free `text` | PENDING_DECISIONS §9 — roles/permissions not decided |
| `calibration_records.parameters` | `jsonb`, no shape | PENDING_DECISIONS §12 — calibration formula/factors not decided |
| `laboratory_validation_records.results` | `jsonb`, no shape | PENDING_DECISIONS §12 — required lab fields not decided |
| `laboratory_validation_records.percentage_error` | `numeric`, formula unconfirmed | PENDING_DECISIONS §12 |

## Not implemented at all

- **Row-Level Security** — no policies exist on any table; every table is
  currently wide open to any role with API/DB access. Must be addressed
  before this schema is exposed to anything beyond local development.
  (PENDING_DECISIONS §11)
- **Data retention / backup strategy** (PENDING_DECISIONS §11)
- **Device authentication mechanism** — `devices.device_identifier` has no
  enforced link to how an ESP32/simulator proves its identity.
  (PENDING_DECISIONS §8)
- **Offline buffering / idempotency handling** for `sensor_readings` inserts
  (PENDING_DECISIONS §7)
- **Remote command delivery, expiration, or audit table** — no table exists
  for this yet. (PENDING_DECISIONS §10)
- **Device online/offline status** — deliberately not a stored column; per
  the draft, this should be derived from `sensor_readings.received_at` once
  a timeout rule is decided. (PENDING_DECISIONS §6)

## Next steps

1. Push this migration to the local Supabase instance (`npx supabase db
   reset` or `npx supabase migration up`) to unblock backend development.
2. Resolve items in `PENDING_DECISIONS.md` as the team firms them up.
3. Add follow-up migrations for CHECK constraints, RLS policies, and any new
   tables (e.g. remote commands) rather than editing this migration in place,
   once those decisions land.
