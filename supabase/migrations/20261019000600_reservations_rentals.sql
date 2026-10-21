create table public.reservations (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  branch_id uuid not null references public.branches(id), quote_id uuid not null unique references public.quotes(id),
  status text not null default 'REQUESTED' check(status in ('REQUESTED','UNDER_REVIEW','CONFIRMED','REJECTED','CANCELLED','EXPIRED','CONVERTED')),
  start_at timestamptz not null, end_at timestamptz not null, expires_at timestamptz,
  lookup_token_hash text not null unique check(lookup_token_hash ~ '^[a-f0-9]{64}$'), lookup_expires_at timestamptz not null,
  version integer not null default 1 check(version > 0), approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(isfinite(start_at) and isfinite(end_at) and end_at > start_at),
  check(lookup_expires_at > created_at and isfinite(lookup_expires_at)),
  check(expires_at is null or (expires_at > created_at and isfinite(expires_at)))
);
create index on public.reservations(status,start_at,id);
create index on public.reservations(customer_id,created_at);
create index on public.reservations(branch_id);
select app_private.secure_table('reservations','reservations.read');
create table public.reservation_items (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null unique references public.reservations(id),
  category_id uuid references public.vehicle_categories(id), vehicle_id uuid references public.vehicles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(num_nonnulls(category_id,vehicle_id)=1)
);
create index on public.reservation_items(category_id);
create index on public.reservation_items(vehicle_id);
select app_private.secure_table('reservation_items','reservations.read');
create table public.reservation_status_history (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations(id),
  from_status text, to_status text not null, actor_id uuid references public.profiles(id), reason text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.reservation_status_history(reservation_id,created_at);
select app_private.secure_table('reservation_status_history','reservations.read');
create table public.reservation_locations (
  id uuid primary key default gen_random_uuid(), reservation_id uuid not null references public.reservations(id),
  branch_id uuid references public.branches(id), direction text not null check(direction in ('PICKUP','RETURN')),
  mode text not null, address_snapshot jsonb not null check(jsonb_typeof(address_snapshot)='object'),
  fee numeric(12,2) not null check(fee >= 0 and fee < 'Infinity'::numeric), scheduled_at timestamptz not null,
  instructions text, unique(reservation_id,direction),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((direction='PICKUP' and mode in ('BRANCH','DELIVERY')) or (direction='RETURN' and mode in ('BRANCH','COLLECTION'))),
  check(mode <> 'BRANCH' or branch_id is not null)
);
select app_private.secure_table('reservation_locations','reservations.read');
create table public.rentals (
  id uuid primary key default gen_random_uuid(), reservation_id uuid unique references public.reservations(id),
  customer_id uuid not null references public.customers(id), vehicle_id uuid not null references public.vehicles(id),
  branch_id uuid not null references public.branches(id), quote_id uuid not null references public.quotes(id), responsible_id uuid not null references public.profiles(id),
  status text not null default 'PREPARING' check(status in ('PREPARING','ACTIVE','OVERDUE','COMPLETED','CANCELLED')),
  start_at timestamptz not null, end_at timestamptz not null, actual_start_at timestamptz, actual_end_at timestamptz,
  initial_mileage bigint check(initial_mileage >= 0), final_mileage bigint,
  initial_fuel numeric(5,2) check(initial_fuel between 0 and 100), final_fuel numeric(5,2) check(final_fuel between 0 and 100),
  commercial_snapshot jsonb not null check(jsonb_typeof(commercial_snapshot)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,customer_id),
  check(isfinite(start_at) and isfinite(end_at) and end_at > start_at),
  check(final_mileage is null or (initial_mileage is not null and final_mileage >= initial_mileage)),
  check(actual_end_at is null or (actual_start_at is not null and actual_end_at >= actual_start_at)),
  check(status not in ('ACTIVE','OVERDUE','COMPLETED') or (actual_start_at is not null and initial_mileage is not null and initial_fuel is not null)),
  check(status <> 'COMPLETED' or (actual_end_at is not null and final_mileage is not null and final_fuel is not null))
);
create index on public.rentals(status,end_at,id);
create index on public.rentals(customer_id,created_at);
create index on public.rentals(vehicle_id,start_at);
create index on public.rentals(branch_id);
select app_private.secure_table('rentals','rentals.read');
create table public.rental_drivers (
  id uuid primary key default gen_random_uuid(), rental_id uuid not null, driver_id uuid not null,
  customer_id uuid not null, driver_snapshot jsonb not null check(jsonb_typeof(driver_snapshot)='object'),
  foreign key(rental_id,customer_id) references public.rentals(id,customer_id),
  foreign key(driver_id,customer_id) references public.drivers(id,customer_id), unique(rental_id,driver_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.rental_drivers(driver_id,customer_id);
select app_private.secure_table('rental_drivers','rentals.read');
create table public.rental_extensions (
  id uuid primary key default gen_random_uuid(), rental_id uuid not null references public.rentals(id), quote_id uuid not null references public.quotes(id),
  previous_end_at timestamptz not null, new_end_at timestamptz not null check(isfinite(new_end_at)),
  approved_by uuid not null references public.profiles(id), check(new_end_at > previous_end_at),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.rental_extensions(rental_id);
select app_private.secure_table('rental_extensions','rentals.read');
create table public.rental_locations (
  id uuid primary key default gen_random_uuid(), rental_id uuid not null references public.rentals(id), branch_id uuid references public.branches(id),
  direction text not null check(direction in ('PICKUP','RETURN')), mode text not null,
  address_snapshot jsonb not null check(jsonb_typeof(address_snapshot)='object'), fee numeric(12,2) not null check(fee >= 0 and fee < 'Infinity'::numeric),
  instructions text, responsible_id uuid references public.profiles(id), scheduled_at timestamptz not null, performed_at timestamptz, notes text,
  unique(rental_id,direction), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((direction='PICKUP' and mode in ('BRANCH','DELIVERY')) or (direction='RETURN' and mode in ('BRANCH','COLLECTION'))),
  check(mode <> 'BRANCH' or branch_id is not null)
);
select app_private.secure_table('rental_locations','rentals.read');

create function app_private.validate_reservation_change() returns trigger
language plpgsql set search_path = '' as $$
declare q public.quotes;
begin
  if tg_op='INSERT' and new.status <> 'REQUESTED' then raise exception using errcode='23514',message='Reservation must start requested'; end if;
  if tg_op='UPDATE' then
    if new.status is distinct from old.status and not (
      (old.status in ('REQUESTED','UNDER_REVIEW') and new.status in ('UNDER_REVIEW','CONFIRMED','REJECTED','CANCELLED','EXPIRED'))
      or (old.status='CONFIRMED' and new.status in ('CANCELLED','CONVERTED'))
    ) then raise exception using errcode='23514',message='Invalid reservation transition'; end if;
    if row(new.customer_id,new.quote_id,new.start_at,new.end_at) is distinct from row(old.customer_id,old.quote_id,old.start_at,old.end_at) then
      raise exception using errcode='23514',message='Reservation snapshot cannot be rewritten';
    end if;
    new.version := old.version+1;
  end if;
  select * into strict q from public.quotes where id=new.quote_id for update;
  if q.start_at <> new.start_at or q.end_at <> new.end_at or q.customer_id is distinct from new.customer_id or q.locked_at is null then
    raise exception using errcode='23514',message='Reservation requires matching locked quote';
  end if;
  return new;
end;
$$;
create trigger validate_reservation before insert or update on public.reservations for each row execute function app_private.validate_reservation_change();
create function app_private.validate_rental_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op='INSERT' and new.status <> 'PREPARING' then raise exception using errcode='23514',message='Rental must start preparing'; end if;
  if tg_op='UPDATE' and new.status is distinct from old.status and not (
    (old.status='PREPARING' and new.status in ('ACTIVE','CANCELLED'))
    or (old.status='ACTIVE' and new.status in ('OVERDUE','COMPLETED'))
    or (old.status='OVERDUE' and new.status in ('ACTIVE','COMPLETED'))
  ) then raise exception using errcode='23514',message='Invalid rental transition'; end if;
  return new;
end;
$$;
create trigger validate_rental before insert or update on public.rentals for each row execute function app_private.validate_rental_change();
revoke execute on all functions in schema app_private from public;
