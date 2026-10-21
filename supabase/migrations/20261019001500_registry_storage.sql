-- Registro de arquivos com FKs reais, estado explícito e conteúdo imutável.
create table public.registry_files (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('CATEGORY_IMAGE','VEHICLE_IMAGE','VEHICLE_DOCUMENT','CUSTOMER_DOCUMENT','DRIVER_DOCUMENT')),
  category_id uuid references public.vehicle_categories(id), vehicle_id uuid references public.vehicles(id),
  customer_id uuid references public.customers(id), driver_id uuid references public.drivers(id),
  bucket text not null check(bucket in ('vehicle-images','documents')),
  storage_path text not null, label text not null check(length(btrim(label)) between 1 and 120),
  media_type text not null check(media_type in ('image/jpeg','application/pdf')),
  byte_size integer not null check(byte_size between 1 and 4194304), sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'PENDING' check(status in ('PENDING','READY','FAILED','ARCHIVED')),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(bucket,storage_path),
  check(num_nonnulls(category_id,vehicle_id,customer_id,driver_id)=1),
  check((kind='CATEGORY_IMAGE' and category_id is not null) or (kind in ('VEHICLE_IMAGE','VEHICLE_DOCUMENT') and vehicle_id is not null)
    or (kind='CUSTOMER_DOCUMENT' and customer_id is not null) or (kind='DRIVER_DOCUMENT' and driver_id is not null)),
  check((kind in ('CATEGORY_IMAGE','VEHICLE_IMAGE') and bucket='vehicle-images' and media_type='image/jpeg')
    or (kind in ('VEHICLE_DOCUMENT','CUSTOMER_DOCUMENT','DRIVER_DOCUMENT') and bucket='documents')),
  check(storage_path=coalesce(category_id,vehicle_id,customer_id,driver_id)::text||'/'||id::text||case when media_type='image/jpeg' then '.jpg' else '.pdf' end)
);
create index on public.registry_files(category_id,created_at);
create index on public.registry_files(vehicle_id,created_at);
create index on public.registry_files(customer_id,created_at);
create index on public.registry_files(driver_id,created_at);
select app_private.secure_table('registry_files',null);
create function app_private.audit_registry_file() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.audit_logs(actor_id,action,domain,entity_type,entity_id,safe_changes)
    values(coalesce(auth.uid(),new.uploaded_by),tg_op,'OPERATIONS','registry_files',new.id,jsonb_build_object('operation',tg_op,'status',new.status));
  return null;
end;
$$;
revoke all on function app_private.audit_registry_file() from public,anon,authenticated,service_role;
create trigger record_audit after insert or update on public.registry_files for each row execute function app_private.audit_registry_file();

create function app_private.registry_file_allowed(file_kind text, writing boolean) returns boolean
language sql stable security definer set search_path='' as $$
  select case file_kind
    when 'CATEGORY_IMAGE' then app_private.has_permission(case when writing then 'categories.write' else 'categories.read' end)
    when 'VEHICLE_IMAGE' then app_private.has_permission(case when writing then 'vehicles.write' else 'vehicles.read' end)
    when 'VEHICLE_DOCUMENT' then app_private.has_permission('vehicles.read') and app_private.has_permission(case when writing then 'documents.write' else 'documents.read' end)
    when 'CUSTOMER_DOCUMENT' then app_private.has_permission('customers.read') and app_private.has_permission(case when writing then 'documents.write' else 'documents.read' end)
    when 'DRIVER_DOCUMENT' then app_private.has_permission('drivers.read') and app_private.has_permission(case when writing then 'documents.write' else 'documents.read' end)
    else false end;
$$;
revoke all on function app_private.registry_file_allowed(text,boolean) from public,anon,authenticated,service_role;
grant execute on function app_private.registry_file_allowed(text,boolean) to authenticated;
grant select on public.registry_files to authenticated;
create policy registry_file_read on public.registry_files for select to authenticated using (app_private.registry_file_allowed(kind,false));

create function app_private.guard_registry_file() returns trigger
language plpgsql security definer set search_path='' as $$
declare owner_archived timestamptz; owner_exists boolean:=false;
begin
  if tg_op='UPDATE' then
    if (to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at'])
      or not ((old.status='PENDING' and new.status in ('READY','FAILED')) or (old.status='READY' and new.status='ARCHIVED')) then
      raise exception using errcode='23514',message='File content and lifecycle are immutable';
    end if;
    if new.status='READY' and not exists(select 1 from storage.objects where bucket_id=new.bucket and name=new.storage_path) then
      raise exception using errcode='23514',message='Stored object required';
    end if;
  else
    if new.status<>'PENDING' then raise exception using errcode='23514',message='File must start pending'; end if;
    if new.category_id is not null then select archived_at,true into owner_archived,owner_exists from public.vehicle_categories where id=new.category_id for share;
    elsif new.vehicle_id is not null then select archived_at,true into owner_archived,owner_exists from public.vehicles where id=new.vehicle_id for share;
    elsif new.customer_id is not null then select archived_at,true into owner_archived,owner_exists from public.customers where id=new.customer_id for share;
    else select archived_at,true into owner_archived,owner_exists from public.drivers where id=new.driver_id for share;
    end if;
    if not coalesce(owner_exists,false) or owner_archived is not null then raise exception using errcode='23514',message='File owner unavailable'; end if;
    if not exists(select 1 from public.profiles where id=new.uploaded_by and active) then raise exception using errcode='23514',message='Uploader inactive'; end if;
  end if;
  return new;
end;
$$;
revoke all on function app_private.guard_registry_file() from public,anon,authenticated,service_role;
create trigger registry_file_guard before insert or update on public.registry_files for each row execute function app_private.guard_registry_file();

create function public.archive_registry_file(file_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare f public.registry_files;
begin
  select * into f from public.registry_files where id=file_id for update;
  if not found or not app_private.registry_file_allowed(f.kind,true) then raise exception using errcode='42501',message='Access denied'; end if;
  if f.status<>'READY' then raise exception using errcode='23514',message='File unavailable'; end if;
  update public.registry_files set status='ARCHIVED' where id=f.id;
end;
$$;
revoke all on function public.archive_registry_file(uuid) from public,anon,authenticated,service_role;
grant execute on function public.archive_registry_file(uuid) to authenticated;

-- Wrapper conserva regras das evidências antigas; arquivos novos prevalecem inclusive após arquivamento.
alter function app_private.can_access_object(text,text,boolean) rename to legacy_can_access_object;
revoke all on function app_private.legacy_can_access_object(text,text,boolean) from public,anon,authenticated,service_role;
create function app_private.can_access_object(bucket text,path text,write_object boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare f public.registry_files;
begin
  select * into f from public.registry_files where registry_files.bucket=can_access_object.bucket and storage_path=path;
  if found then return not write_object and f.status='READY' and app_private.registry_file_allowed(f.kind,false); end if;
  return app_private.legacy_can_access_object(bucket,path,write_object);
end;
$$;
revoke all on function app_private.can_access_object(text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function app_private.can_access_object(text,text,boolean) to authenticated;
alter policy locadora_object_read on storage.objects using (bucket_id in ('vehicle-images','documents','inspections','contracts') and app_private.can_access_object(bucket_id,name,false));
-- Conteúdo dos cadastros só entra pelo servidor após validação; uploads diretos não contornam essa etapa.
alter policy locadora_object_insert on storage.objects with check (bucket_id='inspections' and app_private.can_access_object(bucket_id,name,true));
