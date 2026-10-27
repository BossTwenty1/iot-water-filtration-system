-- Isolated checks: no saved records or their sequences are changed.
begin;
create temporary table display_id_check
    (like public.test_runs including defaults including generated including identity including constraints including indexes);
create trigger keep_display_number before update of display_number on display_id_check
    for each row execute function public.keep_display_number();

insert into display_id_check (device_id) values (gen_random_uuid()), (gen_random_uuid());
do $$
begin
    if (select array_agg(display_number order by display_number) from display_id_check) <> array[1,2]::bigint[] then
        raise exception 'New records did not get distinct sequential numbers.';
    end if;
    begin
        update display_id_check set display_number = 100 where display_number = 1;
        raise exception 'Display number was allowed to change.';
    exception when check_violation or sqlstate '428C9' then null;
    end;
    begin
        insert into display_id_check (device_id, display_number) overriding system value values (gen_random_uuid(), 1);
        raise exception 'A duplicate display number was allowed.';
    exception when unique_violation then null;
    end;
end;
$$;
delete from display_id_check where display_number = 2;
insert into display_id_check (device_id) values (gen_random_uuid());
do $$
begin
    if (select max(display_number) from display_id_check) <> 3 then
        raise exception 'A deleted display number was reused.';
    end if;
    begin
        update display_id_check set display_number = default where display_number = 1;
        raise exception 'Resetting an existing display number was allowed.';
    exception when check_violation then null;
    end;
end;
$$;
rollback;
