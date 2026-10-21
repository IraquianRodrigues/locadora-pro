create function app_private.require_permission(code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.has_permission(code) then raise exception using errcode='42501',message='Forbidden'; end if;
end;
$$;
create function app_private.begin_operation(operation_name text, operation_key text, payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare existing public.idempotency_keys; payload_hash text;
begin
  if operation_key is null or length(operation_key) not between 16 and 200 then raise exception using errcode='22023',message='Invalid idempotency key'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||operation_name||operation_key,0));
  payload_hash:=encode(sha256(convert_to(payload::text,'UTF8')),'hex');
  select * into existing from public.idempotency_keys where actor_id=auth.uid() and operation=operation_name and key=operation_key;
  if found then
    if existing.request_hash <> payload_hash then raise exception using errcode='23505',message='Idempotency payload mismatch'; end if;
    return existing.safe_response;
  end if;
  insert into public.idempotency_keys(actor_id,operation,key,request_hash,expires_at)
  values(auth.uid(),operation_name,operation_key,payload_hash,now()+interval '7 days');
  return null;
end;
$$;
create function app_private.finish_operation(operation_name text, operation_key text, result jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  update public.idempotency_keys set safe_response=result where actor_id=auth.uid() and operation=operation_name and key=operation_key;
  return result;
end;
$$;
create function public.approve_reservation(reservation_id uuid, idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb; r public.reservations; item public.reservation_items; q public.quotes; assigned uuid; cat uuid; allocation_period tstzrange;
begin
  perform app_private.require_permission('reservations.approve');
  result:=app_private.begin_operation('approve_reservation',idempotency_key,jsonb_build_object('reservation_id',reservation_id));
  if result is not null then return result; end if;
  select * into strict r from public.reservations where id=reservation_id for update;
  if r.status not in ('REQUESTED','UNDER_REVIEW') or (r.expires_at is not null and r.expires_at <= now()) then
    raise exception using errcode='23514',message='Reservation cannot be approved';
  end if;
  select * into strict item from public.reservation_items where reservation_items.reservation_id=r.id;
  select * into strict q from public.quotes where id=r.quote_id;
  if q.expires_at <= now() or q.locked_at is null then raise exception using errcode='23514',message='Quote expired or unlocked'; end if;
  allocation_period:=tstzrange(r.start_at,r.end_at,'[)');
  if item.category_id is not null then
    cat:=item.category_id;
    perform 1 from public.vehicle_categories where id=cat and active and archived_at is null for update;
    if not found then raise exception using errcode='23514',message='Category unavailable'; end if;
    select v.id into assigned from public.vehicles v join public.branches b on b.id=v.branch_id
      where v.category_id=cat and v.operational_status='ACTIVE' and v.archived_at is null and b.active and v.branch_id=r.branch_id
      and not exists(select 1 from public.vehicle_allocations a where a.vehicle_id=v.id and a.released_at is null and a.period && allocation_period)
      and not exists(select 1 from public.rentals x where x.vehicle_id=v.id and x.status in ('ACTIVE','OVERDUE') and x.end_at < now())
      order by v.id for update of v skip locked limit 1;
  else
    select v.id into assigned from public.vehicles v join public.vehicle_categories c on c.id=v.category_id join public.branches b on b.id=v.branch_id
      where v.id=item.vehicle_id and v.operational_status='ACTIVE' and v.archived_at is null and c.active and c.archived_at is null and b.active and v.branch_id=r.branch_id
      and not exists(select 1 from public.rentals x where x.vehicle_id=v.id and x.status in ('ACTIVE','OVERDUE') and x.end_at < now())
      for update of v;
  end if;
  if assigned is null then raise exception using errcode='23P01',message='No available vehicle'; end if;
  insert into public.vehicle_allocations(vehicle_id,period,kind,reservation_id,created_by)
  values(assigned,allocation_period,'RESERVATION',r.id,auth.uid());
  update public.reservations set status='CONFIRMED',approved_by=auth.uid() where id=r.id returning * into r;
  insert into public.outbox_events(event_type,payload,deduplication_key)
  values('reservation.confirmed',jsonb_build_object('reservation_id',r.id),'reservation:'||r.id||':confirmed:'||r.version);
  return app_private.finish_operation('approve_reservation',idempotency_key,jsonb_build_object('id',r.id,'vehicle_id',assigned,'status',r.status));
end;
$$;
revoke all on function public.approve_reservation(uuid,text) from public,anon,service_role; grant execute on function public.approve_reservation(uuid,text) to authenticated;

create function public.transition_reservation(reservation_id uuid, target_status text, reason text, idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.reservations; result jsonb;
begin
  if target_status is null or target_status not in ('UNDER_REVIEW','REJECTED','CANCELLED') or reason is null or length(btrim(reason))=0 then
    raise exception using errcode='22023',message='Invalid transition request';
  end if;
  -- Valida antes de acessar o registro, evitando enumeração por perfil sem acesso.
  perform app_private.require_permission('reservations.read');
  result:=app_private.begin_operation('transition_reservation',idempotency_key,jsonb_build_object('id',reservation_id,'status',target_status,'reason',reason));
  if result is not null then return result; end if;
  select * into strict r from public.reservations where id=reservation_id for update;
  if not ((target_status='UNDER_REVIEW' and r.status='REQUESTED')
    or (target_status='REJECTED' and r.status in ('REQUESTED','UNDER_REVIEW'))
    or (target_status='CANCELLED' and r.status in ('REQUESTED','UNDER_REVIEW','CONFIRMED'))) then
    raise exception using errcode='23514',message='Transition not allowed from current state';
  end if;
  perform app_private.require_permission(case when target_status='UNDER_REVIEW' then 'reservations.review'
    when target_status='REJECTED' then 'reservations.approve'
    when r.status='CONFIRMED' then 'reservations.cancel_confirmed' else 'reservations.cancel_pending' end);
  perform set_config('app.reservation_reason',reason,true);
  update public.reservations set status=target_status where id=r.id returning * into r;
  if target_status='CANCELLED' then
    update public.vehicle_allocations set released_at=clock_timestamp() where vehicle_allocations.reservation_id=r.id and released_at is null;
  end if;
  insert into public.outbox_events(event_type,payload,deduplication_key)
  values('reservation.'||lower(target_status),jsonb_build_object('reservation_id',r.id),'reservation:'||r.id||':'||r.version);
  return app_private.finish_operation('transition_reservation',idempotency_key,jsonb_build_object('id',r.id,'status',r.status));
end;
$$;
revoke all on function public.transition_reservation(uuid,text,text,text) from public,anon,service_role; grant execute on function public.transition_reservation(uuid,text,text,text) to authenticated;

create function public.create_vehicle_block(vehicle_id uuid, start_at timestamptz, end_at timestamptz, reason text, idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare block_id uuid; result jsonb;
begin
  perform app_private.require_permission('blocks.write');
  result:=app_private.begin_operation('create_vehicle_block',idempotency_key,jsonb_build_object('vehicle',vehicle_id,'start',start_at,'end',end_at,'reason',reason));
  if result is not null then return result; end if;
  perform 1 from public.vehicles where id=vehicle_id for update;
  insert into public.vehicle_blocks(vehicle_id,start_at,end_at,reason,created_by)
  values(vehicle_id,start_at,end_at,reason,auth.uid()) returning id into block_id;
  insert into public.vehicle_allocations(vehicle_id,period,kind,vehicle_block_id,created_by)
  values(vehicle_id,tstzrange(start_at,end_at,'[)'),'BLOCK',block_id,auth.uid());
  return app_private.finish_operation('create_vehicle_block',idempotency_key,jsonb_build_object('id',block_id));
end;
$$;
revoke all on function public.create_vehicle_block(uuid,timestamptz,timestamptz,text,text) from public,anon,service_role; grant execute on function public.create_vehicle_block(uuid,timestamptz,timestamptz,text,text) to authenticated;

create function public.extend_rental(rental_id uuid, quote_id uuid, idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r public.rentals; q public.quotes; result jsonb;
begin
  perform app_private.require_permission('rentals.extend');
  result:=app_private.begin_operation('extend_rental',idempotency_key,jsonb_build_object('rental',rental_id,'quote',quote_id));
  if result is not null then return result; end if;
  select * into strict r from public.rentals where id=rental_id for update;
  select * into strict q from public.quotes where id=quote_id;
  if r.status not in ('PREPARING','ACTIVE','OVERDUE') or q.locked_at is null or q.expires_at<=now()
    or q.customer_id is distinct from r.customer_id or q.start_at<>r.end_at or q.end_at<=r.end_at then
    raise exception using errcode='23514',message='Invalid extension quote or rental';
  end if;
  perform 1 from public.vehicles where id=r.vehicle_id for update;
  update public.vehicle_allocations set period=tstzrange(r.start_at,q.end_at,'[)') where vehicle_allocations.rental_id=r.id and released_at is null;
  if not found then raise exception using errcode='23514',message='Rental allocation missing'; end if;
  insert into public.rental_extensions(rental_id,quote_id,previous_end_at,new_end_at,approved_by) values(r.id,q.id,r.end_at,q.end_at,auth.uid());
  update public.rentals set end_at=q.end_at,
    commercial_snapshot=jsonb_set(commercial_snapshot,'{extensions}',coalesce(commercial_snapshot->'extensions','[]'::jsonb)||jsonb_build_array(jsonb_build_object('quote_id',q.id,'total',q.total)))
    where id=r.id;
  insert into public.outbox_events(event_type,payload,deduplication_key)
  values('rental.extended',jsonb_build_object('rental_id',r.id),'rental:'||r.id||':quote:'||q.id);
  return app_private.finish_operation('extend_rental',idempotency_key,jsonb_build_object('id',r.id,'end_at',q.end_at));
end;
$$;
revoke all on function public.extend_rental(uuid,uuid,text) from public,anon,service_role; grant execute on function public.extend_rental(uuid,uuid,text) to authenticated;

create function public.confirm_charge_payment(charge_id uuid, payment_method_id uuid, amount numeric, received boolean, idempotency_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.charges; result jsonb; payment_id uuid;
begin
  perform app_private.require_permission('payments.confirm');
  if received is distinct from true or amount is null or not(amount>0 and amount<'Infinity'::numeric) or amount<>round(amount,2) then
    raise exception using errcode='22023',message='Explicit receipt and valid amount required';
  end if;
  result:=app_private.begin_operation('confirm_charge_payment',idempotency_key,jsonb_build_object('charge',charge_id,'method',payment_method_id,'amount',amount,'received',received));
  if result is not null then return result; end if;
  perform pg_advisory_xact_lock(187640,2);
  select * into strict c from public.charges where id=charge_id for update;
  perform 1 from public.payment_methods where id=payment_method_id and active;
  if not found then raise exception using errcode='23514',message='Payment method unavailable'; end if;
  insert into public.payments(customer_id,payment_method_id,amount,status,confirmed_by,confirmed_at,idempotency_key)
  values(c.customer_id,payment_method_id,amount,'CONFIRMED',auth.uid(),clock_timestamp(),encode(sha256(convert_to(auth.uid()::text||idempotency_key,'UTF8')),'hex')) returning id into payment_id;
  insert into public.payment_allocations(payment_id,charge_id,customer_id,amount) values(payment_id,c.id,c.customer_id,amount);
  insert into public.outbox_events(event_type,payload,deduplication_key) values('payment.confirmed',jsonb_build_object('payment_id',payment_id),'payment:'||payment_id);
  return app_private.finish_operation('confirm_charge_payment',idempotency_key,jsonb_build_object('id',payment_id,'status','CONFIRMED'));
end;
$$;
revoke all on function public.confirm_charge_payment(uuid,uuid,numeric,boolean,text) from public,anon,service_role; grant execute on function public.confirm_charge_payment(uuid,uuid,numeric,boolean,text) to authenticated;

create function public.set_staff_access(user_id uuid, active boolean, role_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare assigned_role uuid;
begin
  perform pg_advisory_xact_lock(187640,1);
  perform app_private.require_permission('users.manage');
  select id into strict assigned_role from public.roles where code=role_code;
  update public.profiles set active=set_staff_access.active where id=user_id;
  if not found then raise exception using errcode='P0002',message='Profile not found'; end if;
  delete from public.user_roles where user_roles.user_id=set_staff_access.user_id;
  insert into public.user_roles(user_id,role_id) values(user_id,assigned_role);
  if not exists(select 1 from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.roles r on r.id=ur.role_id where p.active and r.code='ADMIN') then
    raise exception using errcode='23514',message='Cannot revoke last active administrator';
  end if;
end;
$$;
revoke all on function public.set_staff_access(uuid,boolean,text) from public,anon,service_role; grant execute on function public.set_staff_access(uuid,boolean,text) to authenticated;
revoke execute on all functions in schema app_private from public;

