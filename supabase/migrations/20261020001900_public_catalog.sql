alter table public.rate_plans add column public_enabled boolean not null default false;
alter table public.additional_services add column public_enabled boolean not null default false;
alter table public.registry_files add column public_visible boolean not null default false check(not public_visible or kind in ('CATEGORY_IMAGE','VEHICLE_IMAGE'));
create function app_private.site_enabled() returns boolean language sql stable security definer set search_path='' as $$
select coalesce((select value->>'enabled'='true' from public.system_settings where key='public_site'),false)
$$;
create function public.public_site() returns jsonb language sql stable security definer set search_path='' as $$
select case when app_private.site_enabled() then jsonb_build_object('enabled',true,'name',value->>'name','email',value->>'email','phone',value->>'phone','address',value->>'address','terms',value->>'terms','privacy',value->>'privacy','terms_version',value->>'terms_version') end from public.system_settings where key='public_site'
$$;
revoke all on function public.public_site() from public,anon,authenticated,service_role;
grant execute on function public.public_site() to anon,authenticated,service_role;
create function public.set_public_site(input jsonb,expected_version integer) returns integer language plpgsql security definer set search_path='' as $$
declare v integer;
begin
 perform app_private.require_permission('settings.manage');perform pg_advisory_xact_lock(187640,6);
 select version into v from public.system_settings where key='public_site' for update;
 if coalesce(v,0)<>expected_version then raise exception using errcode='40001',message='Site configuration changed';end if;
 if jsonb_typeof(input->'enabled') is distinct from 'boolean' or length(coalesce(input->>'name','')) not between 1 and 120 or length(coalesce(input->>'terms','')) not between 30 and 20000 or length(coalesce(input->>'privacy','')) not between 30 and 20000 or coalesce(input->>'phone','') !~ '^[0-9]{10,11}$' or coalesce(input->>'email','') not like '%@%' or length(coalesce(input->>'address',''))<5 or (input->>'terms_version')::uuid is null then raise exception using errcode='23514',message='Incomplete public configuration';end if;
 insert into public.system_settings(key,value,version) values('public_site',input,1) on conflict(key) do update set value=excluded.value,version=system_settings.version+1 returning version into v;
 return v;
end $$;
revoke all on function public.set_public_site(jsonb,integer) from public,anon,authenticated,service_role;
grant execute on function public.set_public_site(jsonb,integer) to authenticated;
create function public.public_booking_options() returns jsonb language sql stable security definer set search_path='' as $$
select case when app_private.site_enabled() then jsonb_build_object(
 'branches',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from public.branches where active and archived_at is null),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'description',description,'capacity',capacity) order by name,id) from public.vehicle_categories where active and archived_at is null),'[]'::jsonb),
 'plans',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',period_unit,'timezone',policy->>'timezone') order by name,id) from public.rate_plans where active and archived_at is null and public_enabled and policy->>'engine'='v1'),'[]'::jsonb),
 'services',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'unit',unit,'amount',amount::text) order by name,id) from public.additional_services where active and archived_at is null and public_enabled),'[]'::jsonb)) end
