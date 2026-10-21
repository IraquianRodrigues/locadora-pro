-- Fase 7. Nenhum preço, dispensa financeira ou texto jurídico é aprovado por seed.
-- Trigger compartilhado: campos específicos só são preparados no ramo da sua tabela.
create or replace function app_private.guard_registry_reference() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name in ('reservations','rentals') then
  if new.status in ('REQUESTED','UNDER_REVIEW','CONFIRMED','PREPARING','ACTIVE','OVERDUE') then
   perform 1 from public.customers where id=new.customer_id and archived_at is null for share;
   if not found then raise exception using errcode='23514',message='Customer archived'; end if;
  end if;
 elsif tg_table_name='vehicle_allocations' then
  if new.released_at is null then
   perform 1 from public.vehicles where id=new.vehicle_id and archived_at is null and operational_status<>'RETIRED'
    and (new.kind in ('BLOCK','MAINTENANCE') or operational_status='ACTIVE') for share;
   if not found then raise exception using errcode='23514',message='Vehicle unavailable'; end if;
  end if;
 elsif tg_table_name='rental_drivers' then
  perform 1 from public.drivers where id=new.driver_id and archived_at is null for share;
  if not found then raise exception using errcode='23514',message='Driver archived'; end if;
 end if; return new;
end;
$$;
alter table public.rentals add column version integer not null default 1 check(version>0);
alter table public.contracts add column attempts integer not null default 0 check(attempts>=0);
alter table public.contracts add column available_at timestamptz not null default now();
alter table public.contracts add column lease_token uuid;
alter table public.contracts add column locked_until timestamptz;
alter table public.contracts add column last_error_code text;
create index contract_jobs on public.contracts(available_at,id) where generation_status in ('PENDING','FAILED');
alter table public.inspection_photos add column status text not null default 'PENDING' check(status in ('PENDING','READY','FAILED'));
alter table public.inspection_photos add column byte_size integer check(byte_size between 1 and 4194304);
-- Evidências legadas exigem reconciliação com Storage antes de serem marcadas READY.
create unique index rental_quote_once on public.rentals(quote_id);
create unique index extension_quote_once on public.rental_extensions(quote_id);
create unique index damage_charge_once on public.charges(damage_id) where damage_id is not null;
create index rental_locations_parent on public.rental_locations(rental_id);
create index rental_location_responsible on public.rental_locations(responsible_id);
insert into public.contract_templates(template_key,version,body,review_status) values('BASE_REVISAO_JURIDICA',1,
 'RASCUNHO: REVISÃO JURÍDICA OBRIGATÓRIA. Este modelo não contém cláusulas definitivas. A locadora deverá definir e revisar responsabilidades, assistência, conservação, comunicação de ocorrências, uso autorizado, critérios de danos, cancelamento e solução de conflitos antes de aprovar uma nova versão. Dados das partes e condições comerciais serão acrescentados pelo sistema. Não utilizar este rascunho em contratação real.',
 'LEGAL_REVIEW_REQUIRED') on conflict(template_key,version) do nothing;

