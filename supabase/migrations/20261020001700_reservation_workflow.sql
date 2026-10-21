alter table public.reservations add column source_quote_id uuid unique references public.quotes(id);
update public.reservations set source_quote_id=quote_id;
alter table public.reservations alter column source_quote_id set not null;
create function app_private.reservation_origin() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='INSERT' then new.source_quote_id:=coalesce(new.source_quote_id,new.quote_id);
  elsif row(new.source_quote_id,new.branch_id,new.lookup_token_hash,new.lookup_expires_at,new.expires_at) is distinct from row(old.source_quote_id,old.branch_id,old.lookup_token_hash,old.lookup_expires_at,old.expires_at) then
    raise exception using errcode='23514',message='Reservation origin and validity are immutable';
  end if;
  if tg_op='UPDATE' and old.status in ('REQUESTED','UNDER_REVIEW') and old.expires_at<=now() and new.status<>'EXPIRED' then
    raise exception using errcode='23514',message='Request expired'; end if;
  return new;
end $$;
create trigger reservation_origin before insert or update on public.reservations for each row execute function app_private.reservation_origin();

create function public.find_staff_quote_operation(input jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.idempotency_keys;
begin
  perform app_private.require_permission('pricing.read'); perform app_private.require_permission('reservations.request');
  if length(idempotency_key) not between 16 and 200 then raise exception using errcode='22023',message='Invalid key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'staff_quote'||idempotency_key,0));
  select * into existing from public.idempotency_keys k where k.actor_id=auth.uid() and k.operation='staff_quote' and k.key=idempotency_key;
  if found and existing.request_hash<>encode(sha256(convert_to(input::text,'UTF8')),'hex') then raise exception using errcode='23505',message='Idempotency payload mismatch'; end if;
  return existing.safe_response;
end $$;
revoke all on function public.find_staff_quote_operation(jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.find_staff_quote_operation(jsonb,text) to authenticated;

create function public.request_staff_reservation(quote_id uuid, customer_id uuid, token_hash text, idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare q public.quotes; linked uuid; result jsonb; rid uuid; input jsonb; policy jsonb; loc record; address jsonb; mode text;
begin
  perform app_private.require_permission('reservations.request'); perform app_private.require_permission('pricing.read');
  if coalesce(token_hash,'') !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='Invalid token hash'; end if;
  result:=app_private.begin_operation('staff_reservation',idempotency_key,jsonb_build_object('quote_id',quote_id,'customer_id',customer_id,'token_hash',token_hash));
  if result is not null then return result; end if;
  select * into strict q from public.quotes where id=quote_id for update;
  if q.locked_at is null or q.expires_at<=now() or q.start_at<=now() or q.rules_snapshot->>'engine' is distinct from 'v1'
    or (q.customer_id is not null and q.customer_id<>customer_id) then raise exception using errcode='23514',message='Invalid quote for request'; end if;
  perform 1 from public.customers c where c.id=customer_id and c.archived_at is null for share;
  if not found then raise exception using errcode='23514',message='Inactive customer'; end if;
  input:=q.rules_snapshot->'input'; policy:=q.rules_snapshot->'policy';
  perform 1 from public.branches where id=(input->>'branch_id')::uuid and active and archived_at is null for share;
  if not found then raise exception using errcode='23514',message='Inactive branch'; end if;
  linked:=q.id;
  -- Cotação pública sem cliente permanece imutável. O vínculo recebe uma cópia congelada.
  if q.customer_id is null then
    insert into public.quotes(customer_id,rate_plan_id,start_at,end_at,expires_at,total,deposit,currency,rules_snapshot)
      values(customer_id,q.rate_plan_id,q.start_at,q.end_at,q.expires_at,q.total,q.deposit,q.currency,q.rules_snapshot) returning id into linked;
    insert into public.quote_items(quote_id,additional_service_id,kind,description,quantity,unit_amount,total,snapshot)
      select linked,i.additional_service_id,i.kind,i.description,i.quantity,i.unit_amount,i.total,i.snapshot from public.quote_items i where i.quote_id=q.id;
    update public.quotes set locked_at=clock_timestamp() where id=linked;
  end if;
  perform set_config('app.reservation_reason','Solicitação registrada pelo atendimento',true);
  insert into public.reservations(customer_id,branch_id,quote_id,source_quote_id,start_at,end_at,expires_at,lookup_token_hash,lookup_expires_at)
    values(customer_id,(input->>'branch_id')::uuid,linked,q.id,q.start_at,q.end_at,
      least(q.start_at,now()+make_interval(mins=>(policy->>'request_validity_minutes')::integer)),token_hash,
      now()+make_interval(days=>(policy->>'lookup_validity_days')::integer)) returning id into rid;
  insert into public.reservation_items(reservation_id,category_id,vehicle_id)
    values(rid,(input->>'category_id')::uuid,(input->>'vehicle_id')::uuid);
  for loc in select * from (values ('PICKUP','pickup_mode','pickup_address','DELIVERY',q.start_at),('RETURN','return_mode','return_address','COLLECTION',q.end_at)) t(direction,mode_key,address_key,fee_kind,scheduled_at) loop
    mode:=input->>loc.mode_key;
    if mode='BRANCH' then select b.address into address from public.branches b where b.id=(input->>'branch_id')::uuid;
    else address:=input->loc.address_key; end if;
    insert into public.reservation_locations(reservation_id,branch_id,direction,mode,address_snapshot,fee,scheduled_at,instructions)
      values(rid,case when mode='BRANCH' then (input->>'branch_id')::uuid end,loc.direction,mode,address,
        coalesce((select sum(i.total) from public.quote_items i where i.quote_id=q.id and i.kind=loc.fee_kind),0),loc.scheduled_at,input->>'instructions');
  end loop;
  insert into public.outbox_events(event_type,payload,deduplication_key) values('reservation.requested',jsonb_build_object('reservation_id',rid),'reservation:'||rid||':requested');
  -- Resposta persistida não contém o token de consulta.
  return app_private.finish_operation('staff_reservation',idempotency_key,jsonb_build_object('id',rid,'status','REQUESTED'));
end $$;
revoke all on function public.request_staff_reservation(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.request_staff_reservation(uuid,uuid,text,text) to authenticated;

create function app_private.occupancy_period(s timestamptz,e timestamptz,quote_id uuid) returns tstzrange
language sql stable security definer set search_path='' as $$
  select tstzrange(s,e+make_interval(mins=>case when q.rules_snapshot->>'engine'='v1' then (q.rules_snapshot->'policy'->>'turnaround_minutes')::integer else 0 end),'[)') from public.quotes q where q.id=quote_id
$$;

create function public.staff_availability(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare context jsonb; requested_period tstzrange; available integer;
begin
  perform app_private.require_permission('reservations.read'); perform app_private.require_permission('vehicles.read'); perform app_private.require_permission('pricing.read');
  context:=app_private.pricing_context(input);
  requested_period:=tstzrange((input->>'start_at')::timestamptz,(input->>'end_at')::timestamptz+make_interval(mins=>(context->'plan'->'policy'->>'turnaround_minutes')::integer),'[)');
  select count(*)::integer into available from public.vehicles v
    where v.branch_id=(input->>'branch_id')::uuid and v.archived_at is null and v.operational_status='ACTIVE'
      and (case when input->>'vehicle_id' is not null then v.id=(input->>'vehicle_id')::uuid else v.category_id=(input->>'category_id')::uuid end)
      and not exists(select 1 from public.vehicle_allocations a where a.vehicle_id=v.id and a.released_at is null and a.period && requested_period)
      and not exists(select 1 from public.rentals x where x.vehicle_id=v.id and x.status in ('ACTIVE','OVERDUE') and x.end_at<now());
  return jsonb_build_object('available',available,'indicative',true,'occupied_until',upper(requested_period));
end $$;
revoke all on function public.staff_availability(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.staff_availability(jsonb) to authenticated;

create function public.decide_staff_reservation(reservation_id uuid,expected_version integer,target_status text,reason text,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.reservations; result jsonb;
begin
  perform app_private.require_permission('reservations.read');
  if expected_version is null or expected_version<1 or target_status not in ('CONFIRMED','UNDER_REVIEW','REJECTED','CANCELLED') or coalesce(length(btrim(reason)),0) not between 5 and 500 then raise exception using errcode='22023',message='Invalid decision'; end if;
  result:=app_private.begin_operation('staff_decision',idempotency_key,jsonb_build_object('id',reservation_id,'version',expected_version,'target',target_status,'reason',reason));
  if result is not null then return result; end if;
  select * into strict r from public.reservations where id=reservation_id for update;
  if r.version<>expected_version then raise exception using errcode='40001',message='Reservation changed'; end if;
  perform set_config('app.reservation_reason',reason,true);
  if target_status='CONFIRMED' then result:=public.approve_reservation(reservation_id,idempotency_key);
  else result:=public.transition_reservation(reservation_id,target_status,reason,idempotency_key); end if;
  return app_private.finish_operation('staff_decision',idempotency_key,result);
end $$;
revoke all on function public.decide_staff_reservation(uuid,integer,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.decide_staff_reservation(uuid,integer,text,text,text) to authenticated;

create function public.expire_pending_reservations(batch_size integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare r record; n integer:=0;
begin
  if batch_size is null or batch_size not between 1 and 1000 then raise exception using errcode='22023',message='Invalid batch'; end if;
  perform set_config('app.reservation_reason','Prazo de análise expirado',true);
  for r in select id from public.reservations where status in ('REQUESTED','UNDER_REVIEW') and expires_at<=now() order by expires_at,id for update skip locked limit batch_size loop
    update public.reservations set status='EXPIRED' where id=r.id;
    insert into public.outbox_events(event_type,payload,deduplication_key) values('reservation.expired',jsonb_build_object('reservation_id',r.id),'reservation:'||r.id||':expired');
    n:=n+1;
  end loop;
  return n;
end $$;
revoke all on function public.expire_pending_reservations(integer) from public,anon,authenticated,service_role;
grant execute on function public.expire_pending_reservations(integer) to service_role;
create function public.reservation_status_by_token(reservation_id uuid,token_hash text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',r.id,'status',r.status,'updated_at',r.updated_at) from public.reservations r
    where r.id=reservation_id and r.lookup_token_hash=token_hash and r.lookup_expires_at>now()
$$;
revoke all on function public.reservation_status_by_token(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.reservation_status_by_token(uuid,text) to service_role;
revoke all on function app_private.reservation_origin(),app_private.occupancy_period(timestamptz,timestamptz,uuid) from public,anon,authenticated,service_role;
