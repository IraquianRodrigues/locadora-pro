create table public.public_booking_operations(
 id uuid primary key default gen_random_uuid(),visitor_hash text not null check(visitor_hash~'^[a-f0-9]{64}$'),operation text not null check(operation in ('QUOTE','REQUEST')),key text not null check(length(key) between 16 and 200),request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),quote_id uuid not null references public.quotes(id),reservation_id uuid references public.reservations(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(visitor_hash,operation,key)
);
select app_private.secure_table('public_booking_operations',null);
create table public.public_reservation_submissions(
 id uuid primary key default gen_random_uuid(),reservation_id uuid not null unique references public.reservations(id),customer_data jsonb not null check(jsonb_typeof(customer_data)='object'),terms_version uuid not null,terms_snapshot jsonb not null check(jsonb_typeof(terms_snapshot)='object'),accepted_at timestamptz not null default now(),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
select app_private.secure_table('public_reservation_submissions',null);
grant select on public.public_reservation_submissions to authenticated;
create policy staff_read on public.public_reservation_submissions for select to authenticated using ((select app_private.has_permission('reservations.read')) and (select app_private.has_permission('customers.read')));
create trigger immutable_submission before update or delete on public.public_reservation_submissions for each row execute function app_private.reject_mutation();

create function app_private.public_selection(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(187640,5);
 perform 1 from public.system_settings where key='public_site' for share;
 if not app_private.site_enabled() then raise exception using errcode='23514',message='Public booking disabled';end if;
 if input->>'customer_id' is not null or input->>'discount_amount' is distinct from '0.00' or coalesce(input->>'discount_reason','')<>'' then raise exception using errcode='23514',message='Public quote disallows customer or discount';end if;
 perform 1 from public.rate_plans where id=(input->>'rate_plan_id')::uuid and public_enabled;
 if not found or exists(select 1 from jsonb_array_elements(input->'additional_services') x left join public.additional_services a on a.id=(x->>'id')::uuid where a.id is null or not a.public_enabled) then raise exception using errcode='23514',message='Unpublished selection';end if;
 return app_private.pricing_context(input);
end $$;
create function public.public_pricing_context(input jsonb) returns jsonb language sql security definer set search_path='' as $$select app_private.public_selection(input)$$;
revoke all on function public.public_pricing_context(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.public_pricing_context(jsonb) to service_role;
create function public.find_public_operation(visitor_hash text,operation text,idempotency_key text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.public_booking_operations;
begin
 perform pg_advisory_xact_lock(hashtextextended(visitor_hash||operation||idempotency_key,0));
 select * into r from public.public_booking_operations o where o.visitor_hash=find_public_operation.visitor_hash and o.operation=find_public_operation.operation and o.key=idempotency_key;
 if not found then return null;end if;
 if r.request_hash<>encode(sha256(convert_to(payload::text,'UTF8')),'hex') then raise exception using errcode='23505',message='Idempotency mismatch';end if;
 return case operation when 'QUOTE' then jsonb_build_object('id',r.quote_id) else jsonb_build_object('id',r.reservation_id,'status','REQUESTED') end;
end $$;
revoke all on function public.find_public_operation(text,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.find_public_operation(text,text,text,jsonb) to service_role;
create function public.persist_public_quote(visitor_hash text,input jsonb,expected_fingerprint text,calculation jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; context jsonb; qid uuid; line jsonb;
begin
 result:=public.find_public_operation(visitor_hash,'QUOTE',idempotency_key,input);if result is not null then return result;end if;
 context:=app_private.public_selection(input);
 if context->>'fingerprint' is distinct from expected_fingerprint then raise exception using errcode='40001',message='Price changed';end if;
 if calculation->>'engine' is distinct from 'v1' or calculation->>'deposit' is distinct from context->'plan'->'policy'->>'deposit_amount' or jsonb_typeof(calculation->'lines') is distinct from 'array' or jsonb_array_length(calculation->'lines') not between 1 and 40 then raise exception using errcode='23514',message='Invalid trusted calculation';end if;
 insert into public.quotes(rate_plan_id,start_at,end_at,expires_at,total,deposit,rules_snapshot) values((input->>'rate_plan_id')::uuid,(input->>'start_at')::timestamptz,(input->>'end_at')::timestamptz,now()+make_interval(mins=>(context->'plan'->'policy'->>'quote_validity_minutes')::integer),(calculation->>'total')::numeric,(calculation->>'deposit')::numeric,jsonb_build_object('engine','v1','origin','PUBLIC','input',input,'catalog',context,'policy',context->'plan'->'policy','calculation',calculation)) returning id into qid;
 for line in select * from jsonb_array_elements(calculation->'lines') loop
 if coalesce(line->>'kind','') not in ('RENTAL','SERVICE','DELIVERY','COLLECTION') then raise exception using errcode='23514',message='Invalid public item';end if;
 insert into public.quote_items(quote_id,additional_service_id,kind,description,quantity,unit_amount,total,snapshot) values(qid,(line->>'additional_service_id')::uuid,line->>'kind',line->>'description',(line->>'quantity')::numeric,(line->>'unit_amount')::numeric,(line->>'total')::numeric,coalesce(line->'snapshot','{}'::jsonb));
 end loop;
 update public.quotes set locked_at=clock_timestamp() where id=qid;
 insert into public.public_booking_operations(visitor_hash,operation,key,request_hash,quote_id) values(visitor_hash,'QUOTE',idempotency_key,encode(sha256(convert_to(input::text,'UTF8')),'hex'),qid);
 return jsonb_build_object('id',qid);
end $$;
revoke all on function public.persist_public_quote(text,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.persist_public_quote(text,jsonb,text,jsonb,text) to service_role;
create function public.public_quote_owned(visitor_hash text,quote_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',q.id,'total',q.total::text,'deposit',q.deposit::text,'expires_at',q.expires_at,'items',(select jsonb_agg(jsonb_build_object('kind',i.kind,'description',i.description,'quantity',i.quantity::text,'total',i.total::text) order by i.created_at,i.id) from public.quote_items i where i.quote_id=q.id)) from public.quotes q where q.id=quote_id and exists(select 1 from public.public_booking_operations o where o.visitor_hash=public_quote_owned.visitor_hash and o.quote_id=q.id and o.operation='QUOTE')
$$;
revoke all on function public.public_quote_owned(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.public_quote_owned(text,uuid) to service_role;

create function app_private.create_reservation_from_quote(qid uuid,cid uuid,token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare q public.quotes;linked uuid;rid uuid;input jsonb;policy jsonb;loc record;address jsonb;mode text;
begin
 select * into strict q from public.quotes where id=qid for update;
 if q.locked_at is null or q.expires_at<=now() or q.start_at<=now() or q.rules_snapshot->>'engine' is distinct from 'v1' or (q.customer_id is not null and q.customer_id<>cid) then raise exception using errcode='23514',message='Invalid quote';end if;
 perform 1 from public.customers where id=cid and archived_at is null for share;if not found then raise exception using errcode='23514',message='Customer unavailable';end if;
 input:=q.rules_snapshot->'input';policy:=q.rules_snapshot->'policy';
 perform 1 from public.branches where id=(input->>'branch_id')::uuid and active and archived_at is null for share;if not found then raise exception using errcode='23514',message='Branch unavailable';end if;
 linked:=q.id;
 if q.customer_id is null then
 insert into public.quotes(customer_id,rate_plan_id,start_at,end_at,expires_at,total,deposit,currency,rules_snapshot) values(cid,q.rate_plan_id,q.start_at,q.end_at,q.expires_at,q.total,q.deposit,q.currency,q.rules_snapshot) returning id into linked;
 insert into public.quote_items(quote_id,additional_service_id,kind,description,quantity,unit_amount,total,snapshot) select linked,i.additional_service_id,i.kind,i.description,i.quantity,i.unit_amount,i.total,i.snapshot from public.quote_items i where i.quote_id=q.id;
 update public.quotes set locked_at=clock_timestamp() where id=linked;
 end if;
 insert into public.reservations(customer_id,branch_id,quote_id,source_quote_id,start_at,end_at,expires_at,lookup_token_hash,lookup_expires_at) values(cid,(input->>'branch_id')::uuid,linked,q.id,q.start_at,q.end_at,least(q.start_at,now()+make_interval(mins=>(policy->>'request_validity_minutes')::integer)),token_hash,now()+make_interval(days=>(policy->>'lookup_validity_days')::integer)) returning id into rid;
 insert into public.reservation_items(reservation_id,category_id,vehicle_id) values(rid,(input->>'category_id')::uuid,(input->>'vehicle_id')::uuid);
 for loc in select * from (values('PICKUP','pickup_mode','pickup_address','DELIVERY',q.start_at),('RETURN','return_mode','return_address','COLLECTION',q.end_at)) t(direction,mode_key,address_key,fee_kind,scheduled_at) loop
 mode:=input->>loc.mode_key;
 if mode='BRANCH' then select b.address into address from public.branches b where b.id=(input->>'branch_id')::uuid;else address:=input->loc.address_key;end if;
 insert into public.reservation_locations(reservation_id,branch_id,direction,mode,address_snapshot,fee,scheduled_at,instructions) values(rid,case when mode='BRANCH' then (input->>'branch_id')::uuid end,loc.direction,mode,address,coalesce((select sum(i.total) from public.quote_items i where i.quote_id=q.id and i.kind=loc.fee_kind),0),loc.scheduled_at,input->>'instructions');
 end loop;
 insert into public.outbox_events(event_type,payload,deduplication_key) values('reservation.requested',jsonb_build_object('reservation_id',rid),'reservation:'||rid||':requested');
 return jsonb_build_object('id',rid,'status','REQUESTED');
end $$;
create or replace function public.request_staff_reservation(quote_id uuid,customer_id uuid,token_hash text,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform app_private.require_permission('reservations.request');perform app_private.require_permission('pricing.read');
 if coalesce(token_hash,'') !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='Invalid hash';end if;
 result:=app_private.begin_operation('staff_reservation',idempotency_key,jsonb_build_object('quote_id',quote_id,'customer_id',customer_id,'token_hash',token_hash));if result is not null then return result;end if;
 perform set_config('app.reservation_reason','Solicitação registrada pelo atendimento',true);
 result:=app_private.create_reservation_from_quote(quote_id,customer_id,token_hash);
 return app_private.finish_operation('staff_reservation',idempotency_key,result);
end $$;
create function public.request_public_reservation(visitor_hash text,quote_id uuid,customer_data jsonb,terms_version uuid,token_hash text,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb;result jsonb;cid uuid;site jsonb;
begin
 payload:=jsonb_build_object('quote_id',quote_id,'customer',customer_data,'terms_version',terms_version);
 result:=public.find_public_operation(visitor_hash,'REQUEST',idempotency_key,payload);if result is not null then return result;end if;
 perform 1 from public.system_settings where key='public_site' for share;
 site:=public.public_site();
 if site is null or site->>'terms_version' is distinct from terms_version::text or coalesce(token_hash,'') !~ '^[a-f0-9]{64}$' then raise exception using errcode='23514',message='Site or terms changed';end if;
 if public.public_quote_owned(visitor_hash,quote_id) is null then raise exception using errcode='23514',message='Quote not owned';end if;
 perform pg_advisory_xact_lock(hashtextextended(customer_data->>'tax_document',15));
 select c.id into cid from public.customers c where c.tax_document=customer_data->>'tax_document';
 if cid is null then
 insert into public.customers(person_type,name,tax_document,email,phone,address,birth_date) values(customer_data->>'person_type',customer_data->>'name',customer_data->>'tax_document',customer_data->>'email',customer_data->>'phone',customer_data->'address',(customer_data->>'birth_date')::date) returning id into cid;
 end if;
 perform set_config('app.reservation_reason','Solicitação pública; dados declarados pendentes de conferência',true);
 result:=app_private.create_reservation_from_quote(quote_id,cid,token_hash);
 insert into public.public_reservation_submissions(reservation_id,customer_data,terms_version,terms_snapshot) values((result->>'id')::uuid,customer_data,terms_version,jsonb_build_object('name',site->>'name','terms',site->>'terms','privacy',site->>'privacy'));
 insert into public.public_booking_operations(visitor_hash,operation,key,request_hash,quote_id,reservation_id) values(visitor_hash,'REQUEST',idempotency_key,encode(sha256(convert_to(payload::text,'UTF8')),'hex'),quote_id,(result->>'id')::uuid);
 return result;
end $$;
revoke all on function public.request_public_reservation(text,uuid,jsonb,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.request_public_reservation(text,uuid,jsonb,uuid,text,text) to service_role;
revoke all on function app_private.public_selection(jsonb),app_private.create_reservation_from_quote(uuid,uuid,text) from public,anon,authenticated,service_role;
create trigger record_audit after insert on public.public_reservation_submissions for each row execute function app_private.record_audit('OPERATIONS');
create function public.public_quote_stock(visitor_hash text,quote_id uuid) returns integer language plpgsql stable security definer set search_path='' as $$
declare q public.quotes;i jsonb;p tstzrange;n integer;
begin
 if public.public_quote_owned(visitor_hash,quote_id) is null then raise exception using errcode='23514',message='Quote not owned';end if;
 select * into strict q from public.quotes where id=quote_id;i:=q.rules_snapshot->'input';p:=app_private.occupancy_period(q.start_at,q.end_at,q.id);
 select count(*)::integer into n from public.vehicles v join public.vehicle_categories c on c.id=v.category_id join public.branches b on b.id=v.branch_id
 where v.branch_id=(i->>'branch_id')::uuid and v.operational_status='ACTIVE' and v.archived_at is null and c.active and c.archived_at is null and b.active and b.archived_at is null
 and (case when i->>'vehicle_id' is null then v.category_id=(i->>'category_id')::uuid else v.id=(i->>'vehicle_id')::uuid end)
 and not exists(select 1 from public.vehicle_allocations a where a.vehicle_id=v.id and a.released_at is null and a.period&&p)
 and not exists(select 1 from public.rentals r where r.vehicle_id=v.id and r.status in ('ACTIVE','OVERDUE') and r.end_at<now());
 return n;
end $$;
revoke all on function public.public_quote_stock(text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.public_quote_stock(text,uuid) to service_role;
