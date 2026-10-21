create table public.vehicle_categories (
  id uuid primary key default gen_random_uuid(), name text not null unique check(length(btrim(name)) > 0),
  description text not null default '', image_path text, capacity integer not null check(capacity between 1 and 100),
  features jsonb not null default '[]' check(jsonb_typeof(features)='array'), active boolean not null default true,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('vehicle_categories','categories.read','categories.write');
create table public.vehicles (
  id uuid primary key default gen_random_uuid(), category_id uuid not null references public.vehicle_categories(id),
  branch_id uuid not null references public.branches(id),
  plate text not null unique check(plate ~ '^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$'),
  chassis text unique check(chassis ~ '^[A-HJ-NPR-Z0-9]{17}$'), renavam text check(renavam ~ '^[0-9]{9,11}$'),
  make text not null check(length(btrim(make)) > 0), model text not null check(length(btrim(model)) > 0), version text not null default '',
  manufacture_year integer not null check(manufacture_year between 1900 and 2200),
  model_year integer not null check(model_year between manufacture_year and manufacture_year+2),
  color text not null, fuel text not null, transmission text not null,
  passengers integer not null check(passengers between 1 and 100), doors integer not null check(doors between 0 and 10),
  mileage bigint not null default 0 check(mileage >= 0), description text not null default '',
  features jsonb not null default '[]' check(jsonb_typeof(features)='array'),
  operational_status text not null default 'ACTIVE' check(operational_status in ('ACTIVE','INACTIVE','MAINTENANCE','RETIRED')),
  acquired_on date, internal_notes text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.vehicles(category_id,operational_status,id) where archived_at is null;
create index on public.vehicles(branch_id);
select app_private.secure_table('vehicles','vehicles.read','vehicles.write');
create table public.vehicle_images (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id),
  storage_path text not null unique, sort_order integer not null default 0 check(sort_order >= 0), alt_text text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.vehicle_images(vehicle_id,sort_order);
select app_private.secure_table('vehicle_images','vehicles.read','vehicles.write');
create table public.vehicle_documents (
  id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id),
  storage_path text not null unique, document_type text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.vehicle_documents(vehicle_id);
select app_private.secure_table('vehicle_documents','documents.read','documents.write');
revoke execute on all functions in schema app_private from public;
