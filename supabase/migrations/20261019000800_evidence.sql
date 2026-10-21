create table public.contract_templates (
  id uuid primary key default gen_random_uuid(), template_key text not null, version integer not null check(version > 0),
  body text not null, review_status text not null default 'LEGAL_REVIEW_REQUIRED' check(review_status in ('LEGAL_REVIEW_REQUIRED','APPROVED')),
  unique(template_key,version), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('contract_templates','contracts.read');
create table public.contracts (
  id uuid primary key default gen_random_uuid(), rental_id uuid not null references public.rentals(id), template_id uuid not null references public.contract_templates(id),
  version integer not null check(version > 0), storage_path text unique, sha256 text check(sha256 ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null check(jsonb_typeof(snapshot)='object'), generation_status text not null default 'PENDING' check(generation_status in ('PENDING','GENERATED','FAILED')),
  unique(rental_id,version), check(generation_status <> 'GENERATED' or (storage_path is not null and sha256 is not null)),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('contracts','contracts.read');
create index on public.contracts(template_id);
create table public.inspection_templates (
  id uuid primary key default gen_random_uuid(), name text not null, version integer not null check(version > 0),
  checklist jsonb not null check(jsonb_typeof(checklist)='array'), active boolean not null default true,
  unique(name,version), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('inspection_templates','inspections.read');
create table public.inspections (
  id uuid primary key default gen_random_uuid(), rental_id uuid not null references public.rentals(id), template_id uuid not null references public.inspection_templates(id),
  inspector_id uuid not null references public.profiles(id), kind text not null check(kind in ('INITIAL','FINAL')),
  mileage bigint not null check(mileage >= 0), fuel numeric(5,2) not null check(fuel between 0 and 100),
  checklist_snapshot jsonb not null check(jsonb_typeof(checklist_snapshot)='array'), notes text, completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,rental_id)
);
create index on public.inspections(rental_id,kind);
create index on public.inspections(template_id);
create index on public.inspections(inspector_id);
select app_private.secure_table('inspections','inspections.read');
create table public.inspection_items (
  id uuid primary key default gen_random_uuid(), inspection_id uuid not null references public.inspections(id),
  item_key text not null, condition text not null check(condition in ('OK','DAMAGE','MISSING','NOT_APPLICABLE')), notes text,
  unique(inspection_id,item_key), unique(id,inspection_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('inspection_items','inspections.read');
create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(), inspection_id uuid not null references public.inspections(id), item_id uuid,
  storage_path text not null unique, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  foreign key(item_id,inspection_id) references public.inspection_items(id,inspection_id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.inspection_photos(inspection_id);
select app_private.secure_table('inspection_photos','inspections.read');
create table public.damages (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id), inspection_id uuid not null references public.inspections(id),
  description text not null, status text not null default 'OPEN' check(status in ('OPEN','ASSESSED','RESOLVED')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.damages(vehicle_id);
create index on public.damages(inspection_id);
select app_private.secure_table('damages','inspections.read');
create function app_private.reject_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin raise exception using errcode='23514',message='Historical record is immutable'; end;
$$;
create trigger immutable_template before update or delete on public.contract_templates for each row execute function app_private.reject_mutation();
create trigger immutable_extension before update or delete on public.rental_extensions for each row execute function app_private.reject_mutation();
create trigger immutable_history before update or delete on public.reservation_status_history for each row execute function app_private.reject_mutation();

create function app_private.guard_inspection_evidence() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_table_name='inspections' then
    if old.completed_at is not null then raise exception using errcode='23514',message='Completed inspection is immutable'; end if;
  else
    perform 1 from public.inspections where id in (
      case when tg_op <> 'DELETE' then new.inspection_id end, case when tg_op <> 'INSERT' then old.inspection_id end
    ) for update;
    if exists(select 1 from public.inspections where completed_at is not null and id in (
      case when tg_op <> 'DELETE' then new.inspection_id end, case when tg_op <> 'INSERT' then old.inspection_id end
    )) then raise exception using errcode='23514',message='Completed inspection evidence is immutable'; end if;
  end if;
  return coalesce(new,old);
end;
$$;
create trigger frozen_inspection before update or delete on public.inspections for each row execute function app_private.guard_inspection_evidence();
create trigger frozen_items before insert or update or delete on public.inspection_items for each row execute function app_private.guard_inspection_evidence();
create trigger frozen_photos before insert or update or delete on public.inspection_photos for each row execute function app_private.guard_inspection_evidence();
create function app_private.guard_contract() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.generation_status='GENERATED' then raise exception using errcode='23514',message='Generated contract is immutable'; end if;
  return coalesce(new,old);
end;
$$;
create trigger frozen_contract before update or delete on public.contracts for each row execute function app_private.guard_contract();
revoke execute on all functions in schema app_private from public;
