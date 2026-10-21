-- Ocupação usa o intervalo congelado no orçamento, inclusive na prorrogação.
create or replace function app_private.check_occupancy() returns trigger
language plpgsql security definer set search_path = '' as $$
declare old_data jsonb; new_data jsonb; ids uuid[]; source_name text; entity_id uuid;
  source_table text; source_period tstzrange; source_vehicle uuid; needs_allocation boolean;
  count_alloc integer; r record; item record;
begin
  old_data := case when tg_op <> 'INSERT' then to_jsonb(old) else '{}'::jsonb end;
  new_data := case when tg_op <> 'DELETE' then to_jsonb(new) else '{}'::jsonb end;
  foreach source_name in array array['reservation','rental','vehicle_block','maintenance_record'] loop
    source_table := case source_name when 'reservation' then 'reservations' when 'rental' then 'rentals' when 'vehicle_block' then 'vehicle_blocks' else 'maintenance_records' end;
    if tg_table_name='vehicle_allocations' then
      ids := array[(old_data->>(source_name||'_id'))::uuid,(new_data->>(source_name||'_id'))::uuid];
    elsif tg_table_name='reservation_items' and source_name='reservation' then
      ids := array[(old_data->>'reservation_id')::uuid,(new_data->>'reservation_id')::uuid];
    elsif tg_table_name=source_table then
      ids := array[(old_data->>'id')::uuid,(new_data->>'id')::uuid];
    else continue; end if;
    for entity_id in select distinct id from unnest(ids) id where id is not null loop
      execute format('select * from public.%I where id=$1',source_table) into r using entity_id;
      if r.id is null then continue; end if;
      source_period := tstzrange(r.start_at,r.end_at,'[)'); source_vehicle := null; if source_name in ('reservation','rental') then source_period:=app_private.occupancy_period(r.start_at,r.end_at,r.quote_id); end if;
      if source_name='reservation' then
        needs_allocation := r.status='CONFIRMED';
        if r.status='CONVERTED' and not exists(select 1 from public.rentals x where x.reservation_id=r.id and x.customer_id=r.customer_id and x.branch_id=r.branch_id and x.quote_id=r.quote_id) then
          raise exception using errcode='23514',message='Converted reservation requires matching rental';
        end if;
        select * into item from public.reservation_items where reservation_id=entity_id;
        if item.id is null then raise exception using errcode='23514',message='Reservation requires one item'; end if;
      elsif source_name='rental' then
        needs_allocation := r.status in ('PREPARING','ACTIVE','OVERDUE'); source_vehicle:=r.vehicle_id;
        if not exists(select 1 from public.quotes q where q.id=r.quote_id and q.customer_id=r.customer_id and q.locked_at is not null and q.start_at=r.start_at and q.end_at<=r.end_at) then
          raise exception using errcode='23514',message='Rental requires matching locked quote';
        end if;
        if r.reservation_id is not null and not exists(select 1 from public.reservations x where x.id=r.reservation_id and x.status='CONVERTED' and x.customer_id=r.customer_id and x.branch_id=r.branch_id and x.quote_id=r.quote_id) then
          raise exception using errcode='23514',message='Rental origin mismatch';
        end if;
      elsif source_name='vehicle_block' then needs_allocation:=r.active; source_vehicle:=r.vehicle_id;
      else needs_allocation:=r.blocks_availability and r.status in ('SCHEDULED','IN_PROGRESS'); source_vehicle:=r.vehicle_id;
      end if;
      execute format('select count(*) from public.vehicle_allocations where %I=$1 and released_at is null',source_name||'_id') into count_alloc using entity_id;
      if count_alloc <> (case when needs_allocation then 1 else 0 end) then
        raise exception using errcode='23514',message='Allocation does not match source state';
      end if;
      if needs_allocation then
        if exists(select 1 from public.vehicle_allocations a where (to_jsonb(a)->>(source_name||'_id'))::uuid=entity_id and a.released_at is null
          and (a.period <> source_period or (source_vehicle is not null and a.vehicle_id <> source_vehicle))) then
          raise exception using errcode='23514',message='Allocation vehicle or period mismatch';
        end if;
        if source_name='reservation' then
        if exists(
          select 1 from public.vehicle_allocations a join public.vehicles v on v.id=a.vehicle_id
          where a.reservation_id=entity_id and a.released_at is null
            and ((item.vehicle_id is not null and a.vehicle_id<>item.vehicle_id) or (item.category_id is not null and v.category_id<>item.category_id))
        ) then raise exception using errcode='23514',message='Assigned vehicle does not match requested target'; end if;
        end if;
      end if;
    end loop;
  end loop;
  return null;
end;
$$;
create or replace function public.approve_reservation(reservation_id uuid, idempotency_key text) returns jsonb
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
  if (q.rules_snapshot->>'engine' is distinct from 'v1' and q.expires_at <= now()) or q.locked_at is null then raise exception using errcode='23514',message='Quote expired or unlocked'; end if;
  allocation_period:=app_private.occupancy_period(r.start_at,r.end_at,r.quote_id);
  if item.category_id is not null then
    cat:=item.category_id;
    perform 1 from public.vehicle_categories where id=cat and active and archived_at is null for update;
    if not found then raise exception using errcode='23514',message='Category unavailable'; end if;
    select v.id into assigned from public.vehicles v join public.branches b on b.id=v.branch_id
      where v.category_id=cat and v.operational_status='ACTIVE' and v.archived_at is null and b.active and b.archived_at is null and v.branch_id=r.branch_id
      and not exists(select 1 from public.vehicle_allocations a where a.vehicle_id=v.id and a.released_at is null and a.period && allocation_period)
      and not exists(select 1 from public.rentals x where x.vehicle_id=v.id and x.status in ('ACTIVE','OVERDUE') and x.end_at < now())
      order by v.id for update of v skip locked limit 1;
  else
    select v.id into assigned from public.vehicles v join public.vehicle_categories c on c.id=v.category_id join public.branches b on b.id=v.branch_id
      where v.id=item.vehicle_id and v.operational_status='ACTIVE' and v.archived_at is null and c.active and c.archived_at is null and b.active and b.archived_at is null and v.branch_id=r.branch_id
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

create or replace function public.extend_rental(rental_id uuid, quote_id uuid, idempotency_key text) returns jsonb
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
  update public.vehicle_allocations set period=app_private.occupancy_period(r.start_at,q.end_at,r.quote_id) where vehicle_allocations.rental_id=r.id and released_at is null;
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


revoke all on function app_private.check_occupancy() from public,anon,authenticated,service_role;
