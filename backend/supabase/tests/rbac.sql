-- LOCAL DISPOSABLE DATABASE ONLY, after all migrations. Fixtures roll back.
begin;
do $$
declare
  sa uuid := gen_random_uuid(); manager uuid := gen_random_uuid(); target uuid := gen_random_uuid();
  replacement uuid := gen_random_uuid(); audit_count bigint; client_role text;
begin
  if exists (select 1 from public.profiles) then raise exception 'Requires empty disposable local profiles'; end if;
  insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data)
  values (sa,sa::text||'@example.test',now(),'{"role":"Super Administrator"}'::jsonb),
    (manager,manager::text||'@example.test',now(),'{}'),
    (target,target::text||'@example.test',now(),'{"role":"Administrator"}'::jsonb),
    (replacement,replacement::text||'@example.test',now(),'{}');
  if exists (select 1 from public.profiles where role <> 'Viewer' or status <> 'Inactive') then raise exception 'Metadata escalation/default status failed'; end if;
  -- Exercise invalid writes through the installed guard/constraint path.
  begin
    update public.profiles set role='Invalid' where id=target;
    raise exception 'Role constraint accepted invalid role';
  exception when invalid_parameter_value or check_violation then null; end;
  begin
    update public.profiles set role=null where id=target;
    raise exception 'Role constraint accepted null';
  exception when invalid_parameter_value or check_violation then null; end;
  begin
    update public.profiles set status='Invalid' where id=target;
    raise exception 'Status constraint accepted invalid status';
  exception when invalid_parameter_value or check_violation then null; end;
  perform public.provision_super_administrator(sa,'Synthetic initial designation');
  select count(*) into audit_count from public.account_audit;
  perform public.provision_super_administrator(sa,'Synthetic repeated designation');
  if (select count(*) from public.account_audit) <> audit_count then raise exception 'Bootstrap not idempotent'; end if;
  perform public.manage_account(sa,manager,'create','Administrator');
  perform public.manage_account(manager,target,'create','Viewer');
  perform public.manage_account(manager,target,'role','Researcher');
  perform public.manage_account(manager,target,'status','Inactive');
  if not exists (select 1 from public.account_audit where actor_id=manager and target_id=target and action='create')
    or not exists (select 1 from public.account_audit where actor_id=manager and target_id=target and action='role')
    or not exists (select 1 from public.account_audit where actor_id=manager and target_id=target and action='status') then raise exception 'Auditing failed'; end if;
  begin
    perform public.manage_account(manager,target,'role','Administrator');
    raise exception 'Administrator escalated role';
  exception when insufficient_privilege then null; end;
  begin
    perform public.manage_account(manager,manager,'role','Viewer');
    raise exception 'Self-management allowed';
  exception when insufficient_privilege then null; end;
  begin
    perform public.manage_account(manager,sa,'delete');
    raise exception 'Administrator managed Super Administrator';
  exception when insufficient_privilege then null; end;
  begin
    perform public.manage_account(sa,target,'role','Super Administrator');
    raise exception 'Public Super Administrator role allowed';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.manage_account(sa,target,'status','Invalid');
    raise exception 'Invalid status accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.manage_account(target,manager,'status','Inactive');
    raise exception 'Inactive Researcher managed accounts';
  exception when insufficient_privilege then null; end;
  begin
    perform public.provision_super_administrator(replacement,'Unauthorized subsequent designation');
    raise exception 'Subsequent bootstrap lacked authorization';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set status='Inactive' where id=sa;
    raise exception 'Last active Super Administrator deactivated';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set role='Viewer' where id=sa;
    raise exception 'Last active Super Administrator demoted';
  exception when insufficient_privilege then null; end;
  begin
    delete from auth.users where id=sa;
    raise exception 'Last active Super Administrator cascade deleted';
  exception when insufficient_privilege then null; end;
  perform public.manage_account(manager,target,'delete');
  begin
    perform public.manage_account(sa,target,'status','Active');
    raise exception 'Pending deletion reactivated';
  exception when insufficient_privilege then null; end;
  delete from auth.users where id=target;
  if not exists (select 1 from public.account_audit where actor_id=manager and target_id=target and action='delete') then raise exception 'Deletion audit missing'; end if;
  perform public.provision_super_administrator(replacement,'Synthetic approved transfer',sa);
  update public.profiles set role='Viewer',status='Inactive' where id=sa;
  if has_function_privilege('authenticated','public.manage_account(uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('anon','public.provision_super_administrator(uuid,text,uuid)','EXECUTE')
    or has_table_privilege('authenticated','public.account_audit','SELECT')
    or has_table_privilege('service_role','public.account_audit','UPDATE') then raise exception 'Excess privileges'; end if;
  -- Exercise rejected calls as actual database clients, not only ACL inspection.
  foreach client_role in array array['anon','authenticated'] loop
    execute format('set local role %I',client_role);
    begin
      perform public.manage_account(manager,replacement,'delete');
      raise exception 'Unauthorized client executed manage_account';
    exception when insufficient_privilege then null; end;
    begin
      perform public.provision_super_administrator(replacement,'Unauthorized client designation');
      raise exception 'Unauthorized client executed provisioning';
    exception when insufficient_privilege then null; end;
    begin
      update public.profiles set role='Administrator' where id=manager;
      raise exception 'Unauthorized client wrote profile';
    exception when insufficient_privilege then null; end;
    begin
      perform id from public.account_audit limit 1;
      raise exception 'Unauthorized client read audits';
    exception when insufficient_privilege then null; end;
    execute 'reset role';
  end loop;
  execute 'set local role service_role';
  begin
    insert into public.account_audit(target_id,action) values(replacement,'delete');
    raise exception 'Service role forged audit';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
end;
$$;
rollback;
