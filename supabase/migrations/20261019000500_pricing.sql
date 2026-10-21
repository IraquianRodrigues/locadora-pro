create table public.rate_plans (
  id uuid primary key default gen_random_uuid(), name text not null, period_unit text not null check(period_unit in ('DAY','WEEK','MONTH')),
  month_mode text check(month_mode in ('COMMERCIAL','CALENDAR')), commercial_month_days integer check(commercial_month_days between 1 and 366),
  policy jsonb not null check(jsonb_typeof(policy)='object'), version integer not null default 1 check(version > 0), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((period_unit='MONTH' and month_mode is not null) or (period_unit <> 'MONTH' and month_mode is null and commercial_month_days is null)),
  check((month_mode='COMMERCIAL' and commercial_month_days is not null) or (month_mode is distinct from 'COMMERCIAL' and commercial_month_days is null))
);
select app_private.secure_table('rate_plans','pricing.read','pricing.write');
create table public.rate_plan_prices (
  id uuid primary key default gen_random_uuid(), rate_plan_id uuid not null references public.rate_plans(id),
  category_id uuid references public.vehicle_categories(id), vehicle_id uuid references public.vehicles(id),
  validity tstzrange not null check(app_private.valid_period(validity)), amount numeric(12,2) not null check(amount >= 0 and amount < 'Infinity'::numeric),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(num_nonnulls(category_id,vehicle_id)=1),
  exclude using gist(rate_plan_id with =, category_id with =, validity with &&) where(category_id is not null),
  exclude using gist(rate_plan_id with =, vehicle_id with =, validity with &&) where(vehicle_id is not null)
);
create index on public.rate_plan_prices(category_id);
create index on public.rate_plan_prices(vehicle_id);
select app_private.secure_table('rate_plan_prices','pricing.read','pricing.write');
create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(), rate_plan_id uuid not null references public.rate_plans(id), rule_type text not null,
  priority integer not null default 0, version integer not null default 1 check(version > 0), parameters jsonb not null check(jsonb_typeof(parameters)='object'),
  unique(rate_plan_id,rule_type,version),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('pricing_rules','pricing.read','pricing.write');
create table public.additional_services (
  id uuid primary key default gen_random_uuid(), name text not null, unit text not null check(unit in ('ONCE','DAY','WEEK','MONTH','HOUR')),
  amount numeric(12,2) not null check(amount >= 0 and amount < 'Infinity'::numeric), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('additional_services','pricing.read','pricing.write');
create table public.quotes (
  id uuid primary key default gen_random_uuid(), customer_id uuid references public.customers(id), rate_plan_id uuid not null references public.rate_plans(id),
  start_at timestamptz not null, end_at timestamptz not null, expires_at timestamptz not null,
  total numeric(12,2) not null check(total >= 0 and total < 'Infinity'::numeric), deposit numeric(12,2) not null default 0 check(deposit >= 0 and deposit < 'Infinity'::numeric),
  currency text not null default 'BRL' check(currency='BRL'), rules_snapshot jsonb not null check(jsonb_typeof(rules_snapshot)='object'), locked_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(isfinite(start_at) and isfinite(end_at) and end_at > start_at), check(isfinite(expires_at))
);
create index on public.quotes(customer_id,created_at);
select app_private.secure_table('quotes','pricing.read');
create table public.quote_items (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id), additional_service_id uuid references public.additional_services(id),
  kind text not null, description text not null, quantity numeric(12,4) not null check(quantity > 0 and quantity < 'Infinity'::numeric),
  unit_amount numeric(12,2) not null check(unit_amount >= 0 and unit_amount < 'Infinity'::numeric),
  total numeric(12,2) not null check(total >= 0 and total < 'Infinity'::numeric), snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.quote_items(quote_id);
select app_private.secure_table('quote_items','pricing.read');
create function app_private.guard_quote_snapshot() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'quotes' then
    if old.locked_at is not null then raise exception using errcode='23514',message='Approved quote is immutable'; end if;
  else
    -- O lock impede inserir um item enquanto outra transação congela o orçamento.
    perform 1 from public.quotes q where q.id in (
      case when tg_op <> 'DELETE' then new.quote_id end, case when tg_op <> 'INSERT' then old.quote_id end
    ) for update;
    if exists(select 1 from public.quotes q where q.locked_at is not null and q.id in (
      case when tg_op <> 'DELETE' then new.quote_id end, case when tg_op <> 'INSERT' then old.quote_id end
    )) then raise exception using errcode='23514',message='Approved quote items are immutable'; end if;
  end if;
  return coalesce(new,old);
end;
$$;
create trigger immutable_quote before update or delete on public.quotes for each row execute function app_private.guard_quote_snapshot();
create trigger immutable_quote_items before insert or update or delete on public.quote_items for each row execute function app_private.guard_quote_snapshot();
create function app_private.validate_quote_lock() returns trigger
language plpgsql set search_path = '' as $$
declare item_count integer; item_total numeric;
begin
  if new.locked_at is not null then
    select count(*),coalesce(sum(case when kind='DISCOUNT' then -total else total end),0)
      into item_count,item_total from public.quote_items where quote_id=new.id;
    if item_count=0 or item_total<>new.total then raise exception using errcode='23514',message='Quote total does not match items'; end if;
  end if;
  return new;
end;
$$;
create trigger validate_quote_lock before insert or update on public.quotes for each row execute function app_private.validate_quote_lock();
revoke execute on all functions in schema app_private from public;
