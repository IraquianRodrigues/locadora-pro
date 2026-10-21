create table public.customers (
  id uuid primary key default gen_random_uuid(), person_type text not null check(person_type in ('PF','PJ')),
  name text not null check(length(btrim(name)) between 1 and 200), tax_document text not null unique,
  email text not null check(email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  phone text not null check(phone ~ '^[0-9+]{10,16}$'),
  address jsonb not null check(jsonb_typeof(address)='object'), birth_date date,
  notes text, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((person_type='PF' and app_private.valid_cpf(tax_document)) or (person_type='PJ' and app_private.valid_cnpj(tax_document))),
  check(person_type='PF' or birth_date is null)
);
create index on public.customers(name,id) where archived_at is null;
select app_private.secure_table('customers','customers.read','customers.write');
create table public.drivers (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  name text not null check(length(btrim(name)) > 0), cpf text not null unique check(app_private.valid_cpf(cpf)),
  license_number text not null unique check(license_number ~ '^[0-9]{11}$'),
  license_category text not null check(license_category in ('ACC','A','B','C','D','E','AB','AC','AD','AE')),
  license_expires_on date not null, document_path text unique, archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,customer_id)
);
create index on public.drivers(customer_id);
select app_private.secure_table('drivers','drivers.read','drivers.write');
create table public.customer_documents (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  storage_path text not null unique, document_type text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.customer_documents(customer_id);
select app_private.secure_table('customer_documents','documents.read','documents.write');
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  author_id uuid not null default auth.uid() references public.profiles(id), note text not null check(length(btrim(note)) > 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.customer_notes(customer_id,created_at);
select app_private.secure_table('customer_notes','customers.read','customers.write');
create function app_private.require_own_author() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user = 'authenticated' and new.author_id is distinct from auth.uid() then
    raise exception using errcode='42501',message='Invalid author';
  end if;
  return new;
end;
$$;
create trigger own_author before insert or update on public.customer_notes for each row execute function app_private.require_own_author();
revoke execute on all functions in schema app_private from public;
