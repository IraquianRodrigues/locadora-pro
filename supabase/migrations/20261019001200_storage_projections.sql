-- Projeções com allowlist de colunas. FINANCE não recebe SELECT em clientes/frota brutos.
create view public.finance_customers with (security_barrier=true) as
select id,name,person_type from public.customers where app_private.has_permission('finance.read');
create view public.finance_vehicles with (security_barrier=true) as
select id,make,model,category_id from public.vehicles where app_private.has_permission('finance.read');
create view public.finance_reservations with (security_barrier=true) as
select id,customer_id,quote_id,status,start_at,end_at from public.reservations where app_private.has_permission('finance.read');
create view public.finance_contracts with (security_barrier=true) as
select c.id,c.rental_id,c.version,c.generation_status,r.customer_id,r.commercial_snapshot->>'total' as contracted_total
from public.contracts c join public.rentals r on r.id=c.rental_id where app_private.has_permission('finance.read');
create view public.finance_charge_balances with (security_barrier=true) as
select c.id,c.customer_id,c.rental_id,c.due_at,c.amount,
  c.amount-coalesce((select sum(a.amount) from public.payment_allocations a where a.charge_id=c.id),0)
  +coalesce((select sum(f.amount) from public.refunds f join public.payment_allocations a on a.id=f.payment_allocation_id where a.charge_id=c.id),0)
  -coalesce((select sum(d.amount) from public.deposits d where d.applied_charge_id=c.id),0) as balance
from public.charges c where app_private.has_permission('finance.read');
revoke all on public.finance_customers,public.finance_vehicles,public.finance_reservations,public.finance_contracts,public.finance_charge_balances from public,anon,authenticated;
grant select on public.finance_customers,public.finance_vehicles,public.finance_reservations,public.finance_contracts,public.finance_charge_balances to authenticated;

create function public.catalog_categories() returns table(id uuid,name text,description text,capacity integer,features jsonb)
language sql stable security definer set search_path = '' as $$
  select id,name,description,capacity,features from public.vehicle_categories where active and archived_at is null order by name,id;
