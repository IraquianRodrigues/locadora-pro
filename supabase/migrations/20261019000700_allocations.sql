create table public.vehicle_blocks (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id),
  start_at timestamptz not null, end_at timestamptz not null, reason text not null check(length(btrim(reason)) > 0),
  active boolean not null default true, created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(isfinite(start_at) and isfinite(end_at) and end_at > start_at)
);
create index on public.vehicle_blocks(vehicle_id,start_at);
select app_private.secure_table('vehicle_blocks','vehicles.read');
create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id),
  kind text not null check(kind in ('PREVENTIVE','CORRECTIVE','OIL','TIRES','SERVICE')),
  status text not null default 'SCHEDULED' check(status in ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
  mileage bigint not null check(mileage >= 0), start_at timestamptz not null, end_at timestamptz not null,
  next_due_on date, next_due_mileage bigint check(next_due_mileage >= mileage),
  blocks_availability boolean not null default true, description text not null, responsible_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(isfinite(start_at) and isfinite(end_at) and end_at > start_at), unique(id,vehicle_id)
);
create index on public.maintenance_records(vehicle_id,start_at);
create index on public.maintenance_records(next_due_on) where status <> 'CANCELLED';
select app_private.secure_table('maintenance_records','maintenance.read');
create table public.vehicle_allocations (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id),
  period tstzrange not null check(app_private.valid_period(period)), kind text not null check(kind in ('RESERVATION','RENTAL','BLOCK','MAINTENANCE')),
  reservation_id uuid references public.reservations(id), rental_id uuid references public.rentals(id),
  vehicle_block_id uuid references public.vehicle_blocks(id), maintenance_record_id uuid references public.maintenance_records(id),
  created_by uuid not null references public.profiles(id), released_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(num_nonnulls(reservation_id,rental_id,vehicle_block_id,maintenance_record_id)=1),
  check((kind='RESERVATION' and reservation_id is not null) or (kind='RENTAL' and rental_id is not null)
    or (kind='BLOCK' and vehicle_block_id is not null) or (kind='MAINTENANCE' and maintenance_record_id is not null)),
  check(released_at is null or released_at >= created_at),
  constraint vehicle_allocations_no_overlap exclude using gist(vehicle_id with =, period with &&) where(released_at is null)
);
create unique index on public.vehicle_allocations(reservation_id) where released_at is null;
create unique index on public.vehicle_allocations(rental_id) where released_at is null;
create unique index on public.vehicle_allocations(vehicle_block_id) where released_at is null;
create unique index on public.vehicle_allocations(maintenance_record_id) where released_at is null;
select app_private.secure_table('vehicle_allocations','vehicles.read');

-- Constraint triggers diferidos verificam o estado FINAL da transação.
create function app_private.check_occupancy() returns trigger
language plpgsql security definer set search_path = '' as $$
declare old_data jsonb; new_data jsonb; ids uuid[]; source_name text; entity_id uuid;
  source_table text; source_period tstzrange; source_vehicle uuid; needs_allocation boolean;
  count_alloc integer; r record; item record;