$$;
revoke all on function public.public_booking_options() from public,anon,authenticated,service_role;
grant execute on function public.public_booking_options() to anon,authenticated,service_role;
create function public.public_catalog(filters jsonb,vehicle_id uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare p integer:=coalesce((filters->>'page')::integer,1); q text:=coalesce(filters->>'q',''); rows jsonb; n integer;
begin
 if not app_private.site_enabled() then return null;end if;
 if p not between 1 and 10000 or length(q)>100 then raise exception using errcode='22023',message='Invalid filters';end if;
 select count(*)::integer into n from public.vehicles v join public.vehicle_categories c on c.id=v.category_id join public.branches b on b.id=v.branch_id
 where v.operational_status='ACTIVE' and v.archived_at is null and c.active and c.archived_at is null and b.active and b.archived_at is null
 and (vehicle_id is null or v.id=vehicle_id) and (filters->>'category' is null or v.category_id=(filters->>'category')::uuid) and (filters->>'branch' is null or v.branch_id=(filters->>'branch')::uuid)
 and (q='' or position(lower(q) in lower(v.make||' '||v.model))>0);
 select coalesce(jsonb_agg(t.data order by t.make,t.model,t.id),'[]'::jsonb) into rows from (
 select v.id,v.make,v.model,jsonb_build_object('id',v.id,'category_id',v.category_id,'category',c.name,'branch_id',v.branch_id,'branch',b.name,'make',v.make,'model',v.model,'version',v.version,'model_year',v.model_year,'passengers',v.passengers,'doors',v.doors,'fuel',v.fuel,'transmission',v.transmission,'description',v.description,'features',v.features,
 'image_id',(select f.id from public.registry_files f where f.vehicle_id=v.id and f.kind='VEHICLE_IMAGE' and f.status='READY' and f.public_visible order by f.created_at,f.id limit 1)) data
 from public.vehicles v join public.vehicle_categories c on c.id=v.category_id join public.branches b on b.id=v.branch_id
 where v.operational_status='ACTIVE' and v.archived_at is null and c.active and c.archived_at is null and b.active and b.archived_at is null
 and (vehicle_id is null or v.id=vehicle_id) and (filters->>'category' is null or v.category_id=(filters->>'category')::uuid) and (filters->>'branch' is null or v.branch_id=(filters->>'branch')::uuid)
 and (q='' or position(lower(q) in lower(v.make||' '||v.model))>0)
 order by v.make,v.model,v.id limit 24 offset (p-1)*24) t;
 return jsonb_build_object('data',rows,'meta',jsonb_build_object('page',p,'pageSize',24,'total',n));
end $$;
revoke all on function public.public_catalog(jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.public_catalog(jsonb,uuid) to anon,authenticated,service_role;
create function public.publish_catalog_image(file_id uuid,published boolean) returns void language plpgsql security definer set search_path='' as $$
declare f public.registry_files;
begin
 select * into strict f from public.registry_files where id=file_id for update;
 if f.kind not in ('CATEGORY_IMAGE','VEHICLE_IMAGE') or f.status<>'READY' then raise exception using errcode='23514',message='Only ready catalog images';end if;
 perform app_private.require_permission(case f.kind when 'CATEGORY_IMAGE' then 'categories.write' else 'vehicles.write' end);
 update public.registry_files set public_visible=published where id=file_id;
end $$;
revoke all on function public.publish_catalog_image(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.publish_catalog_image(uuid,boolean) to authenticated;
create function public.public_image_path(file_id uuid) returns text language sql stable security definer set search_path='' as $$
 select f.storage_path from public.registry_files f join public.vehicles v on v.id=f.vehicle_id join public.vehicle_categories c on c.id=v.category_id join public.branches b on b.id=v.branch_id where f.id=file_id and f.kind='VEHICLE_IMAGE' and f.status='READY' and f.public_visible and app_private.site_enabled() and v.archived_at is null and v.operational_status='ACTIVE' and c.active and c.archived_at is null and b.active and b.archived_at is null
$$;
revoke all on function public.public_image_path(uuid) from public,anon,authenticated,service_role;
grant execute on function public.public_image_path(uuid) to service_role;
revoke all on function app_private.site_enabled() from public,anon,authenticated,service_role;
-- Projeções legadas continuam mínimas. Publicação de negócio é controlada pelos endpoints novos.
alter function app_private.guard_registry_file() rename to legacy_guard_registry_file;
-- Reaplica o guard com exceção restrita para publicar/despublicar fotos prontas.
drop trigger registry_file_guard on public.registry_files;
create or replace function app_private.guard_registry_file() returns trigger language plpgsql security definer set search_path='' as $$
declare owner_archived timestamptz;owner_exists boolean:=false;
begin
 if tg_op='UPDATE' then
  if new.public_visible is distinct from old.public_visible then
   if (to_jsonb(new)-array['public_visible','updated_at']) is distinct from (to_jsonb(old)-array['public_visible','updated_at']) or old.status<>'READY' or new.kind not in ('CATEGORY_IMAGE','VEHICLE_IMAGE') then raise exception using errcode='23514',message='Publication cannot change content';end if;
   return new;
  end if;
  if (to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at']) or not ((old.status='PENDING' and new.status in ('READY','FAILED')) or (old.status='READY' and new.status='ARCHIVED')) then raise exception using errcode='23514',message='File immutable';end if;
  if new.status='READY' and not exists(select 1 from storage.objects where bucket_id=new.bucket and name=new.storage_path) then raise exception using errcode='23514',message='Stored object required';end if;
 else
  if new.status<>'PENDING' or new.public_visible then raise exception using errcode='23514',message='File must start private and pending';end if;
  if new.category_id is not null then select archived_at,true into owner_archived,owner_exists from public.vehicle_categories where id=new.category_id for share;
  elsif new.vehicle_id is not null then select archived_at,true into owner_archived,owner_exists from public.vehicles where id=new.vehicle_id for share;
  elsif new.customer_id is not null then select archived_at,true into owner_archived,owner_exists from public.customers where id=new.customer_id for share;
  else select archived_at,true into owner_archived,owner_exists from public.drivers where id=new.driver_id for share;end if;
  if not coalesce(owner_exists,false) or owner_archived is not null or not exists(select 1 from public.profiles where id=new.uploaded_by and active) then raise exception using errcode='23514',message='Owner unavailable';end if;
 end if;
 return new;
end $$;
create trigger registry_file_guard before insert or update on public.registry_files for each row execute function app_private.guard_registry_file();
revoke all on function app_private.guard_registry_file() from public,anon,authenticated,service_role;
alter function public.catalog_categories() rename to legacy_catalog_categories;
alter function public.legacy_catalog_categories() set schema app_private;
alter function public.catalog_vehicles(uuid,integer,integer) rename to legacy_catalog_vehicles;
alter function public.legacy_catalog_vehicles(uuid,integer,integer) set schema app_private;
revoke all on function app_private.legacy_catalog_categories(),app_private.legacy_catalog_vehicles(uuid,integer,integer) from public,anon,authenticated,service_role;
create function public.catalog_categories() returns table(id uuid,name text,description text,capacity integer,features jsonb) language sql stable security definer set search_path='' as $$select * from app_private.legacy_catalog_categories() where app_private.site_enabled()$$;
create function public.catalog_vehicles(requested_category_id uuid default null,page integer default 1,page_size integer default 24) returns table(id uuid,category_id uuid,make text,model text,version text,model_year integer,passengers integer,doors integer,fuel text,transmission text,description text,features jsonb) language sql stable security definer set search_path='' as $$select x.* from app_private.legacy_catalog_vehicles(requested_category_id,page,page_size) x join public.vehicles v on v.id=x.id join public.branches b on b.id=v.branch_id where app_private.site_enabled() and b.archived_at is null$$;
revoke all on function public.catalog_categories(),public.catalog_vehicles(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.catalog_categories(),public.catalog_vehicles(uuid,integer,integer) to anon,authenticated;
