create table public.payment_methods (
  id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('payment_methods','finance.read','settings.manage');
create table public.charges (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id), rental_id uuid,
  damage_id uuid references public.damages(id), kind text not null, amount numeric(12,2) not null check(amount > 0 and amount < 'Infinity'::numeric),
  due_at timestamptz not null check(isfinite(due_at)), description text not null,
  foreign key(rental_id,customer_id) references public.rentals(id,customer_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,customer_id)
);
create index on public.charges(customer_id,due_at);
create index on public.charges(rental_id);
create index on public.charges(damage_id);
create index on public.charges(due_at);
select app_private.secure_table('charges','finance.read');
create table public.payments (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  payment_method_id uuid not null references public.payment_methods(id), amount numeric(12,2) not null check(amount > 0 and amount < 'Infinity'::numeric),
  status text not null check(status='CONFIRMED'), confirmed_by uuid not null references public.profiles(id), confirmed_at timestamptz not null check(isfinite(confirmed_at)),
  idempotency_key text not null unique check(length(idempotency_key) between 16 and 200),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,customer_id)
);
create index on public.payments(customer_id,confirmed_at);
create index on public.payments(confirmed_at,id);
create index on public.payments(payment_method_id);
select app_private.secure_table('payments','finance.read');
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(), payment_id uuid not null, charge_id uuid not null, customer_id uuid not null,
  amount numeric(12,2) not null check(amount > 0 and amount < 'Infinity'::numeric),
  foreign key(payment_id,customer_id) references public.payments(id,customer_id),
  foreign key(charge_id,customer_id) references public.charges(id,customer_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,payment_id)
);
create index on public.payment_allocations(payment_id);
create index on public.payment_allocations(charge_id);
select app_private.secure_table('payment_allocations','finance.read');
create table public.deposits (
  id uuid primary key default gen_random_uuid(), rental_id uuid not null references public.rentals(id),
  payment_method_id uuid references public.payment_methods(id), applied_charge_id uuid references public.charges(id),
  amount numeric(12,2) not null check(amount > 0 and amount < 'Infinity'::numeric), kind text not null check(kind in ('RECEIVED','APPLIED')),
  original_deposit_id uuid references public.deposits(id), confirmed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((kind='RECEIVED' and original_deposit_id is null and applied_charge_id is null and payment_method_id is not null)
    or (kind='APPLIED' and original_deposit_id is not null and applied_charge_id is not null and payment_method_id is null))
);
create index on public.deposits(original_deposit_id);
create index on public.deposits(rental_id);
create index on public.deposits(applied_charge_id);
select app_private.secure_table('deposits','finance.read');
create table public.refunds (
  id uuid primary key default gen_random_uuid(), payment_id uuid references public.payments(id), deposit_id uuid references public.deposits(id),
  payment_allocation_id uuid, amount numeric(12,2) not null check(amount > 0 and amount < 'Infinity'::numeric),
  reason text not null check(length(btrim(reason)) > 0), confirmed_by uuid not null references public.profiles(id),
  foreign key(payment_allocation_id,payment_id) references public.payment_allocations(id,payment_id),
  check(num_nonnulls(payment_id,deposit_id)=1), check(payment_allocation_id is null or payment_id is not null),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.refunds(payment_id);
create index on public.refunds(deposit_id);
create index on public.refunds(payment_allocation_id);
select app_private.secure_table('refunds','finance.read');
create table public.expenses (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid references public.vehicles(id), maintenance_record_id uuid,
  amount numeric(12,2) not null check(amount > 0 and amount < 'Infinity'::numeric), occurred_at timestamptz not null check(isfinite(occurred_at)), description text not null,
  foreign key(maintenance_record_id,vehicle_id) references public.maintenance_records(id,vehicle_id),
  check(maintenance_record_id is null or vehicle_id is not null),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.expenses(vehicle_id,occurred_at);
create index on public.expenses(maintenance_record_id);
select app_private.secure_table('expenses','finance.read');

create function app_private.guard_financial_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare parent public.payments; allocation public.payment_allocations; deposit public.deposits;
  charge public.charges; used numeric; refunded numeric; applied numeric; data jsonb:=to_jsonb(new);
begin
  -- Serializa lançamentos entre pagamentos, cobranças, cauções e compensações.
  -- MVP conservador; lock único evita write-skew. Medir antes de particionar locks.
  perform pg_advisory_xact_lock(187640,2);
  if tg_table_name='payment_allocations' then
    select * into strict parent from public.payments where id=new.payment_id for update;
    select * into strict charge from public.charges where id=new.charge_id for update;
    select coalesce(sum(amount),0) into used from public.payment_allocations where payment_id=parent.id;
    select coalesce(sum(amount),0) into refunded from public.refunds where payment_id=parent.id and payment_allocation_id is null;
    if used+refunded+new.amount > parent.amount then raise exception using errcode='23514',message='Payment balance exceeded'; end if;
    select coalesce(sum(amount),0) into used from public.payment_allocations where charge_id=charge.id;
    select coalesce(sum(r.amount),0) into refunded from public.refunds r join public.payment_allocations a on a.id=r.payment_allocation_id where a.charge_id=charge.id;
    select coalesce(sum(amount),0) into applied from public.deposits where applied_charge_id=charge.id;
    if used-refunded+applied+new.amount > charge.amount then raise exception using errcode='23514',message='Charge balance exceeded'; end if;
  elsif tg_table_name='refunds' and data->>'payment_id' is not null then
    select * into strict parent from public.payments where id=new.payment_id for update;
    select coalesce(sum(amount),0) into refunded from public.refunds where payment_id=parent.id;
    if refunded+new.amount > parent.amount then raise exception using errcode='23514',message='Refund exceeds payment'; end if;
    if new.payment_allocation_id is not null then
      select * into strict allocation from public.payment_allocations where id=new.payment_allocation_id;
      select coalesce(sum(amount),0) into refunded from public.refunds where payment_allocation_id=allocation.id;
      if refunded+new.amount > allocation.amount then raise exception using errcode='23514',message='Refund exceeds allocation'; end if;
    else
      select coalesce(sum(amount),0) into used from public.payment_allocations where payment_id=parent.id;
      select coalesce(sum(amount),0) into refunded from public.refunds where payment_id=parent.id and payment_allocation_id is null;
      if used+refunded+new.amount > parent.amount then raise exception using errcode='23514',message='Unallocated balance exceeded'; end if;
    end if;
  elsif (tg_table_name='deposits' and data->>'kind'='APPLIED') or (tg_table_name='refunds' and data->>'deposit_id' is not null) then
    select * into strict deposit from public.deposits where id=(data->>case when tg_table_name='deposits' then 'original_deposit_id' else 'deposit_id' end)::uuid for update;
    if deposit.kind <> 'RECEIVED' then raise exception using errcode='23514',message='Original deposit required'; end if;
    select coalesce(sum(amount),0) into used from public.deposits where original_deposit_id=deposit.id;
    select coalesce(sum(amount),0) into refunded from public.refunds where deposit_id=deposit.id;
    if used+refunded+new.amount > deposit.amount then raise exception using errcode='23514',message='Deposit balance exceeded'; end if;
    if tg_table_name='deposits' then
      select * into strict charge from public.charges where id=new.applied_charge_id for update;
      if new.rental_id <> deposit.rental_id or charge.rental_id is distinct from new.rental_id then raise exception using errcode='23514',message='Deposit rental mismatch'; end if;
      select coalesce(sum(amount),0) into used from public.payment_allocations where charge_id=charge.id;
      select coalesce(sum(r.amount),0) into refunded from public.refunds r join public.payment_allocations a on a.id=r.payment_allocation_id where a.charge_id=charge.id;
      select coalesce(sum(amount),0) into applied from public.deposits where applied_charge_id=charge.id;
      if used-refunded+applied+new.amount > charge.amount then raise exception using errcode='23514',message='Charge balance exceeded'; end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger validate_balance before insert on public.payment_allocations for each row execute function app_private.guard_financial_insert();
create trigger validate_balance before insert on public.refunds for each row execute function app_private.guard_financial_insert();
create trigger validate_balance before insert on public.deposits for each row execute function app_private.guard_financial_insert();
do $$ declare t text; begin
  foreach t in array array['charges','payments','payment_allocations','deposits','refunds','expenses'] loop
    execute format('create trigger immutable_ledger before update or delete on public.%I for each row execute function app_private.reject_mutation()',t);
  end loop;
end $$;
revoke execute on all functions in schema app_private from public;
