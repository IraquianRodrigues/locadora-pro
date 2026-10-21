create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  active boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('ADMIN','MANAGER','ATTENDANT','FINANCE')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.permissions (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id),
  role_id uuid not null references public.roles(id), unique(user_id,role_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.user_roles(role_id);
create table public.role_permissions (
  id uuid primary key default gen_random_uuid(), role_id uuid not null references public.roles(id),
  permission_id uuid not null references public.permissions(id), unique(role_id,permission_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.role_permissions(permission_id);

create function app_private.has_permission(permission_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.user_roles ur on ur.user_id = p.id
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions perm on perm.id = rp.permission_id
    where p.id = (select auth.uid()) and p.active and perm.code = permission_code
  );
$$;
grant execute on function app_private.has_permission(text) to authenticated;
create function public.has_permission(permission_code text) returns boolean
language sql stable security invoker set search_path = '' as $$
  select app_private.has_permission(permission_code);
$$;
revoke all on function public.has_permission(text) from public,anon,service_role;
grant execute on function public.has_permission(text) to authenticated;

insert into public.roles(code) values ('ADMIN'),('MANAGER'),('ATTENDANT'),('FINANCE');
insert into public.permissions(code)
select unnest(array[
  'users.manage','settings.manage','operations.read','finance.read',
  'vehicles.read','vehicles.write','categories.read','categories.write',
  'customers.read','customers.write','drivers.read','drivers.write','documents.read','documents.write',
  'pricing.read','pricing.write','discounts.authorize',
  'reservations.read','reservations.request','reservations.review','reservations.approve',
  'reservations.cancel_pending','reservations.cancel_confirmed',
  'rentals.read','rentals.create','rentals.checkout','rentals.checkin','rentals.extend',
  'inspections.read','inspections.write','contracts.read','contracts.generate',
  'charges.create','payments.confirm','refunds.create','deposits.manage','expenses.write',
  'maintenance.read','maintenance.write','blocks.write',
  'reports.operations','reports.finance','audit.operations','audit.finance'
]);
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code = 'ADMIN'
or (r.code = 'MANAGER' and p.code not in ('users.manage','settings.manage'))
or (r.code = 'ATTENDANT' and p.code = any(array[
 'operations.read','vehicles.read','categories.read','customers.read','customers.write','drivers.read','drivers.write',
 'documents.read','documents.write','pricing.read','reservations.read','reservations.request','reservations.review',
 'reservations.cancel_pending','rentals.read','rentals.create','rentals.checkout','rentals.checkin',
 'inspections.read','inspections.write','contracts.read','contracts.generate','maintenance.read']))
or (r.code = 'FINANCE' and p.code = any(array[
 'finance.read','categories.read','pricing.read','charges.create','payments.confirm','refunds.create',
 'deposits.manage','expenses.write','reports.finance','audit.finance']));

select app_private.secure_table('profiles',null);
grant select on public.profiles to authenticated;
create policy profile_read on public.profiles for select to authenticated
using ((id = (select auth.uid()) and active) or (select app_private.has_permission('users.manage')));
select app_private.secure_table('roles','users.manage');
select app_private.secure_table('permissions','users.manage');
select app_private.secure_table('user_roles','users.manage');
select app_private.secure_table('role_permissions','users.manage');

create function app_private.create_inactive_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name,active) values(new.id,'Funcionário',false);
  return new;
end;
$$;
create trigger create_inactive_profile after insert on auth.users
for each row execute function app_private.create_inactive_profile();

create table public.branches (
  id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) > 0),
  address jsonb not null check(jsonb_typeof(address) = 'object'), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('branches','operations.read','settings.manage');
create table public.company_settings (
  id uuid primary key default gen_random_uuid(), singleton boolean not null default true unique check(singleton),
  legal_name text not null, tax_document text not null check(app_private.valid_cnpj(tax_document)),
  timezone text not null default 'America/Fortaleza', currency text not null default 'BRL' check(currency = 'BRL'),
  contact jsonb not null default '{}' check(jsonb_typeof(contact) = 'object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create function app_private.validate_timezone() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists(select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using errcode='23514',message='Invalid IANA timezone';
  end if;
  return new;
end;
$$;
create trigger valid_timezone before insert or update on public.company_settings
for each row execute function app_private.validate_timezone();
select app_private.secure_table('company_settings','settings.manage','settings.manage');
create table public.system_settings (
  id uuid primary key default gen_random_uuid(), key text not null unique,
  value jsonb not null, version integer not null default 1 check(version > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('system_settings','settings.manage','settings.manage');

-- A preservação do último ADMIN é serializada antes de qualquer alteração de acesso.
create function app_private.lock_staff_access() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(187640,1);
  if exists(select 1 from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.id=ur.role_id where p.active and r.code='ADMIN') then
    perform set_config('app.had_admin','true',true);
  end if;
  return coalesce(new,old);
end;
$$;
create trigger lock_staff_access before insert or update or delete on public.user_roles
for each row execute function app_private.lock_staff_access();
create trigger lock_staff_access before update or delete on public.profiles
for each row execute function app_private.lock_staff_access();
create function app_private.preserve_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('app.had_admin',true)='true' and not exists(select 1 from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.id=ur.role_id where p.active and r.code='ADMIN') then
    raise exception using errcode='23514',message='Cannot revoke last active administrator';
  end if;
  return null;
end;
$$;
create constraint trigger preserve_last_admin after update or delete on public.profiles
deferrable initially deferred for each row execute function app_private.preserve_last_admin();
create constraint trigger preserve_last_admin after update or delete on public.user_roles
deferrable initially deferred for each row execute function app_private.preserve_last_admin();
revoke execute on all functions in schema app_private from public;
