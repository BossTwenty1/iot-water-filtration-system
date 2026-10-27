-- Permanent display numbers supplement UUIDs; no primary/foreign key changes.
begin;
set local lock_timeout = '5s';

lock table public.devices, public.test_runs, public.alerts,
    public.calibration_records, public.laboratory_validation_records,
    public.maintenance_records, public.maintenance_reminders, public.profiles
    in access exclusive mode;

create function public.keep_display_number()
returns trigger language plpgsql set search_path = '' as $$
begin
    if new.display_number is distinct from old.display_number then
        raise exception 'A record display number cannot be changed.' using errcode = '23514';
    end if;
    return new;
end;
$$;
revoke all on function public.keep_display_number() from public, anon, authenticated;

do $$
declare
    record_table text;
    before_data text;
    after_data text;
begin
    foreach record_table in array array[
        'devices', 'test_runs', 'alerts', 'calibration_records',
        'laboratory_validation_records', 'maintenance_records',
        'maintenance_reminders', 'profiles'
    ] loop
        execute format(
            'select md5(coalesce(string_agg(to_jsonb(t)::text, '''' order by id), '''')) from public.%I t',
            record_table
        ) into before_data;

        -- Adding the identity column numbers existing rows without firing their
        -- UPDATE triggers (which could otherwise change research timestamps).
        execute format(
            'alter table public.%1$I
                add column display_number bigint generated always as identity,
                add constraint %2$I unique (display_number)',
            record_table, record_table || '_display_number_key'
        );
        execute format(
            'grant usage, select on sequence %s to service_role',
            pg_catalog.pg_get_serial_sequence('public.' || record_table, 'display_number')
        );
        execute format(
            'create trigger keep_display_number before update of display_number on public.%I
             for each row execute function public.keep_display_number()', record_table
        );

        execute format(
            'select md5(coalesce(string_agg((to_jsonb(t) - ''display_number'')::text, '''' order by id), '''')) from public.%I t',
            record_table
        ) into after_data;
        if before_data is distinct from after_data then
            raise exception 'Existing data changed unexpectedly in %; rolling back.', record_table;
        end if;
    end loop;
end;
$$;

notify pgrst, 'reload schema';
commit;
