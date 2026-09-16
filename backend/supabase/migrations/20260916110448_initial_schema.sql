-- Initial schema for the IoT water filtration system.
--
-- Implements the 9 tables from backend/docs/DATABASE_SCHEMA_DRAFT.md as-is.
-- Fields the draft marks TBD (status/severity/category enums, RLS, retention,
-- device auth, remote commands, calibration formulas, etc.) are intentionally
-- left as unconstrained `text`/`jsonb` rather than guessed at. See
-- backend/docs/SCHEMA_TBD_LOG.md for the full list of what remains open and
-- what would need to change once each item is resolved.

-- 1. profiles
-- id mirrors auth.users.id; role/permissions entirely TBD.
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    role text,
    created_at timestamptz not null default now()
);

-- 2. devices
create table public.devices (
    id uuid primary key default gen_random_uuid(),
    device_identifier text not null unique,
    name text,
    is_simulated boolean not null default false,
    created_at timestamptz not null default now()
);

-- 3. sensors
create table public.sensors (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.devices (id) on delete cascade,
    category text not null,
    position text not null,
    unit text,
    created_at timestamptz not null default now()
);

create index sensors_device_id_idx on public.sensors (device_id);

-- 4. test_runs
create table public.test_runs (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.devices (id) on delete cascade,
    status text,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    target_volume_liters numeric,
    notes text,
    created_at timestamptz not null default now()
);

create index test_runs_device_id_idx on public.test_runs (device_id);

-- 5. calibration_records
create table public.calibration_records (
    id uuid primary key default gen_random_uuid(),
    sensor_id uuid not null references public.sensors (id) on delete cascade,
    performed_at timestamptz not null default now(),
    performed_by uuid references public.profiles (id) on delete set null,
    parameters jsonb,
    notes text,
    created_at timestamptz not null default now()
);

create index calibration_records_sensor_id_idx on public.calibration_records (sensor_id);

-- 6. sensor_readings
create table public.sensor_readings (
    id uuid primary key default gen_random_uuid(),
    sensor_id uuid not null references public.sensors (id) on delete cascade,
    device_id uuid not null references public.devices (id) on delete cascade,
    value numeric,
    reading_status text,
    measured_at timestamptz not null,
    received_at timestamptz not null default now(),
    test_run_id uuid references public.test_runs (id) on delete set null,
    calibration_id uuid references public.calibration_records (id) on delete set null,
    created_at timestamptz not null default now()
);

create index sensor_readings_sensor_id_idx on public.sensor_readings (sensor_id);
create index sensor_readings_device_id_idx on public.sensor_readings (device_id);
create index sensor_readings_test_run_id_idx on public.sensor_readings (test_run_id);
create index sensor_readings_measured_at_idx on public.sensor_readings (measured_at);

-- 7. alerts
create table public.alerts (
    id uuid primary key default gen_random_uuid(),
    device_id uuid not null references public.devices (id) on delete cascade,
    sensor_reading_id uuid references public.sensor_readings (id) on delete set null,
    category text,
    severity text,
    status text,
    triggered_at timestamptz not null default now(),
    acknowledged_at timestamptz,
    acknowledged_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now()
);

create index alerts_device_id_idx on public.alerts (device_id);
create index alerts_status_idx on public.alerts (status);

-- 8. alert_state_changes
create table public.alert_state_changes (
    id uuid primary key default gen_random_uuid(),
    alert_id uuid not null references public.alerts (id) on delete cascade,
    from_status text,
    to_status text,
    changed_at timestamptz not null default now(),
    changed_by uuid references public.profiles (id) on delete set null
);

create index alert_state_changes_alert_id_idx on public.alert_state_changes (alert_id);

-- 9. laboratory_validation_records
create table public.laboratory_validation_records (
    id uuid primary key default gen_random_uuid(),
    test_run_id uuid references public.test_runs (id) on delete set null,
    sample_reference text,
    validated_at timestamptz not null default now(),
    lab_reference text,
    results jsonb,
    percentage_error numeric,
    created_at timestamptz not null default now()
);

create index laboratory_validation_records_test_run_id_idx on public.laboratory_validation_records (test_run_id);