create table public.rental_events (
 id uuid primary key default gen_random_uuid(), rental_id uuid not null references public.rentals(id),
 actor_id uuid references public.profiles(id), event_type text not null, detail jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('rental_events','rentals.read');
create index on public.rental_events(rental_id,created_at);
create index on public.rental_events(actor_id);
create trigger immutable_event before update or delete on public.rental_events for each row execute function app_private.reject_mutation();
create trigger audit_change after insert on public.rental_events for each row execute function app_private.record_audit('OPERATIONS');
create table public.rental_charge_cancellations (
 id uuid primary key default gen_random_uuid(), charge_id uuid not null unique references public.charges(id),
 rental_id uuid not null references public.rentals(id), reason text not null check(length(btrim(reason)) between 5 and 1000),
 actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('rental_charge_cancellations','finance.read');
create index on public.rental_charge_cancellations(rental_id);
create index on public.rental_charge_cancellations(actor_id);
create trigger immutable_cancellation before update or delete on public.rental_charge_cancellations for each row execute function app_private.reject_mutation();
create trigger audit_change after insert on public.rental_charge_cancellations for each row execute function app_private.record_audit('FINANCE');

create function app_private.rental_version() returns trigger language plpgsql set search_path='' as $$
begin new.version:=old.version+1; return new; end;
$$;
create trigger rental_version before update on public.rentals for each row execute function app_private.rental_version();
create trigger immutable_inspection_template before update or delete on public.inspection_templates for each row execute function app_private.reject_mutation();

create function app_private.valid_rental_policy(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and p->>'version'='1'
 and p->>'checkout_payment' in ('FULL','NONE') and p->>'checkin_balance' in ('SETTLED','ALLOW_DUE')
 and jsonb_typeof(p->'require_deposit')='boolean' and jsonb_typeof(p->'require_documents')='boolean'
 and jsonb_typeof(p->'license_categories')='array' and jsonb_array_length(p->'license_categories') between 1 and 10
 and not exists(select 1 from jsonb_array_elements_text(p->'license_categories') x where x not in ('B','C','D','E','AB','AC','AD','AE'))
 and (p->>'inspection_template_id') ~ '^[a-f0-9-]{36}$' and (p->>'contract_template_id') ~ '^[a-f0-9-]{36}$'
 and (p->>'included_km_per_day') ~ '^[0-9]{1,7}$'
 and (p->>'late_tolerance_minutes') ~ '^[0-9]{1,4}$' and (p->>'late_tolerance_minutes')::integer<=1440
 and not exists(select 1 from unnest(array['extra_km_amount','fuel_percent_amount','late_hour_amount']) k
   where p->>k is null or p->>k !~ '^[0-9]{1,8}\.[0-9]{2}$'),false);
$$;
create function public.rental_setup(input jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; entity uuid; p jsonb:=input->'policy'; entries jsonb:=input->'checklist';
begin
 perform app_private.require_permission('settings.manage');
 result:=app_private.begin_operation('rental_setup',idempotency_key,input); if result is not null then return result; end if;
 perform pg_advisory_xact_lock(187640,7);
 if input->>'kind'='COMPANY' then
   if coalesce(length(btrim(input->>'legal_name')),0) not between 1 and 200 or not coalesce(app_private.valid_cnpj(input->>'tax_document'),false)
    or not app_private.valid_br_address(input->'contact'->'address') or coalesce(input->'contact'->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or coalesce(input->'contact'->>'phone','') !~ '^[0-9]{10,11}$' then raise exception using errcode='22023',message='Configure company identity, address and contact'; end if;
   if exists(select 1 from public.company_settings where singleton and updated_at is distinct from (input->>'expected_updated_at')::timestamptz) then raise exception using errcode='40001',message='Company changed'; end if;
   insert into public.company_settings(legal_name,tax_document,contact,timezone) values(input->>'legal_name',input->>'tax_document',input->'contact',input->>'timezone')
    on conflict(singleton) do update set legal_name=excluded.legal_name,tax_document=excluded.tax_document,contact=excluded.contact,timezone=excluded.timezone returning id into entity;
 elsif input->>'kind'='POLICY' then
   if not app_private.valid_rental_policy(p) then raise exception using errcode='22023',message='Configure all operational rules'; end if;
   perform 1 from public.inspection_templates where id=(p->>'inspection_template_id')::uuid and active;
   if not found then raise exception using errcode='23514',message='Inspection template unavailable'; end if;
   perform 1 from public.contract_templates where id=(p->>'contract_template_id')::uuid and review_status='APPROVED';
   if not found then raise exception using errcode='23514',message='Legal review required'; end if;
   if exists(select 1 from public.system_settings where key='rental_policy' and updated_at is distinct from (input->>'expected_updated_at')::timestamptz) then
    raise exception using errcode='40001',message='Settings changed'; end if;
   insert into public.system_settings(key,value) values('rental_policy',p) on conflict(key) do update set value=excluded.value;
 elsif input->>'kind'='CONTRACT_TEMPLATE' then
   if coalesce(length(btrim(input->>'body')),0) not between 30 and 40000 or coalesce(length(btrim(input->>'name')),0) not between 1 and 100
    or (input->>'version')::integer<1 or input->>'review_status' not in ('LEGAL_REVIEW_REQUIRED','APPROVED') then raise exception using errcode='22023',message='Invalid contract template'; end if;
   if input->>'review_status'='APPROVED' and input->>'legal_review_confirmed' is distinct from 'true' then raise exception using errcode='23514',message='Explicit legal review confirmation required'; end if;
   insert into public.contract_templates(template_key,version,body,review_status) values(input->>'name',(input->>'version')::integer,input->>'body',input->>'review_status') returning id into entity;
 elsif input->>'kind'='INSPECTION_TEMPLATE' then
   if coalesce(length(btrim(input->>'name')),0) not between 1 and 100 or (input->>'version')::integer<1
     or jsonb_typeof(entries) is distinct from 'array' or jsonb_array_length(entries) not between 1 and 80 then raise exception using errcode='22023',message='Invalid checklist'; end if;
   if exists(select 1 from jsonb_array_elements(entries) x where coalesce(x->>'key','') !~ '^[a-z0-9_]{1,50}$' or coalesce(length(btrim(x->>'label')),0) not between 1 and 160 or jsonb_typeof(x->'photo_required') is distinct from 'boolean')
    or (select count(distinct x->>'key') from jsonb_array_elements(entries) x)<>jsonb_array_length(entries) then raise exception using errcode='22023',message='Invalid checklist items'; end if;
   insert into public.inspection_templates(name,version,checklist) values(input->>'name',(input->>'version')::integer,entries) returning id into entity;
 else raise exception using errcode='22023',message='Unknown setup command'; end if;
 return app_private.finish_operation('rental_setup',idempotency_key,jsonb_build_object('id',entity));
end;
$$;

create function app_private.rental_due(entity uuid) returns numeric language sql stable set search_path='' as $$
 select coalesce(sum(c.amount-coalesce((select sum(a.amount) from public.payment_allocations a where a.charge_id=c.id),0)
 +coalesce((select sum(f.amount) from public.refunds f join public.payment_allocations a on a.id=f.payment_allocation_id where a.charge_id=c.id),0)
 -coalesce((select sum(d.amount) from public.deposits d where d.applied_charge_id=c.id),0)),0)
 from public.charges c where c.rental_id=entity and not exists(select 1 from public.rental_charge_cancellations v where v.charge_id=c.id);
$$;
-- Uma obrigação cancelada não aceita um recebimento novo por outro endpoint.
create function app_private.guard_cancelled_charge() returns trigger language plpgsql security definer set search_path='' as $$
declare entity uuid:=coalesce(to_jsonb(new)->>'charge_id',to_jsonb(new)->>'applied_charge_id')::uuid;
begin
 perform pg_advisory_xact_lock(187640,2);
 if exists(select 1 from public.rental_charge_cancellations where charge_id=entity) then raise exception using errcode='23514',message='Charge cancelled'; end if;
 return new;
end;
$$;
create trigger cancelled_charge before insert on public.payment_allocations for each row execute function app_private.guard_cancelled_charge();
create trigger cancelled_charge before insert on public.deposits for each row execute function app_private.guard_cancelled_charge();

create function app_private.rental_contract_data(entity uuid,template uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('schema_version',1,'rental_id',r.id,'start_at',r.start_at,'end_at',r.end_at,
 'customer',jsonb_build_object('name',c.name,'tax_document',c.tax_document,'email',c.email,'phone',c.phone,'address',c.address),
 'vehicle',jsonb_build_object('plate',v.plate,'make',v.make,'model',v.model,'model_year',v.model_year),
 'branch',jsonb_build_object('name',b.name,'address',b.address),
 'company',r.commercial_snapshot->'company','commercial',r.commercial_snapshot,
 'drivers',coalesce((select jsonb_agg(d.driver_snapshot order by d.driver_id) from public.rental_drivers d where d.rental_id=r.id),'[]'::jsonb),
 'locations',coalesce((select jsonb_agg(jsonb_build_object('direction',l.direction,'mode',l.mode,'address',l.address_snapshot,'fee',l.fee,'scheduled_at',l.scheduled_at,'instructions',l.instructions) order by l.direction) from public.rental_locations l where l.rental_id=r.id),'[]'::jsonb),
 'initial_inspection',(select jsonb_build_object('id',i.id,'mileage',i.mileage,'fuel',i.fuel,'checklist',i.checklist_snapshot,'completed_at',i.completed_at,
  'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',ph.id,'item_id',ph.item_id,'sha256',ph.sha256) order by ph.id),'[]'::jsonb) from public.inspection_photos ph where ph.inspection_id=i.id and ph.status='READY'),
  'items',(select jsonb_agg(jsonb_build_object('key',x.item_key,'condition',x.condition,'notes',x.notes) order by x.item_key) from public.inspection_items x where x.inspection_id=i.id))
  from public.inspections i where i.rental_id=r.id and kind='INITIAL' and completed_at is not null order by completed_at desc,id limit 1),
 'template',jsonb_build_object('id',t.id,'key',t.template_key,'version',t.version,'body',t.body,'review_status',t.review_status))
 from public.rentals r join public.customers c on c.id=r.customer_id join public.vehicles v on v.id=r.vehicle_id
 join public.branches b on b.id=r.branch_id join public.contract_templates t on t.id=template where r.id=entity;
$$;
create function app_private.enqueue_rental_contract(entity uuid) returns uuid language plpgsql set search_path='' as $$
declare r public.rentals; template uuid; snap jsonb; cid uuid;
begin
 select * into strict r from public.rentals where id=entity for update;
 template:=(r.commercial_snapshot->'operations'->>'contract_template_id')::uuid;
 perform 1 from public.contract_templates where id=template and review_status='APPROVED';
 if not found then raise exception using errcode='23514',message='Approved template required'; end if;
 snap:=app_private.rental_contract_data(r.id,template);
 if snap->'initial_inspection'='null'::jsonb or jsonb_array_length(snap->'drivers')=0 then raise exception using errcode='23514',message='Complete initial inspection and select drivers first'; end if;
 select id into cid from public.contracts where rental_id=entity and snapshot=snap order by version desc limit 1;
 if cid is not null then return cid; end if;
 insert into public.contracts(rental_id,template_id,version,snapshot)
 select r.id,template,coalesce(max(version),0)+1,snap from public.contracts where rental_id=r.id returning id into cid;
 return cid;
end;
$$;

create function public.create_rental(input jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; res public.reservations; q public.quotes; v public.vehicles; a public.vehicle_allocations;
 policy jsonb; company jsonb; rid uuid; qinput jsonb; direction text; addr jsonb; mode text; fee numeric;
begin
 perform app_private.require_permission('rentals.create');
 perform app_private.require_permission('customers.read'); perform app_private.require_permission('pricing.read');
 result:=app_private.begin_operation('create_rental',idempotency_key,input); if result is not null then return result; end if;
 select value into policy from public.system_settings where key='rental_policy' for share;
 if not coalesce(app_private.valid_rental_policy(policy),false) then raise exception using errcode='23514',message='Configure rental operations first'; end if;
 select jsonb_build_object('legal_name',c.legal_name,'tax_document',c.tax_document,'contact',c.contact,'timezone',c.timezone) into company from public.company_settings c where singleton for share;
 if company is null or not app_private.valid_br_address(company->'contact'->'address') then raise exception using errcode='23514',message='Configure company identity first'; end if;
 if input->>'reservation_id' is not null then
  perform app_private.require_permission('reservations.read');
  select * into strict res from public.reservations where id=(input->>'reservation_id')::uuid for update;
  if res.status<>'CONFIRMED' or res.version is distinct from (input->>'expected_version')::integer then raise exception using errcode='40001',message='Reservation changed or not confirmed'; end if;
  select * into strict a from public.vehicle_allocations where reservation_id=res.id and released_at is null;
  select * into strict q from public.quotes where id=res.quote_id for update;
  select * into strict v from public.vehicles where id=a.vehicle_id for update;
 else
  select * into strict q from public.quotes where id=(input->>'quote_id')::uuid for update;
  if q.expires_at<=now() or exists(select 1 from public.reservations where quote_id=q.id) then raise exception using errcode='23514',message='Quote expired or reserved'; end if;
  select * into strict v from public.vehicles where id=(input->>'vehicle_id')::uuid for update;
 end if;
 qinput:=q.rules_snapshot->'input';
 if q.rules_snapshot->>'engine' is distinct from 'v1' or q.locked_at is null or q.customer_id is null or q.end_at<=now()
  or v.operational_status<>'ACTIVE' or v.archived_at is not null or v.branch_id is distinct from (qinput->>'branch_id')::uuid
  or ((qinput->>'vehicle_id') is not null and v.id<>(qinput->>'vehicle_id')::uuid)
  or ((qinput->>'category_id') is not null and v.category_id<>(qinput->>'category_id')::uuid)
  or exists(select 1 from public.rental_extensions where quote_id=q.id)
  or exists(select 1 from public.rentals where vehicle_id=v.id and status in ('ACTIVE','OVERDUE') and end_at<now()) then
  raise exception using errcode='23514',message='Unavailable vehicle or invalid quote'; end if;
 insert into public.rentals(reservation_id,customer_id,vehicle_id,branch_id,quote_id,responsible_id,start_at,end_at,commercial_snapshot)
 values(res.id,q.customer_id,v.id,v.branch_id,q.id,auth.uid(),q.start_at,q.end_at,
 jsonb_build_object('workflow','v1','company',company,'total',q.total,'deposit',q.deposit,'quote',q.rules_snapshot,'operations',policy,'extensions','[]'::jsonb)) returning id into rid;
 if res.id is not null then
  update public.vehicle_allocations set kind='RENTAL',rental_id=rid,reservation_id=null where id=a.id;
  perform set_config('app.reservation_reason','Conversão em locação',true);
  update public.reservations set status='CONVERTED' where id=res.id;
  insert into public.rental_locations(rental_id,branch_id,direction,mode,address_snapshot,fee,scheduled_at,instructions)
   select rid,l.branch_id,l.direction,l.mode,l.address_snapshot,l.fee,l.scheduled_at,l.instructions from public.reservation_locations l where l.reservation_id=res.id;
 else
  insert into public.vehicle_allocations(vehicle_id,period,kind,rental_id,created_by)
   values(v.id,app_private.occupancy_period(q.start_at,q.end_at,q.id),'RENTAL',rid,auth.uid());
  foreach direction in array array['PICKUP','RETURN'] loop
   mode:=qinput->>case direction when 'PICKUP' then 'pickup_mode' else 'return_mode' end;
   if mode='BRANCH' then select address into addr from public.branches where id=v.branch_id;
   else addr:=qinput->case direction when 'PICKUP' then 'pickup_address' else 'return_address' end; end if;
   select coalesce(sum(total),0) into fee from public.quote_items where quote_id=q.id and kind=case direction when 'PICKUP' then 'DELIVERY' else 'COLLECTION' end;
   insert into public.rental_locations(rental_id,branch_id,direction,mode,address_snapshot,fee,scheduled_at,instructions)
    values(rid,case when mode='BRANCH' then v.branch_id end,direction,mode,addr,fee,case direction when 'PICKUP' then q.start_at else q.end_at end,qinput->>'instructions');
  end loop;
 end if;
 if (select count(*) from public.rental_locations where rental_id=rid)<>2 then raise exception using errcode='23514',message='Both logistics directions required'; end if;
 if q.total>0 then insert into public.charges(customer_id,rental_id,kind,amount,due_at,description) values(q.customer_id,rid,'RENTAL',q.total,q.start_at,'Locação e serviços contratados'); end if;
 insert into public.rental_events(rental_id,actor_id,event_type) values(rid,auth.uid(),'CREATED');
 insert into public.outbox_events(event_type,payload,deduplication_key) values('rental.created',jsonb_build_object('rental_id',rid),'rental:'||rid||':created');
 return app_private.finish_operation('create_rental',idempotency_key,jsonb_build_object('id',rid,'status','PREPARING'));
end;
$$;

create function public.rental_command(input jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare action text:=input->>'action'; result jsonb; r public.rentals; p jsonb; i public.inspections; t public.inspection_templates;
 driver_row public.drivers; entry jsonb; iid uuid; cid uuid; latest public.contracts; remaining numeric;
 extra_km numeric; extra_fuel numeric; extra_late numeric; extra_total numeric; closure jsonb; until_date date;
begin
 perform app_private.require_permission('rentals.read');
 perform app_private.require_permission(case action when 'DRIVERS' then 'rentals.create' when 'INSPECTION' then 'inspections.write'
 when 'ITEMS' then 'inspections.write' when 'COMPLETE_INSPECTION' then 'inspections.write'
 when 'CONTRACT' then 'contracts.generate' when 'RETRY_CONTRACT' then 'contracts.generate' when 'CHECKOUT' then 'rentals.checkout'
 when 'CHECKIN' then 'rentals.checkin' when 'CANCEL' then 'rentals.create' when 'LOGISTICS' then 'rentals.create' when 'ASSESS_DAMAGE' then 'charges.create' else 'invalid' end);
 result:=app_private.begin_operation('rental_command',idempotency_key,input); if result is not null then return result; end if;
 select * into strict r from public.rentals where id=(input->>'rental_id')::uuid for update;
 if r.version is distinct from (input->>'expected_version')::integer then raise exception using errcode='40001',message='Rental changed'; end if;
 p:=r.commercial_snapshot->'operations';
 if r.commercial_snapshot->>'workflow' is distinct from 'v1' or r.status in ('COMPLETED','CANCELLED') then raise exception using errcode='23514',message='Rental is closed or requires migration'; end if;
 if action in ('DRIVERS','CONTRACT','CHECKOUT','CANCEL') and r.status<>'PREPARING' then raise exception using errcode='23514',message='Rental already started'; end if;
 if action='DRIVERS' then
  perform app_private.require_permission('drivers.read');
  if jsonb_typeof(input->'driver_ids') is distinct from 'array' or jsonb_array_length(input->'driver_ids') not between 1 and 10
   or (select count(distinct x) from jsonb_array_elements_text(input->'driver_ids') x)<>jsonb_array_length(input->'driver_ids') then raise exception using errcode='22023',message='Select unique drivers'; end if;
  delete from public.rental_drivers where rental_id=r.id;
  for driver_row in select * from public.drivers where id in(select x::uuid from jsonb_array_elements_text(input->'driver_ids') x) for share loop
   if driver_row.customer_id<>r.customer_id or driver_row.archived_at is not null or not (p->'license_categories' ? driver_row.license_category)
    or driver_row.license_expires_on<(r.end_at at time zone (r.commercial_snapshot->'quote'->'policy'->>'timezone'))::date then raise exception using errcode='23514',message='Driver unavailable or license invalid through rental end'; end if;
   insert into public.rental_drivers(rental_id,driver_id,customer_id,driver_snapshot) values(r.id,driver_row.id,r.customer_id,
    jsonb_build_object('id',driver_row.id,'name',driver_row.name,'cpf',driver_row.cpf,'license_number',driver_row.license_number,'license_category',driver_row.license_category,'license_expires_on',driver_row.license_expires_on));
  end loop;
  if (select count(*) from public.rental_drivers where rental_id=r.id)<>jsonb_array_length(input->'driver_ids') then raise exception using errcode='23514',message='Driver missing'; end if;
 elsif action='INSPECTION' then
  if input->>'kind' is null or (input->>'kind'='INITIAL' and r.status<>'PREPARING') or (input->>'kind'='FINAL' and r.status not in ('ACTIVE','OVERDUE'))
   or input->>'kind' not in ('INITIAL','FINAL') or r.commercial_snapshot ? 'closing' then raise exception using errcode='23514',message='Invalid inspection stage'; end if;
  select * into strict t from public.inspection_templates where id=(p->>'inspection_template_id')::uuid and active;
  insert into public.inspections(rental_id,template_id,inspector_id,kind,mileage,fuel,checklist_snapshot,notes)
   values(r.id,t.id,auth.uid(),input->>'kind',(input->>'mileage')::bigint,(input->>'fuel')::numeric,t.checklist,input->>'notes') returning id into iid;
 elsif action in ('ITEMS','COMPLETE_INSPECTION') then
  select * into strict i from public.inspections where id=(input->>'inspection_id')::uuid and rental_id=r.id for update;
  if i.completed_at is not null or (i.kind='INITIAL' and r.status<>'PREPARING') or (i.kind='FINAL' and r.status not in ('ACTIVE','OVERDUE')) or r.commercial_snapshot ? 'closing' then raise exception using errcode='23514',message='Inspection immutable or invalid stage'; end if;
  iid:=i.id;
  if action='ITEMS' then
   if jsonb_typeof(input->'items') is distinct from 'array' or jsonb_array_length(input->'items')<>jsonb_array_length(i.checklist_snapshot)
    or (select count(distinct x->>'key') from jsonb_array_elements(input->'items') x)<>jsonb_array_length(i.checklist_snapshot) then raise exception using errcode='22023',message='Full checklist required'; end if;
   for entry in select * from jsonb_array_elements(input->'items') loop
    if not exists(select 1 from jsonb_array_elements(i.checklist_snapshot) x where x->>'key'=entry->>'key')
     or entry->>'condition' is null or entry->>'condition' not in ('OK','DAMAGE','MISSING','NOT_APPLICABLE')
     or (entry->>'condition' in ('DAMAGE','MISSING') and coalesce(length(btrim(entry->>'notes')),0)<5)
     or coalesce(length(entry->>'notes'),0)>1000 then raise exception using errcode='22023',message='Invalid checklist answer'; end if;
    insert into public.inspection_items(inspection_id,item_key,condition,notes) values(i.id,entry->>'key',entry->>'condition',entry->>'notes')
     on conflict(inspection_id,item_key) do update set condition=excluded.condition,notes=excluded.notes;
   end loop;
  else
   perform 1 from public.vehicles where id=r.vehicle_id for update;
   if i.mileage<coalesce(r.initial_mileage,(select mileage from public.vehicles where id=r.vehicle_id))
    or (select count(*) from public.inspection_items where inspection_id=i.id)<>jsonb_array_length(i.checklist_snapshot)
    or exists(select 1 from jsonb_array_elements(i.checklist_snapshot) x where not exists(
      select 1 from public.inspection_items a where a.inspection_id=i.id and a.item_key=x->>'key'
       and (not (x->>'photo_required')::boolean and a.condition not in ('DAMAGE','MISSING') or exists(
        select 1 from public.inspection_photos ph join storage.objects o on o.bucket_id='inspections' and o.name=ph.storage_path
        where ph.inspection_id=i.id and ph.item_id=a.id and ph.status='READY')))) then raise exception using errcode='23514',message='Incomplete checklist, photos or mileage'; end if;
   update public.inspections set completed_at=clock_timestamp() where id=i.id;
   if i.kind='FINAL' then
    insert into public.damages(vehicle_id,inspection_id,description) select r.vehicle_id,i.id,item_key||': '||notes from public.inspection_items where inspection_id=i.id and condition in ('DAMAGE','MISSING');
   end if;
  end if;
 elsif action='CONTRACT' then cid:=app_private.enqueue_rental_contract(r.id);
 elsif action='RETRY_CONTRACT' then
  update public.contracts set generation_status='PENDING',attempts=0,available_at=now(),last_error_code=null
   where id=(input->>'contract_id')::uuid and rental_id=r.id and generation_status='FAILED' and (locked_until is null or locked_until<now()) returning id into cid;
  if not found then raise exception using errcode='23514',message='Contract is not retryable'; end if;
 elsif action='LOGISTICS' then
  if input->>'direction' not in ('PICKUP','RETURN') or coalesce(length(btrim(input->>'notes')),0) not between 5 and 1000 then raise exception using errcode='22023',message='Logistics direction and notes required'; end if;
  if (input->>'direction'='PICKUP' and r.status<>'PREPARING') or (input->>'direction'='RETURN' and r.status not in ('ACTIVE','OVERDUE')) then raise exception using errcode='23514',message='Invalid logistics stage'; end if;
  update public.rental_locations set responsible_id=auth.uid(),performed_at=clock_timestamp(),notes=input->>'notes'
   where rental_id=r.id and direction=input->>'direction' and performed_at is null;
  if not found then raise exception using errcode='23514',message='Logistics already performed'; end if;
 elsif action='CHECKOUT' then
  perform pg_advisory_xact_lock(187640,2);
  perform 1 from public.vehicles where id=r.vehicle_id and operational_status='ACTIVE' and archived_at is null for update;
  if not found or now()<r.start_at or now()>=r.end_at or exists(select 1 from public.rentals x where x.vehicle_id=r.vehicle_id and x.id<>r.id and status in ('ACTIVE','OVERDUE')) then raise exception using errcode='23514',message='Vehicle still in use or outside checkout window'; end if;
  until_date:=(r.end_at at time zone (r.commercial_snapshot->'quote'->'policy'->>'timezone'))::date;
  perform 1 from public.drivers where id in(select driver_id from public.rental_drivers where rental_id=r.id) order by id for share;
  if not exists(select 1 from public.rental_drivers where rental_id=r.id) or exists(select 1 from public.rental_drivers rd join public.drivers d on d.id=rd.driver_id where rd.rental_id=r.id
   and (d.archived_at is not null or d.license_expires_on<greatest(current_date,until_date) or not(p->'license_categories' ? d.license_category)
    or rd.driver_snapshot is distinct from jsonb_build_object('id',d.id,'name',d.name,'cpf',d.cpf,'license_number',d.license_number,'license_category',d.license_category,'license_expires_on',d.license_expires_on))) then raise exception using errcode='23514',message='Revalidate drivers'; end if;
  if (p->>'require_documents')::boolean and (not exists(select 1 from public.registry_files where customer_id=r.customer_id and status='READY' and kind='CUSTOMER_DOCUMENT')
   or not exists(select 1 from public.registry_files where vehicle_id=r.vehicle_id and status='READY' and kind='VEHICLE_DOCUMENT')
   or exists(select 1 from public.rental_drivers rd where rd.rental_id=r.id and not exists(select 1 from public.registry_files f where f.driver_id=rd.driver_id and f.status='READY' and f.kind='DRIVER_DOCUMENT'))) then raise exception using errcode='23514',message='Required documents missing'; end if;
  select * into i from public.inspections where rental_id=r.id and kind='INITIAL' and completed_at is not null order by completed_at desc,id limit 1;
  if i.id is null or i.mileage<(select mileage from public.vehicles where id=r.vehicle_id) then raise exception using errcode='23514',message='Initial inspection required'; end if;
  select * into latest from public.contracts where rental_id=r.id order by version desc limit 1;
  if latest.id is null or latest.generation_status<>'GENERATED' or latest.snapshot is distinct from app_private.rental_contract_data(r.id,latest.template_id) then raise exception using errcode='23514',message='Current generated contract required'; end if;
  if exists(select 1 from public.rental_locations where rental_id=r.id and direction='PICKUP' and performed_at is null) then raise exception using errcode='23514',message='Record pickup logistics first'; end if;
  if p->>'checkout_payment'='FULL' and app_private.rental_due(r.id)>0 then raise exception using errcode='23514',message='Confirmed payment required'; end if;
  select coalesce(sum(case when kind='RECEIVED' then amount else -amount end),0)-coalesce((select sum(f.amount) from public.refunds f join public.deposits d on d.id=f.deposit_id where d.rental_id=r.id),0) into remaining from public.deposits where rental_id=r.id;
  if (p->>'require_deposit')::boolean and remaining<(r.commercial_snapshot->>'deposit')::numeric then raise exception using errcode='23514',message='Confirmed deposit required'; end if;
  update public.rentals set status='ACTIVE',actual_start_at=clock_timestamp(),initial_mileage=i.mileage,initial_fuel=i.fuel where id=r.id returning * into r;
  update public.vehicles set mileage=i.mileage where id=r.vehicle_id;
 elsif action='ASSESS_DAMAGE' then
  if r.status not in ('ACTIVE','OVERDUE') or r.commercial_snapshot ? 'closing'
   or coalesce(length(btrim(input->>'reason')),0) not between 5 and 1000
   or coalesce(input->>'amount','') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' then raise exception using errcode='22023',message='Damage assessment requires amount and reason before closing'; end if;
  perform 1 from public.damages d join public.inspections ins on ins.id=d.inspection_id where d.id=(input->>'damage_id')::uuid and ins.rental_id=r.id and ins.completed_at is not null and d.status='OPEN' for update of d;
  if not found then raise exception using errcode='23514',message='Damage already assessed or not part of this rental'; end if;
  if (input->>'amount')::numeric>0 then
   insert into public.charges(customer_id,rental_id,damage_id,kind,amount,due_at,description) values(r.customer_id,r.id,(input->>'damage_id')::uuid,'DAMAGE',(input->>'amount')::numeric,clock_timestamp(),input->>'reason');
  end if;
  update public.damages set status=case when (input->>'amount')::numeric=0 then 'RESOLVED' else 'ASSESSED' end where id=(input->>'damage_id')::uuid;
 elsif action='CHECKIN' then
  if r.status not in ('ACTIVE','OVERDUE') then raise exception using errcode='23514',message='Rental not active'; end if;
  perform pg_advisory_xact_lock(187640,2); perform 1 from public.vehicles where id=r.vehicle_id for update;
  if exists(select 1 from public.damages d join public.inspections ins on ins.id=d.inspection_id where ins.rental_id=r.id and d.status='OPEN') then raise exception using errcode='23514',message='Assess return damages before closing'; end if;
  closure:=r.commercial_snapshot->'closing';
  if closure is null then
   select * into i from public.inspections where rental_id=r.id and kind='FINAL' and completed_at is not null order by completed_at desc,id limit 1;
   if i.id is null or i.mileage<r.initial_mileage then raise exception using errcode='23514',message='Final inspection required'; end if;
   extra_km:=round(greatest(0,i.mileage-r.initial_mileage-(p->>'included_km_per_day')::numeric*greatest(1,ceil(extract(epoch from r.end_at-r.start_at)/86400)))*(p->>'extra_km_amount')::numeric,2);
   extra_fuel:=round(greatest(0,r.initial_fuel-i.fuel)*(p->>'fuel_percent_amount')::numeric,2);
   extra_late:=round(ceil(greatest(0,extract(epoch from i.completed_at-r.end_at)-(p->>'late_tolerance_minutes')::integer*60)/3600)*(p->>'late_hour_amount')::numeric,2);
   extra_total:=extra_km+extra_fuel+extra_late;
   closure:=jsonb_build_object('inspection_id',i.id,'returned_at',i.completed_at,'extra_km',extra_km,'extra_fuel',extra_fuel,'extra_late',extra_late,'total',extra_total);
   if extra_total>0 then insert into public.charges(customer_id,rental_id,kind,amount,due_at,description) values(r.customer_id,r.id,'RETURN_EXTRAS',extra_total,clock_timestamp(),'Excedentes: km, combustível e atraso conforme política contratada'); end if;
   update public.rentals set commercial_snapshot=jsonb_set(commercial_snapshot,'{closing}',closure) where id=r.id returning * into r;
  end if;
  select * into strict i from public.inspections where id=(closure->>'inspection_id')::uuid;
  if exists(select 1 from public.rental_locations where rental_id=r.id and direction='RETURN' and performed_at is null) then raise exception using errcode='23514',message='Record return logistics first'; end if;
  if p->>'checkin_balance'='SETTLED' and app_private.rental_due(r.id)>0 then
   insert into public.rental_events(rental_id,actor_id,event_type,detail) values(r.id,auth.uid(),'RETURN_AWAITING_PAYMENT',closure);
   return app_private.finish_operation('rental_command',idempotency_key,jsonb_build_object('id',r.id,'status',r.status,'version',r.version,'awaiting_payment',true));
  end if;
  update public.rentals set status='COMPLETED',actual_end_at=i.completed_at,final_mileage=i.mileage,final_fuel=i.fuel where id=r.id returning * into r;
  update public.vehicles set mileage=greatest(mileage,i.mileage) where id=r.vehicle_id;
  update public.vehicle_allocations set released_at=clock_timestamp() where rental_id=r.id and released_at is null;
 elsif action='CANCEL' then
  if coalesce(length(btrim(input->>'reason')),0) not between 5 and 1000 then raise exception using errcode='22023',message='Cancellation reason required'; end if;
  perform pg_advisory_xact_lock(187640,2);
  if exists(select 1 from public.payment_allocations a join public.charges c on c.id=a.charge_id where c.rental_id=r.id)
   or exists(select 1 from public.deposits where rental_id=r.id) then raise exception using errcode='23514',message='Resolve confirmed financial entries before cancellation'; end if;
  insert into public.rental_charge_cancellations(charge_id,rental_id,reason,actor_id) select id,r.id,input->>'reason',auth.uid() from public.charges where rental_id=r.id;
  update public.rentals set status='CANCELLED' where id=r.id returning * into r;
  update public.vehicle_allocations set released_at=clock_timestamp() where rental_id=r.id and released_at is null;
 end if;
 -- Versão também invalida formulários concorrentes que só alteraram tabelas filhas.
 if action not in ('CHECKOUT','CHECKIN','CANCEL') then update public.rentals set responsible_id=responsible_id where id=r.id returning * into r; end if;
 insert into public.rental_events(rental_id,actor_id,event_type,detail) values(r.id,auth.uid(),action,jsonb_strip_nulls(jsonb_build_object('inspection_id',iid,'contract_id',cid,'reason',input->>'reason','damage_id',input->>'damage_id','amount',input->>'amount')));
 insert into public.outbox_events(event_type,payload,deduplication_key) values('rental.'||lower(action),jsonb_build_object('rental_id',r.id),'rental:'||r.id||':'||r.version||':'||action);
 return app_private.finish_operation('rental_command',idempotency_key,jsonb_strip_nulls(jsonb_build_object('id',r.id,'status',r.status,'version',r.version,'inspection_id',iid,'contract_id',cid)));
end;
$$;

-- Upload de fotos passa exclusivamente pelo servidor: conteúdo normalizado e finalização com sessão viva.
alter policy locadora_object_insert on storage.objects with check(false);
create or replace function app_private.can_access_object(bucket text,path text,write_object boolean) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare f public.registry_files;
begin
 if bucket='inspections' then return not write_object and app_private.has_permission('inspections.read')
  and exists(select 1 from public.inspection_photos p where p.storage_path=path and p.status='READY' and p.inspection_id::text=split_part(path,'/',1)); end if;
 select * into f from public.registry_files where registry_files.bucket=can_access_object.bucket and storage_path=path;
 if found then return not write_object and f.status='READY' and app_private.registry_file_allowed(f.kind,false); end if;
 return app_private.legacy_can_access_object(bucket,path,write_object);
end;
$$;
-- ALTER FUNCTION mantém OID nas políticas existentes: apontar explicitamente para o wrapper novo.
alter policy locadora_object_read on storage.objects using(bucket_id in ('vehicle-images','documents','inspections','contracts') and app_private.can_access_object(bucket_id,name,false));
create function public.prepare_inspection_photo(input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare i public.inspections; r public.rentals; pid uuid:=gen_random_uuid(); path text;
begin
 perform app_private.require_permission('inspections.write'); perform app_private.require_permission('rentals.read');
 -- Mesma ordem de locks do fluxo principal: locação -> vistoria.
 select * into strict r from public.rentals where id=(select rental_id from public.inspections where id=(input->>'inspection_id')::uuid) for update;
 select * into strict i from public.inspections where id=(input->>'inspection_id')::uuid for update;
 if i.completed_at is not null or r.status in ('COMPLETED','CANCELLED') or r.commercial_snapshot ? 'closing' then raise exception using errcode='23514',message='Evidence is frozen'; end if;
 path:=i.id||'/'||pid||'.jpg';
 insert into public.inspection_photos(id,inspection_id,item_id,storage_path,sha256,byte_size)
 values(pid,i.id,(input->>'item_id')::uuid,path,input->>'sha256',(input->>'byte_size')::integer);
 return jsonb_build_object('id',pid,'storage_path',path);
end;
$$;
create function public.finish_inspection_photo(photo_id uuid,success boolean) returns void
language plpgsql security definer set search_path='' as $$
declare ph public.inspection_photos;
begin
 perform app_private.require_permission('inspections.write'); perform app_private.require_permission('rentals.read');
 select * into strict ph from public.inspection_photos where id=photo_id;
 perform 1 from public.rentals where id=(select rental_id from public.inspections where id=ph.inspection_id) for update;
 perform 1 from public.inspections where id=ph.inspection_id and completed_at is null for update;
 if not found then raise exception using errcode='23514',message='Evidence frozen'; end if;
 if success and not exists(select 1 from storage.objects where bucket_id='inspections' and name=ph.storage_path) then raise exception using errcode='23514',message='Object missing'; end if;
 update public.inspection_photos set status=case when success then 'READY' else 'FAILED' end where id=ph.id and status='PENDING';
 if not found then raise exception using errcode='23514',message='Photo already finalized'; end if;
end;
$$;

-- Jobs com lease e token de tentativa. Uma tentativa expirada nunca publica o objeto de outra.
create function public.claim_contract_jobs(batch_size integer) returns setof public.contracts
language plpgsql security definer set search_path='' as $$
begin
 if batch_size is null or batch_size not between 1 and 10 then raise exception using errcode='22023',message='Invalid batch'; end if;
 return query update public.contracts c set lease_token=gen_random_uuid(),locked_until=now()+interval '2 minutes',attempts=c.attempts+1,generation_status='PENDING'
 where c.id in(select j.id from public.contracts j where j.generation_status in ('PENDING','FAILED') and j.attempts<5 and j.available_at<=now() and (j.locked_until is null or j.locked_until<now()) order by j.available_at,j.id for update skip locked limit batch_size) returning c.*;
end;
$$;
create function public.finish_contract_job(contract_id uuid,lease uuid,path text,file_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare c public.contracts;
begin
 select * into strict c from public.contracts where id=contract_id for update;
 if lease is null or c.locked_until is null or c.generation_status='GENERATED' or c.lease_token is distinct from lease or c.locked_until<clock_timestamp() then return false; end if;
 if path is not null and (path<>c.rental_id||'/'||lease||'.pdf' or file_hash !~ '^[a-f0-9]{64}$' or not exists(select 1 from storage.objects where bucket_id='contracts' and name=path)) then raise exception using errcode='23514',message='Invalid generated object'; end if;
 update public.contracts set generation_status=case when path is null then 'FAILED' else 'GENERATED' end,
  storage_path=path,sha256=file_hash,lease_token=null,locked_until=null,available_at=now()+make_interval(secs=>least(3600,attempts*60)),last_error_code=case when path is null then 'GENERATION_FAILED' end where id=c.id;
 return true;
end;
$$;
create function app_private.protect_contract_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.id,new.rental_id,new.template_id,new.version,new.snapshot) is distinct from row(old.id,old.rental_id,old.template_id,old.version,old.snapshot) then raise exception using errcode='23514',message='Contract snapshot immutable'; end if; return new;
end;
$$;
create trigger immutable_contract_snapshot before update on public.contracts for each row execute function app_private.protect_contract_snapshot();

create function public.mark_overdue_rentals(batch_size integer) returns integer
language plpgsql security definer set search_path='' as $$
declare r public.rentals; n integer:=0;
begin
 if batch_size is null or batch_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid batch'; end if;
 for r in select * from public.rentals where status='ACTIVE' and end_at<now() order by end_at,id for update skip locked limit batch_size loop
  update public.rentals set status='OVERDUE' where id=r.id;
  insert into public.rental_events(rental_id,event_type) values(r.id,'OVERDUE');
  insert into public.outbox_events(event_type,payload,deduplication_key) values('rental.overdue',jsonb_build_object('rental_id',r.id,'vehicle_id',r.vehicle_id),'rental:'||r.id||':overdue:'||r.end_at);
  n:=n+1;
 end loop; return n;
end;
$$;

-- Permissões explícitas; funções auxiliares nunca são endpoints.
alter function public.extend_rental(uuid,uuid,text) set schema app_private;
alter function app_private.extend_rental(uuid,uuid,text) rename to buffered_extend_rental;
revoke all on function app_private.buffered_extend_rental(uuid,uuid,text) from public,anon,authenticated,service_role;
create function public.extend_rental(rental_id uuid,quote_id uuid,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.rentals; q public.quotes; result jsonb; old_end timestamptz; cid uuid;
begin
 perform app_private.require_permission('rentals.extend');
 select * into strict r from public.rentals where id=rental_id for update;
 -- Preserva compatibilidade de dados legados; fluxo novo exige correspondência completa.
 if r.commercial_snapshot->>'workflow' is distinct from 'v1' then return app_private.buffered_extend_rental(rental_id,quote_id,idempotency_key); end if;
 result:=app_private.begin_operation('rental_extension_v1',idempotency_key,jsonb_build_object('rental',rental_id,'quote',quote_id)); if result is not null then return result; end if;
 select * into strict q from public.quotes where id=quote_id for update;
 if r.commercial_snapshot ? 'closing' or q.rules_snapshot->>'engine' is distinct from 'v1'
  or (q.rules_snapshot->'input'->>'branch_id')::uuid is distinct from r.branch_id
  or (q.rules_snapshot->'input'->>'vehicle_id')::uuid is distinct from r.vehicle_id
  or exists(select 1 from public.reservations where reservations.quote_id=q.id)
  or exists(select 1 from public.rentals where rentals.quote_id=q.id)
  or exists(select 1 from public.rental_extensions where rental_extensions.quote_id=q.id)
  or q.deposit<>0 or exists(select 1 from public.quote_items where quote_items.quote_id=q.id and kind in ('DELIVERY','COLLECTION')) then
  raise exception using errcode='23514',message='Extension requires same vehicle/branch, no repeat deposit or logistics'; end if;
 if exists(select 1 from public.rental_drivers rd join public.drivers d on d.id=rd.driver_id where rd.rental_id=r.id and (d.archived_at is not null or d.license_expires_on<(q.end_at at time zone (r.commercial_snapshot->'quote'->'policy'->>'timezone'))::date)) then raise exception using errcode='23514',message='License expires before extension'; end if;
 old_end:=r.end_at;
 result:=app_private.buffered_extend_rental(rental_id,quote_id,idempotency_key);
 update public.rentals set commercial_snapshot=jsonb_set(commercial_snapshot,'{extensions}',
  (select jsonb_agg(case when e->>'quote_id'=q.id::text then e||jsonb_build_object('previous_end_at',old_end,'end_at',q.end_at,'quote',q.rules_snapshot) else e end order by ord)
   from jsonb_array_elements(commercial_snapshot->'extensions') with ordinality a(e,ord))) where id=r.id;
 if q.total>0 then insert into public.charges(customer_id,rental_id,kind,amount,due_at,description) values(r.customer_id,r.id,'EXTENSION',q.total,old_end,'Prorrogação da locação'); end if;
 update public.rental_locations set scheduled_at=q.end_at where rental_locations.rental_id=r.id and direction='RETURN' and performed_at is null;
 if r.status='OVERDUE' and q.end_at>now() then update public.rentals set status='ACTIVE' where id=r.id; end if;
 -- Aditivo e cobrança na mesma transação da faixa; conflito desfaz todos os efeitos.
 cid:=app_private.enqueue_rental_contract(r.id);
 insert into public.rental_events(rental_id,actor_id,event_type,detail) values(r.id,auth.uid(),'EXTENDED',jsonb_build_object('quote_id',q.id,'contract_id',cid));
 return app_private.finish_operation('rental_extension_v1',idempotency_key,result||jsonb_build_object('contract_id',cid));
end;
$$;
revoke all on function public.extend_rental(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.extend_rental(uuid,uuid,text) to authenticated;

create or replace view public.finance_charge_balances with (security_barrier=true) as
select c.id,c.customer_id,c.rental_id,c.due_at,c.amount,
 case when exists(select 1 from public.rental_charge_cancellations v where v.charge_id=c.id) then 0::numeric else
 c.amount-coalesce((select sum(a.amount) from public.payment_allocations a where a.charge_id=c.id),0)
 +coalesce((select sum(f.amount) from public.refunds f join public.payment_allocations a on a.id=f.payment_allocation_id where a.charge_id=c.id),0)
 -coalesce((select sum(d.amount) from public.deposits d where d.applied_charge_id=c.id),0) end as balance
from public.charges c where app_private.has_permission('finance.read');

revoke all on function public.rental_setup(jsonb,text),public.create_rental(jsonb,text),public.rental_command(jsonb,text),public.prepare_inspection_photo(jsonb),public.finish_inspection_photo(uuid,boolean),public.claim_contract_jobs(integer),public.finish_contract_job(uuid,uuid,text,text),public.mark_overdue_rentals(integer) from public,anon,authenticated,service_role;
grant execute on function public.rental_setup(jsonb,text),public.create_rental(jsonb,text),public.rental_command(jsonb,text),public.prepare_inspection_photo(jsonb),public.finish_inspection_photo(uuid,boolean) to authenticated;
grant execute on function public.claim_contract_jobs(integer),public.finish_contract_job(uuid,uuid,text,text),public.mark_overdue_rentals(integer) to service_role;
revoke execute on all functions in schema app_private from public;
revoke all on function app_private.valid_rental_policy(jsonb),app_private.rental_due(uuid),app_private.rental_contract_data(uuid,uuid),app_private.enqueue_rental_contract(uuid) from anon,authenticated,service_role;
grant execute on function app_private.can_access_object(text,text,boolean) to authenticated;
