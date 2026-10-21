-- As projeções preservam a allowlist FINANCE sem usar o dono da view.
-- A elevação necessária fica em funções privadas com permissão/sessão atual,
-- search_path fixo e retorno limitado. Não conceder acesso às tabelas brutas.
create function app_private.finance_customers_projection()
returns table(id uuid,name text,person_type text)
language sql stable security definer set search_path='' as $$
 select c.id,c.name,c.person_type from public.customers c
 where app_private.has_permission('finance.read');
$$;
create function app_private.finance_vehicles_projection()
returns table(id uuid,make text,model text,category_id uuid)
language sql stable security definer set search_path='' as $$
 select v.id,v.make,v.model,v.category_id from public.vehicles v
 where app_private.has_permission('finance.read');
$$;
create function app_private.finance_reservations_projection()
returns table(id uuid,customer_id uuid,quote_id uuid,status text,start_at timestamptz,end_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.id,r.customer_id,r.quote_id,r.status,r.start_at,r.end_at from public.reservations r
 where app_private.has_permission('finance.read');
$$;
create function app_private.finance_contracts_projection()
returns table(id uuid,rental_id uuid,version integer,generation_status text,customer_id uuid,contracted_total text)
language sql stable security definer set search_path='' as $$
 select c.id,c.rental_id,c.version,c.generation_status,r.customer_id,r.commercial_snapshot->>'total'
 from public.contracts c join public.rentals r on r.id=c.rental_id
 where app_private.has_permission('finance.read');
$$;
revoke all on function app_private.finance_customers_projection(),app_private.finance_vehicles_projection(),app_private.finance_reservations_projection(),app_private.finance_contracts_projection() from public,anon,authenticated,service_role;
grant execute on function app_private.finance_customers_projection(),app_private.finance_vehicles_projection(),app_private.finance_reservations_projection(),app_private.finance_contracts_projection() to authenticated;
create or replace view public.finance_customers with(security_invoker=true,security_barrier=true) as
 select * from app_private.finance_customers_projection();
create or replace view public.finance_vehicles with(security_invoker=true,security_barrier=true) as
 select * from app_private.finance_vehicles_projection();
create or replace view public.finance_reservations with(security_invoker=true,security_barrier=true) as
 select * from app_private.finance_reservations_projection();
create or replace view public.finance_contracts with(security_invoker=true,security_barrier=true) as
 select * from app_private.finance_contracts_projection();
-- Cobranças já têm SELECT e RLS de finance.read; o cálculo é delimitado.
alter view public.finance_charge_balances set(security_invoker=true);
-- Mesmo índice de responsável já coberto pela migration 12 (nome depende do OID).
drop index public.rental_location_responsible;
create index public_booking_quote_fk on public.public_booking_operations(quote_id);
create index public_booking_reservation_fk on public.public_booking_operations(reservation_id);
create index registry_files_uploader_fk on public.registry_files(uploaded_by);
