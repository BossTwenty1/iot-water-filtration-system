-- Review/apply separately. Existing profiles are not promoted, reset or normalized.
alter table public.profiles alter column role set default 'Viewer';
alter table public.profiles alter column status set default 'Inactive';
alter table public.profiles add column deletion_requested_by uuid;
alter table public.profiles add constraint profiles_rbac_role check
  (role is not null and role in ('Super Administrator', 'Administrator', 'Researcher', 'Viewer')) not valid;
alter table public.profiles add constraint profiles_rbac_status check
  (status in ('Active', 'Inactive')) not valid;
-- Even an accidentally permissive existing policy must not permit client role writes.
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
revoke truncate on public.profiles from service_role;

create table public.account_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  target_id uuid not null,
  action text not null check (action in ('auth_created', 'create', 'role', 'status', 'deletion_requested', 'delete', 'super_provision')),
  old_role text,
  new_role text,
  old_status text,
  new_status text,
  reason text,
  created_at timestamptz not null default now()
);
create index account_audit_created_idx on public.account_audit (created_at desc, id);
alter table public.account_audit enable row level security;
revoke all on public.account_audit from anon, authenticated;
revoke insert, update, delete, truncate on public.account_audit from service_role;
grant select on public.account_audit to service_role;

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Client-controlled metadata supplies a display name only, never privileges.
  insert into public.profiles (id, email, full_name, role, status)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'Viewer', 'Inactive')
  on conflict (id) do nothing;
  return new;
end;
$$;

create function public.guard_profile_rbac()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize profile changes before counting active Super Administrators.
  lock table public.profiles in share row exclusive mode;
  if tg_op <> 'DELETE' then
    if new.role is null or new.role not in ('Super Administrator', 'Administrator', 'Researcher', 'Viewer')
      or new.status not in ('Active', 'Inactive') then
      raise exception using errcode = '22023', message = 'Invalid account role or status';
    end if;
    if new.role = 'Super Administrator' and (tg_op = 'INSERT' or old.role is distinct from new.role)
      and coalesce(current_setting('rbac.super_provision', true), '') <> 'yes' then
      raise exception using errcode = '42501', message = 'Use secured Super Administrator provisioning';
    end if;
    if tg_op = 'UPDATE' and old.deletion_requested_by is not null
      and (new.status <> 'Inactive' or new.role is distinct from old.role or new.deletion_requested_by is distinct from old.deletion_requested_by) then
      raise exception using errcode = '42501', message = 'Account deletion is pending';
    end if;
  end if;
  if tg_op <> 'INSERT' and old.role = 'Super Administrator' and old.status = 'Active'
    and (tg_op = 'DELETE' or new.role is distinct from old.role or new.status <> 'Active')
    and not exists (select 1 from public.profiles where id <> old.id and role = 'Super Administrator' and status = 'Active') then
    raise exception using errcode = '42501', message = 'Cannot remove the last active Super Administrator';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger profiles_rbac_guard before insert or update or delete on public.profiles
for each row execute function public.guard_profile_rbac();

create function public.audit_profile_rbac()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor uuid := nullif(current_setting('rbac.actor_id', true), '')::uuid;
begin
  if tg_op = 'INSERT' then
    insert into public.account_audit (actor_id,target_id,action,new_role,new_status)
    values (actor,new.id,'auth_created',new.role,new.status);
  elsif tg_op = 'DELETE' then
    insert into public.account_audit (actor_id,target_id,action,old_role,old_status)
    values (coalesce(old.deletion_requested_by,actor),old.id,'delete',old.role,old.status);
  else
    if old.role is distinct from new.role then
      insert into public.account_audit (actor_id,target_id,action,old_role,new_role,old_status,new_status)
      values (actor,new.id,'role',old.role,new.role,old.status,new.status);
    end if;
    if old.status is distinct from new.status then
      insert into public.account_audit (actor_id,target_id,action,old_role,new_role,old_status,new_status)
      values (actor,new.id,'status',old.role,new.role,old.status,new.status);
    end if;
  end if;
  return null;
end;
$$;
create trigger profiles_rbac_audit after insert or update or delete on public.profiles
for each row execute function public.audit_profile_rbac();