begin
  old_data := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  new_data := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  foreach source_name in array array['reservation','rental','vehicle_block','maintenance_record'] loop
    source_table := case source_name when 'reservation' then 'reservations' when 'rental' then 'rentals' when 'vehicle_block' then 'vehicle_blocks' else 'maintenance_records' end;
    if tg_table_name='vehicle_allocations' then
      ids := array[(old_data->>(source_name||'_id'))::uuid,(new_data->>(source_name||'_id'))::uuid];
    elsif tg_table_name='reservation_items' and source_name='reservation' then
      ids := array[(old_data->>'reservation_id')::uuid,(new_data->>'reservation_id')::uuid];
    elsif tg_table_name=source_table then
      ids := array[(old_data->>'id')::uuid,(new_data->>'id')::uuid];
    else continue; end if;
    for entity_id in select distinct id from unnest(ids) id where id is not null loop
      execute format('select * from public.%I where id=$1',source_table) into r using entity_id;
      if r.id is null then continue; end if;
      source_period := tstzrange(r.start_at,r.end_at,'[)'); source_vehicle := null;
      if source_name='reservation' then
        needs_allocation := r.status='CONFIRMED';
        if r.status='CONVERTED' and not exists(select 1 from public.rentals x where x.reservation_id=r.id and x.customer_id=r.customer_id and x.branch_id=r.branch_id and x.quote_id=r.quote_id) then
          raise exception using errcode='23514',message='Converted reservation requires matching rental';
        end if;
        select * into item from public.reservation_items where reservation_id=entity_id;
        if item.id is null then raise exception using errcode='23514',message='Reservation requires one item'; end if;
      elsif source_name='rental' then
        needs_allocation := r.status in ('PREPARING','ACTIVE','OVERDUE'); source_vehicle:=r.vehicle_id;
        if not exists(select 1 from public.quotes q where q.id=r.quote_id and q.customer_id=r.customer_id and q.locked_at is not null and q.start_at=r.start_at and q.end_at<=r.end_at) then
          raise exception using errcode='23514',message='Rental requires matching locked quote';
        end if;
        if r.reservation_id is not null and not exists(select 1 from public.reservations x where x.id=r.reservation_id and x.status='CONVERTED' and x.customer_id=r.customer_id and x.branch_id=r.branch_id and x.quote_id=r.quote_id) then
          raise exception using errcode='23514',message='Rental origin mismatch';
        end if;
      elsif source_name='vehicle_block' then needs_allocation:=r.active; source_vehicle:=r.vehicle_id;
      else needs_allocation:=r.blocks_availability and r.status in ('SCHEDULED','IN_PROGRESS'); source_vehicle:=r.vehicle_id;
      end if;
      execute format('select count(*) from public.vehicle_allocations where %I=$1 and released_at is null',source_name||'_id') into count_alloc using entity_id;
      if count_alloc <> (case when needs_allocation then 1 else 0 end) then
        raise exception using errcode='23514',message='Allocation does not match source state';
      end if;
      if needs_allocation then
        if exists(select 1 from public.vehicle_allocations a where (to_jsonb(a)->>(source_name||'_id'))::uuid=entity_id and a.released_at is null
          and (a.period <> source_period or (source_vehicle is not null and a.vehicle_id <> source_vehicle))) then
          raise exception using errcode='23514',message='Allocation vehicle or period mismatch';
        end if;
        if source_name='reservation' then
        if exists(
          select 1 from public.vehicle_allocations a join public.vehicles v on v.id=a.vehicle_id
          where a.reservation_id=entity_id and a.released_at is null
            and ((item.vehicle_id is not null and a.vehicle_id<>item.vehicle_id) or (item.category_id is not null and v.category_id<>item.category_id))
        ) then raise exception using errcode='23514',message='Assigned vehicle does not match requested target'; end if;
        end if;
      end if;
    end loop;
  end loop;
  return null;
end;
$$;
create constraint trigger check_occupancy after insert or update or delete on public.vehicle_allocations deferrable initially deferred for each row execute function app_private.check_occupancy();
create constraint trigger check_occupancy after insert or update or delete on public.reservations deferrable initially deferred for each row execute function app_private.check_occupancy();
create constraint trigger check_occupancy after insert or update or delete on public.reservation_items deferrable initially deferred for each row execute function app_private.check_occupancy();
create constraint trigger check_occupancy after insert or update or delete on public.rentals deferrable initially deferred for each row execute function app_private.check_occupancy();
create constraint trigger check_occupancy after insert or update or delete on public.vehicle_blocks deferrable initially deferred for each row execute function app_private.check_occupancy();
create constraint trigger check_occupancy after insert or update or delete on public.maintenance_records deferrable initially deferred for each row execute function app_private.check_occupancy();

create function app_private.guard_reservation_item() returns trigger
language plpgsql set search_path = '' as $$
begin
  perform 1 from public.reservations where id in (
    case when tg_op <> 'DELETE' then new.reservation_id end, case when tg_op <> 'INSERT' then old.reservation_id end
  ) for update;
  if exists(select 1 from public.reservations where status not in ('REQUESTED','UNDER_REVIEW') and id in (
    case when tg_op <> 'DELETE' then new.reservation_id end, case when tg_op <> 'INSERT' then old.reservation_id end
  )) then raise exception using errcode='23514',message='Reviewed target is immutable'; end if;
  return coalesce(new,old);
end;
$$;
create trigger frozen_target before insert or update or delete on public.reservation_items for each row execute function app_private.guard_reservation_item();
revoke execute on all functions in schema app_private from public;