$$;
create function public.catalog_vehicles(requested_category_id uuid default null, page integer default 1, page_size integer default 24)
returns table(id uuid,category_id uuid,make text,model text,version text,model_year integer,passengers integer,doors integer,fuel text,transmission text,description text,features jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if page is null or page_size is null or page not between 1 and 10000 or page_size not between 1 and 100 then
    raise exception using errcode='22023',message='Invalid pagination';
  end if;
  return query select v.id,v.category_id,v.make,v.model,v.version,v.model_year,v.passengers,v.doors,v.fuel,v.transmission,v.description,v.features
    from public.vehicles v join public.vehicle_categories c on c.id=v.category_id join public.branches b on b.id=v.branch_id
    where v.operational_status='ACTIVE' and v.archived_at is null and c.active and c.archived_at is null and b.active
      and (requested_category_id is null or v.category_id=requested_category_id)
    order by v.make,v.model,v.id limit page_size offset ((page-1)*page_size);
end;
$$;
revoke all on function public.catalog_categories(),public.catalog_vehicles(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.catalog_categories() to anon,authenticated;
grant execute on function public.catalog_vehicles(uuid,integer,integer) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('vehicle-images','vehicle-images',false,5242880,array['image/jpeg','image/png','image/webp']),
 ('documents','documents',false,10485760,array['application/pdf','image/jpeg','image/png']),
 ('inspections','inspections',false,10485760,array['image/jpeg','image/png','image/webp']),
 ('contracts','contracts',false,10485760,array['application/pdf'])
on conflict(id) do nothing;
do $$ begin
  if exists(select 1 from storage.buckets where id in ('vehicle-images','documents','inspections','contracts') and public) then
    raise exception 'Locadora buckets must be private; review existing configuration';
  end if;
end $$;

-- Caminho: <UUID da entidade>/<UUID do arquivo>.<extensão>. Metadados precedem upload.
create function app_private.can_access_object(bucket text, path text, write_object boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if path !~ '^[a-f0-9-]{36}/[a-f0-9-]{36}\.(jpg|jpeg|png|webp|pdf)$' then return false; end if;
  if bucket='vehicle-images' then
    return app_private.has_permission(case when write_object then 'vehicles.write' else 'vehicles.read' end)
      and exists(select 1 from public.vehicle_images where storage_path=path and vehicle_id::text=split_part(path,'/',1));
  elsif bucket='documents' then
    return app_private.has_permission(case when write_object then 'documents.write' else 'documents.read' end) and (
      exists(select 1 from public.customer_documents where storage_path=path and customer_id::text=split_part(path,'/',1))
      or exists(select 1 from public.vehicle_documents where storage_path=path and vehicle_id::text=split_part(path,'/',1))
      or exists(select 1 from public.drivers where document_path=path and id::text=split_part(path,'/',1))
    );
  elsif bucket='inspections' then
    return app_private.has_permission(case when write_object then 'inspections.write' else 'inspections.read' end)
      and exists(select 1 from public.inspection_photos p join public.inspections i on i.id=p.inspection_id
        where p.storage_path=path and p.inspection_id::text=split_part(path,'/',1) and (not write_object or i.completed_at is null));
  elsif bucket='contracts' and not write_object then
    return app_private.has_permission('contracts.read') and exists(select 1 from public.contracts where storage_path=path and rental_id::text=split_part(path,'/',1) and generation_status='GENERATED');
  end if;
  return false;
end;
$$;
grant execute on function app_private.can_access_object(text,text,boolean) to authenticated;
create policy locadora_object_read on storage.objects for select to authenticated
using (bucket_id in ('vehicle-images','documents','inspections','contracts') and app_private.can_access_object(bucket_id,name,false));
create policy locadora_object_insert on storage.objects for insert to authenticated
with check (bucket_id in ('vehicle-images','documents','inspections') and app_private.can_access_object(bucket_id,name,true));
-- Sem UPDATE/DELETE: evitar upsert/substituição de provas. Limpeza só por worker autorizado.

grant execute on function app_private.valid_period(tstzrange),app_private.valid_cpf(text),app_private.valid_cnpj(text) to authenticated,service_role;

-- Garante índices das FKs simples/compostas ainda não cobertas pelo primeiro campo
-- de um índice. Restringe o DDL às tabelas desta aplicação, identificadas pelo trigger.
do $$ declare fk record; columns_sql text; begin
  for fk in select c.conrelid,c.conname,c.conkey from pg_catalog.pg_constraint c
    where c.contype='f' and c.connamespace='public'::regnamespace
    and exists(select 1 from pg_catalog.pg_trigger t where t.tgrelid=c.conrelid and t.tgname='touch_updated_at')
  loop
    if not exists(select 1 from pg_catalog.pg_index i where i.indrelid=fk.conrelid and i.indisvalid
      and (select array_agg(k.attnum order by k.ordinality) from unnest(i.indkey) with ordinality k(attnum,ordinality)
        where k.ordinality<=cardinality(fk.conkey))=fk.conkey) then
      select string_agg(quote_ident(a.attname),',' order by k.ordinality) into columns_sql
      from unnest(fk.conkey) with ordinality k(attnum,ordinality) join pg_catalog.pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.attnum;
      execute format('create index %I on %s (%s)', 'fk_'||substr(md5(fk.conrelid::text||fk.conname),1,20),fk.conrelid::regclass,columns_sql);
    end if;
  end loop;
end $$;
-- Também remove grants globais herdados do projeto, além do privilégio PUBLIC.
revoke execute on all functions in schema app_private from public,anon,authenticated,service_role;
grant execute on function app_private.has_permission(text),app_private.can_access_object(text,text,boolean) to authenticated;
grant execute on function app_private.valid_period(tstzrange),app_private.valid_cpf(text),app_private.valid_cnpj(text) to authenticated,service_role;