create function public.manage_account(p_actor_id uuid, p_target_id uuid, p_action text, p_value text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; target public.profiles;
begin
  lock table public.profiles in share row exclusive mode;
  select * into actor from public.profiles where id = p_actor_id;
  select * into target from public.profiles where id = p_target_id;
  if target.id is null then raise exception using errcode = 'P0002', message = 'Account not found'; end if;
  if actor.id is null or actor.status <> 'Active' or actor.role is null or actor.role not in ('Administrator', 'Super Administrator')
    or actor.id = target.id or target.role is null or target.role not in ('Administrator','Researcher','Viewer') then
    raise exception using errcode = '42501', message = 'Account management denied';
  end if;
  if actor.role = 'Administrator' and (target.role not in ('Researcher','Viewer')
    or (p_action in ('role','create') and p_value not in ('Researcher','Viewer'))) then
    raise exception using errcode = '42501', message = 'Administrator cannot manage privileged accounts';
  end if;
  if p_action not in ('create','role','status','delete') or p_action is null then
    raise exception using errcode = '22023', message = 'Invalid account action';
  end if;
  if p_action in ('role','create') and (p_value is null or p_value not in ('Administrator','Researcher','Viewer')) then
    raise exception using errcode = '22023', message = 'Invalid managed role';
  end if;
  if p_action = 'status' and (p_value is null or p_value not in ('Active','Inactive')) then
    raise exception using errcode = '22023', message = 'Invalid account status';
  end if;
  if target.deletion_requested_by is not null and p_action <> 'delete' then
    raise exception using errcode = '42501', message = 'Account deletion is pending';
  end if;
  perform set_config('rbac.actor_id',p_actor_id::text,true);
  if p_action = 'create' then
    if target.status <> 'Inactive' or target.role <> 'Viewer' then
      raise exception using errcode = '42501', message = 'Account is already provisioned';
    end if;
    update public.profiles set role = p_value, status = 'Active' where id = target.id;
    insert into public.account_audit (actor_id,target_id,action,new_role,new_status)
    values (actor.id,target.id,'create',p_value,'Active');
  elsif p_action = 'role' then
    update public.profiles set role = p_value where id = target.id;
  elsif p_action = 'status' then
    update public.profiles set status = p_value where id = target.id;
  elsif target.deletion_requested_by is null then
    update public.profiles set status = 'Inactive', deletion_requested_by = actor.id where id = target.id;
    insert into public.account_audit (actor_id,target_id,action,old_role,new_role,old_status,new_status)
    values (actor.id,target.id,'deletion_requested',target.role,target.role,target.status,'Inactive');
  end if;
  select * into target from public.profiles where id = p_target_id;
  return to_jsonb(target);
end;
$$;

create function public.provision_super_administrator(p_target_id uuid, p_reason text, p_authorizer_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare target public.profiles;
begin
  lock table public.profiles in share row exclusive mode;
  if p_reason is null or length(trim(p_reason)) < 8 or length(p_reason) > 500 then
    raise exception using errcode = '22023', message = 'Explicit provisioning reason required';
  end if;
  select * into target from public.profiles where id = p_target_id;
  if target.id is null or target.deletion_requested_by is not null
    or not exists (select 1 from auth.users where id = target.id and email_confirmed_at is not null) then
    raise exception using errcode = '42501', message = 'Confirmed non-pending account required';
  end if;
  if target.role = 'Super Administrator' and target.status = 'Active' then return to_jsonb(target); end if;
  if p_authorizer_id is not null and not exists
    (select 1 from public.profiles where id = p_authorizer_id and role = 'Super Administrator' and status = 'Active') then
    raise exception using errcode = '42501', message = 'Invalid provisioning authorizer';
  end if;
  if exists (select 1 from public.profiles where role = 'Super Administrator' and status = 'Active')
    and not exists (select 1 from public.profiles where id = p_authorizer_id and role = 'Super Administrator' and status = 'Active') then
    raise exception using errcode = '42501', message = 'Existing Super Administrator authorization required';
  end if;
  perform set_config('rbac.actor_id', coalesce(p_authorizer_id::text,''),true);
  perform set_config('rbac.super_provision','yes',true);
  update public.profiles set role = 'Super Administrator', status = 'Active' where id = target.id;
  perform set_config('rbac.super_provision','',true);
  insert into public.account_audit (actor_id,target_id,action,old_role,new_role,old_status,new_status,reason)
  values (p_authorizer_id,target.id,'super_provision',target.role,'Super Administrator',target.status,'Active',trim(p_reason));
  select * into target from public.profiles where id = p_target_id;
  return to_jsonb(target);
end;
$$;

revoke all on function public.manage_account(uuid,uuid,text,text) from public, anon, authenticated;
revoke all on function public.provision_super_administrator(uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.guard_profile_rbac() from public, anon, authenticated;
revoke all on function public.audit_profile_rbac() from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
grant execute on function public.manage_account(uuid,uuid,text,text) to service_role;
grant execute on function public.provision_super_administrator(uuid,text,uuid) to service_role;
