-- Support tables for the Express API implemented against
-- backend/docs/plans/API ROUTES PLAN.md.
--
-- The 9 tables in 20260916110448_initial_schema.sql cover the domains listed
-- in backend/docs/DATABASE.md (devices, sensors, readings, test runs,
-- alerts, calibration, laboratory validation). The frontend pages this API
-- serves also need Maintenance, Settings, and richer Device/User metadata,
-- which are not part of that approved domain list. This migration adds only
-- the minimum columns/tables to satisfy those routes, keeping every
-- business-rule field (taxonomies, thresholds, formulas) as free-form
-- text/jsonb, consistent with backend/docs/SCHEMA_TBD_LOG.md — nothing here
-- decides an item still marked TBD in docs/PENDING_DECISIONS.md.

-- 1. profiles: add display metadata used by the Users page and Header.
alter table public.profiles
    add column full_name text,
    add column email text,
    add column status text not null default 'Active';

-- Auto-create a profile row whenever a Supabase Auth user is created, so
-- POST /auth/login and admin user-creation always have somewhere to attach
-- role/name/status. Role/status default only to unblock the row insert —
-- not a permissions decision.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, full_name, role, status)
    values (
        new.id,
        new.email,
        new.raw_user_meta_data ->> 'full_name',
        coalesce(new.raw_user_meta_data ->> 'role', 'Viewer'),
        'Active'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_auth_user();

-- 1b. alerts: the Alerts page needs a human-readable source/title/message
-- per alert, which the approved schema left out (it only has the
-- category/severity/status taxonomy columns, all still TBD per
-- PENDING_DECISIONS §4). These are free text, not a taxonomy decision.
alter table public.alerts
    add column source text,
    add column title text,
    add column message text,
    add column test_run_id uuid references public.test_runs (id) on delete set null;

create index alerts_test_run_id_idx on public.alerts (test_run_id);

-- 2. devices: status/config fields needed by Settings > Device Status and
-- the "Pending Hardware Integration" placeholders already in the UI.
alter table public.devices
    add column controller_name text,
    add column connection_state text not null default 'Pending Hardware Integration',
    add column wifi_state text not null default 'Not Configured',
    add column fail_safe_state text not null default 'Pending Hardware Integration',
    add column last_seen_at timestamptz,
    add column config jsonb not null default '{}'::jsonb;

-- 3. maintenance_records
create table public.maintenance_records (
    id uuid primary key default gen_random_uuid(),
    component text not null,
    type text,
    description text,
    status text,
    performed_by uuid references public.profiles (id) on delete set null,
    notes text,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);

create index maintenance_records_occurred_at_idx on public.maintenance_records (occurred_at);

-- 4. maintenance_reminders
create table public.maintenance_reminders (
    id uuid primary key default gen_random_uuid(),
    component text not null,
    label text not null,
    due_date date,
    status text not null default 'Upcoming',
    dismissed_at timestamptz,
    created_at timestamptz not null default now()
);

-- 5. app_settings: singleton row (id is always 1).
create table public.app_settings (
    id smallint primary key default 1,
    system_name text,
    device_display_name text,
    timezone text,
    date_format text,
    time_format text,
    notifications jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    constraint app_settings_singleton check (id = 1)
);

-- 6. thresholds: one row per parameter/stage pair; content shape is TBD
-- (PENDING_DECISIONS "approved thresholds"), stored as jsonb on purpose.
-- stage defaults to '' (not null) rather than nullable, so a plain
-- (parameter, stage) unique constraint can back PostgREST's upsert
-- on_conflict target — Postgres treats NULL as distinct in unique
-- constraints, which would defeat de-duplication for parameter-level
-- (no-stage) thresholds otherwise.
create table public.thresholds (
    id uuid primary key default gen_random_uuid(),
    parameter text not null,
    stage text not null default '',
    config jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    unique (parameter, stage)
);

-- 7. notification_providers: SMS/notification integration config (TBD per
-- PENDING_DECISIONS "SMS provider"), stored as jsonb on purpose.
create table public.notification_providers (
    id uuid primary key default gen_random_uuid(),
    provider text not null unique,
    enabled boolean not null default false,
    config jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now()
);

-- 8. data_retention_policy: singleton row (id is always 1).
create table public.data_retention_policy (
    id smallint primary key default 1,
    retention_days integer,
    config jsonb not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    constraint data_retention_policy_singleton check (id = 1)
);
