-- Enables Row-Level Security on every application table.
--
-- backend/docs/SCHEMA_TBD_LOG.md flagged this as "Not implemented at all...
-- every table is currently wide open to any role with API/DB access. Must
-- be addressed before this schema is exposed to anything beyond local
-- development." Confirmed locally before writing this migration: with RLS
-- disabled, `anon`/`authenticated` both hold full `arwdDxtm` (select/
-- insert/update/delete/...) grants on every table via Supabase's default
-- schema privileges — meaning the public anon key alone is enough to read
-- or write any row directly through PostgREST, completely bypassing this
-- Express API's `requireAuth`/`requireRole`/`requireDeviceKey` checks.
--
-- Enabling RLS with zero policies makes every table deny-by-default for
-- `anon`/`authenticated` (reads return empty, writes are rejected), while
-- `service_role` — what src/config/supabaseClient.ts's `supabaseAdmin`
-- client authenticates as, i.e. 100% of this backend's database access —
-- is entirely unaffected, since `service_role` has BYPASSRLS. No
-- fine-grained policies are added here: this is a security floor, not a
-- permissions design (see PENDING_DECISIONS.md "user authorization",
-- still open) — per-role policies can be layered on once that's decided.
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.sensors enable row level security;
alter table public.test_runs enable row level security;
alter table public.calibration_records enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.alerts enable row level security;
alter table public.alert_state_changes enable row level security;
alter table public.laboratory_validation_records enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.maintenance_reminders enable row level security;
alter table public.app_settings enable row level security;
alter table public.thresholds enable row level security;
alter table public.notification_providers enable row level security;
alter table public.data_retention_policy enable row level security;
