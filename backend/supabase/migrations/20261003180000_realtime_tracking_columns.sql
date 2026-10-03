-- Migration: Add updated_at tracking columns and triggers for real-time synchronization

create or replace function public.set_updated_at_timestamp()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- 1. alerts: track both creation and status changes (Active -> Acknowledged -> Resolved)
alter table public.alerts
    add column if not exists updated_at timestamptz not null default now();

create index if not exists alerts_updated_at_idx on public.alerts (updated_at);

drop trigger if exists set_alerts_updated_at on public.alerts;
create trigger set_alerts_updated_at
    before update on public.alerts
    for each row execute function public.set_updated_at_timestamp();

-- 2. devices: track connection_state and last_seen_at heartbeat changes
alter table public.devices
    add column if not exists updated_at timestamptz not null default now();

create index if not exists devices_updated_at_idx on public.devices (updated_at);

drop trigger if exists set_devices_updated_at on public.devices;
create trigger set_devices_updated_at
    before update on public.devices
    for each row execute function public.set_updated_at_timestamp();

-- 3. test_runs: track status, duration, and volume updates
alter table public.test_runs
    add column if not exists updated_at timestamptz not null default now();

create index if not exists test_runs_updated_at_idx on public.test_runs (updated_at);

drop trigger if exists set_test_runs_updated_at on public.test_runs;
create trigger set_test_runs_updated_at
    before update on public.test_runs
    for each row execute function public.set_updated_at_timestamp();
