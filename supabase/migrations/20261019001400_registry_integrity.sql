-- Cadastros: evolução aditiva. Dados legados precisam de saneamento antes de VALIDATE.
alter table public.branches add column archived_at timestamptz;
create unique index category_name_normalized on public.vehicle_categories(lower(btrim(name)));
create unique index branches_name_normalized on public.branches(lower(btrim(name)));
create unique index vehicles_renavam_unique on public.vehicles(renavam) where renavam is not null;

create function app_private.valid_br_address(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(value)='object' and value->>'postal_code' ~ '^[0-9]{8}$'
    and length(btrim(value->>'street')) between 1 and 160
    and length(btrim(value->>'number')) between 1 and 20
    and length(btrim(value->>'district')) between 1 and 100
    and length(btrim(value->>'city')) between 1 and 100
    and value->>'state'=any(array['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']),false);
$$;
revoke all on function app_private.valid_br_address(jsonb) from public,anon,authenticated,service_role;
grant execute on function app_private.valid_br_address(jsonb) to authenticated,service_role;
alter table public.customers add constraint customer_br_address check(app_private.valid_br_address(address)) not valid;
alter table public.branches add constraint branch_br_address check(app_private.valid_br_address(address)) not valid;
alter table public.drivers add constraint license_not_repeated check(license_number !~ '^([0-9])\1{10}$') not valid;
alter table public.vehicles add constraint fleet_classification check(fuel in ('FLEX','GASOLINE','ETHANOL','DIESEL','ELECTRIC','HYBRID','CNG') and transmission in ('MANUAL','AUTOMATIC','CVT')) not valid;

create function app_private.guard_registry() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.id<>old.id then raise exception using errcode='23514',message='Registry identity is immutable'; end if;
    if old.archived_at is not null and new.archived_at is not null
      and (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then
      raise exception using errcode='23514',message='Restore archived registry before editing';
    end if;
  end if;
  if tg_table_name='vehicles' then
    if tg_op='UPDATE' then
      if new.mileage<old.mileage then raise exception using errcode='23514',message='Mileage cannot decrease'; end if;
      if row(new.category_id,new.branch_id,new.archived_at,new.operational_status) is distinct from row(old.category_id,old.branch_id,old.archived_at,old.operational_status)
        and (exists(select 1 from public.vehicle_allocations where vehicle_id=old.id and released_at is null and upper(period)>now())
          or exists(select 1 from public.rentals where vehicle_id=old.id and status in ('PREPARING','ACTIVE','OVERDUE'))) then
        raise exception using errcode='23514',message='Vehicle has current or future commitments';
      end if;
    end if;
    if new.archived_at is null then
      perform 1 from public.vehicle_categories where id=new.category_id and active and archived_at is null for share;
      if not found then raise exception using errcode='23514',message='Category unavailable'; end if;
      perform 1 from public.branches where id=new.branch_id and active and archived_at is null for share;
      if not found then raise exception using errcode='23514',message='Branch unavailable'; end if;
    end if;
  elsif tg_table_name='vehicle_categories' then
    if new.archived_at is not null or not new.active then
      if exists(select 1 from public.vehicles where category_id=new.id and archived_at is null) then
        raise exception using errcode='23514',message='Category has unarchived vehicles';
      end if;
    end if;
  elsif tg_table_name='branches' then
    if new.archived_at is not null or not new.active then
      if exists(select 1 from public.vehicles where branch_id=new.id and archived_at is null) then
        raise exception using errcode='23514',message='Branch has unarchived vehicles';
      end if;
    end if;
  elsif tg_table_name='customers' then
    if new.birth_date>current_date then raise exception using errcode='23514',message='Invalid birth date'; end if;
    if new.archived_at is not null and (
      exists(select 1 from public.drivers where customer_id=new.id and archived_at is null)
      or exists(select 1 from public.reservations where customer_id=new.id and status in ('REQUESTED','UNDER_REVIEW','CONFIRMED'))
      or exists(select 1 from public.rentals where customer_id=new.id and status in ('PREPARING','ACTIVE','OVERDUE'))) then
      raise exception using errcode='23514',message='Customer has active dependencies';
    end if;
  elsif tg_table_name='drivers' then
    if new.archived_at is null then
      perform 1 from public.customers where id=new.customer_id and archived_at is null for share;
      if not found then raise exception using errcode='23514',message='Customer unavailable'; end if;
    elsif exists(select 1 from public.rental_drivers d join public.rentals r on r.id=d.rental_id where d.driver_id=new.id and r.status in ('PREPARING','ACTIVE','OVERDUE')) then
      raise exception using errcode='23514',message='Driver has active rental';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_registry() from public,anon,authenticated,service_role;
create trigger registry_guard before insert or update on public.vehicle_categories for each row execute function app_private.guard_registry();
create trigger registry_guard before insert or update on public.vehicles for each row execute function app_private.guard_registry();
create trigger registry_guard before insert or update on public.customers for each row execute function app_private.guard_registry();
create trigger registry_guard before insert or update on public.drivers for each row execute function app_private.guard_registry();
create trigger registry_guard before insert or update on public.branches for each row execute function app_private.guard_registry();

-- Travas compartilhadas de pais serializam vínculo novo contra arquivamento.
create function app_private.guard_registry_reference() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name in ('reservations','rentals') then
    if new.status in ('REQUESTED','UNDER_REVIEW','CONFIRMED','PREPARING','ACTIVE','OVERDUE') then
      perform 1 from public.customers where id=new.customer_id and archived_at is null for share;
      if not found then raise exception using errcode='23514',message='Customer archived'; end if;
    end if;
  elsif tg_table_name='vehicle_allocations' and new.released_at is null then
    perform 1 from public.vehicles where id=new.vehicle_id and archived_at is null and operational_status<>'RETIRED'
      and (new.kind in ('BLOCK','MAINTENANCE') or operational_status='ACTIVE') for share;
    if not found then raise exception using errcode='23514',message='Vehicle unavailable'; end if;
  elsif tg_table_name='rental_drivers' then
    perform 1 from public.drivers where id=new.driver_id and archived_at is null for share;
    if not found then raise exception using errcode='23514',message='Driver archived'; end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_registry_reference() from public,anon,authenticated,service_role;
create trigger registry_reference before insert or update on public.reservations for each row execute function app_private.guard_registry_reference();
create trigger registry_reference before insert or update on public.rentals for each row execute function app_private.guard_registry_reference();
create trigger registry_reference before insert or update on public.vehicle_allocations for each row execute function app_private.guard_registry_reference();
create trigger registry_reference before insert or update on public.rental_drivers for each row execute function app_private.guard_registry_reference();
