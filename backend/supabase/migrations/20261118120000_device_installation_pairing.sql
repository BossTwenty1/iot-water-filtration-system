-- Two-board pairing (docs/TWO_BOARD_SYNC_AND_MERGE.md, Fix 2a).
--
-- The installation runs one board per filtration stage (pre and post), each
-- registered as its own device. Devices that share an installation_id are the
-- boards of one filtration unit, so GET /telemetry can merge their
-- before/after cycles into one row. NULL keeps today's per-device rows.
--
-- No existing device is paired by this migration: which boards belong
-- together is an operational decision (see scripts/pairDevices.ts).

alter table public.devices add column installation_id uuid;

create index devices_installation_id_idx on public.devices (installation_id)
    where installation_id is not null;

comment on column public.devices.installation_id is
    'Groups the pre- and post-filtration boards of one filtration unit. NULL = unpaired.';
