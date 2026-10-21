-- Histórico operacional e ocupação: não inventar disponibilidade anterior à implantação.
alter table public.maintenance_records add column version integer not null default 1 check(version>0);
alter table public.maintenance_records add column actual_start_at timestamptz;
alter table public.maintenance_records add column actual_end_at timestamptz;
create table public.maintenance_events (
 id uuid primary key default gen_random_uuid(),maintenance_id uuid not null references public.maintenance_records(id),
 actor_id uuid references public.profiles(id),event_type text not null,detail jsonb not null default '{}',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
select app_private.secure_table('maintenance_events','maintenance.read');
create index on public.maintenance_events(maintenance_id,created_at);
create index on public.maintenance_events(actor_id);
create trigger immutable_event before update or delete on public.maintenance_events for each row execute function app_private.reject_mutation();
create trigger audit_change after insert on public.maintenance_events for each row execute function app_private.record_audit('OPERATIONS');
create table public.vehicle_status_events (
 id uuid primary key default gen_random_uuid(),vehicle_id uuid not null references public.vehicles(id),operational_status text not null,
 archived boolean not null,recorded_at timestamptz not null default clock_timestamp(),baseline boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
select app_private.secure_table('vehicle_status_events','vehicles.read');
create index on public.vehicle_status_events(vehicle_id,recorded_at,id);
create trigger immutable_state before update or delete on public.vehicle_status_events for each row execute function app_private.reject_mutation();
insert into public.vehicle_status_events(vehicle_id,operational_status,archived,baseline)
 select id,operational_status,archived_at is not null,true from public.vehicles;
create function app_private.capture_vehicle_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if row(new.operational_status,new.archived_at) is not distinct from row(old.operational_status,old.archived_at) then return new; end if;
 end if;
 insert into public.vehicle_status_events(vehicle_id,operational_status,archived,recorded_at)
 values(new.id,new.operational_status,new.archived_at is not null,case when tg_op='INSERT' then new.created_at else clock_timestamp() end);
 return new;
end;
$$;
create trigger status_history after insert or update on public.vehicles for each row execute function app_private.capture_vehicle_status();
create function app_private.guard_unfinished_maintenance() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='rentals' then
  if new.status='ACTIVE' and old.status='PREPARING' then
   if exists(select 1 from public.maintenance_records m where m.vehicle_id=new.vehicle_id and m.blocks_availability and(m.status='IN_PROGRESS' or(m.status='SCHEDULED' and m.end_at<now()))) then raise exception using errcode='23514',message='Unfinished maintenance prevents checkout'; end if;
  end if;
 else
  if new.released_at is null and new.kind in ('RESERVATION','RENTAL') then
   if exists(select 1 from public.maintenance_records m where m.vehicle_id=new.vehicle_id and m.blocks_availability and(m.status='IN_PROGRESS' or(m.status='SCHEDULED' and m.end_at<now()))) then raise exception using errcode='23514',message='Unfinished maintenance prevents allocation'; end if;
  end if;
 end if; return new;
end;
$$;
create trigger maintenance_checkout before update on public.rentals for each row execute function app_private.guard_unfinished_maintenance();
create trigger unfinished_maintenance before insert or update on public.vehicle_allocations for each row execute function app_private.guard_unfinished_maintenance();

create function app_private.company_today(at_time timestamptz default now()) returns date language sql stable set search_path='' as $$
 select (at_time at time zone coalesce((select timezone from public.company_settings where singleton),'America/Fortaleza'))::date;
$$;
create function public.maintenance_command(input jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare action text:=input->>'action'; result jsonb; m public.maintenance_records; v public.vehicles; entity uuid; expense jsonb; from_time timestamptz; to_time timestamptz;
begin
 perform app_private.require_permission('maintenance.write'); perform app_private.require_permission('maintenance.read');
 result:=app_private.begin_operation('maintenance_command',idempotency_key,input); if result is not null then return result; end if;
 if action='CREATE' then
  select * into strict v from public.vehicles where id=(input->>'vehicle_id')::uuid for update;
  if v.archived_at is not null or v.operational_status='RETIRED' or (input->>'mileage')::bigint<v.mileage then raise exception using errcode='23514',message='Vehicle or mileage unavailable'; end if;
  if coalesce(length(btrim(input->>'description')),0) not between 5 and 2000 then raise exception using errcode='22023',message='Description required'; end if;
  from_time:=(input->>'start_at')::timestamptz; to_time:=(input->>'end_at')::timestamptz;
  if (input->>'blocks_availability')::boolean and exists(select 1 from public.rentals r where r.vehicle_id=v.id and r.status in ('ACTIVE','OVERDUE') and r.end_at<now()) then raise exception using errcode='23514',message='Unreturned vehicle prevents maintenance booking'; end if;
  insert into public.maintenance_records(vehicle_id,kind,mileage,start_at,end_at,blocks_availability,description,responsible_id)
   values(v.id,input->>'kind',(input->>'mileage')::bigint,from_time,to_time,(input->>'blocks_availability')::boolean,btrim(input->>'description'),auth.uid()) returning * into m;
  if m.blocks_availability then insert into public.vehicle_allocations(vehicle_id,period,kind,maintenance_record_id,created_by) values(v.id,tstzrange(m.start_at,m.end_at,'[)'),'MAINTENANCE',m.id,auth.uid()); end if;
 else
  select * into strict m from public.maintenance_records where id=(input->>'maintenance_id')::uuid for update;
  if m.version is distinct from (input->>'expected_version')::integer then raise exception using errcode='40001',message='Maintenance changed'; end if;
  select * into strict v from public.vehicles where id=m.vehicle_id for update;
  if m.status in ('COMPLETED','CANCELLED') then raise exception using errcode='23514',message='Maintenance closed'; end if;
  if action='START' then
   if m.status<>'SCHEDULED' or now()<m.start_at or now()>=m.end_at or(m.blocks_availability and exists(select 1 from public.rentals r where r.vehicle_id=v.id and r.status in ('ACTIVE','OVERDUE'))) then raise exception using errcode='23514',message='Maintenance start window or vehicle in use'; end if;
   update public.maintenance_records set status='IN_PROGRESS',actual_start_at=clock_timestamp(),version=version+1 where id=m.id returning * into m;
  elsif action='RESCHEDULE' then
   if m.status<>'SCHEDULED' then raise exception using errcode='23514',message='Only scheduled maintenance can be moved'; end if;
   from_time:=(input->>'start_at')::timestamptz;to_time:=(input->>'end_at')::timestamptz;
   update public.maintenance_records set start_at=from_time,end_at=to_time,version=version+1 where id=m.id returning * into m;
   if m.blocks_availability then update public.vehicle_allocations set period=tstzrange(m.start_at,m.end_at,'[)') where maintenance_record_id=m.id and released_at is null; end if;
  elsif action='EXTEND' then
   if m.status<>'IN_PROGRESS' or (input->>'end_at')::timestamptz<=greatest(m.end_at,now()) then raise exception using errcode='23514',message='Invalid maintenance extension'; end if;
   update public.maintenance_records set end_at=(input->>'end_at')::timestamptz,version=version+1 where id=m.id returning * into m;
   if m.blocks_availability then update public.vehicle_allocations set period=tstzrange(m.start_at,m.end_at,'[)') where maintenance_record_id=m.id and released_at is null; end if;
  elsif action='COMPLETE' then
   if m.status<>'IN_PROGRESS' or (input->>'mileage')::bigint<greatest(v.mileage,m.mileage)
    or ((input->>'next_due_on')::date is not null and(input->>'next_due_on')::date<app_private.company_today()) then raise exception using errcode='23514',message='Invalid maintenance completion'; end if;
   update public.maintenance_records set status='COMPLETED',mileage=(input->>'mileage')::bigint,next_due_on=(input->>'next_due_on')::date,
    next_due_mileage=(input->>'next_due_mileage')::bigint,actual_end_at=clock_timestamp(),version=version+1 where id=m.id returning * into m;
   update public.vehicle_allocations set released_at=clock_timestamp() where maintenance_record_id=m.id and released_at is null;
   update public.vehicles set mileage=greatest(mileage,m.mileage) where id=v.id;
   if input->'expense' is not null and input->'expense'<>'null'::jsonb then
    expense:=public.finance_command((input->'expense')||jsonb_build_object('action','EXPENSE','vehicle_id',v.id,'maintenance_id',m.id),encode(sha256(convert_to(idempotency_key||':maintenance-expense','UTF8')),'hex'));
   end if;
  elsif action='CANCEL' then
   if coalesce(length(btrim(input->>'reason')),0) not between 5 and 1000 then raise exception using errcode='22023',message='Cancellation reason required'; end if;
   update public.maintenance_records set status='CANCELLED',version=version+1 where id=m.id returning * into m;
   update public.vehicle_allocations set released_at=clock_timestamp() where maintenance_record_id=m.id and released_at is null;
  else raise exception using errcode='22023',message='Unknown maintenance command'; end if;
 end if;
 insert into public.maintenance_events(maintenance_id,actor_id,event_type,detail) values(m.id,auth.uid(),action,jsonb_strip_nulls(jsonb_build_object('reason',input->>'reason','expense_id',expense->>'id')));
 insert into public.outbox_events(event_type,payload,deduplication_key) values('maintenance.'||lower(action),jsonb_build_object('maintenance_id',m.id),'maintenance:'||m.id||':'||m.version);
 return app_private.finish_operation('maintenance_command',idempotency_key,jsonb_build_object('id',m.id,'version',m.version,'status',m.status));
end;
$$;

create function app_private.due_maintenance() returns table(id uuid,vehicle_id uuid,kind text,next_due_on date,next_due_mileage bigint,current_mileage bigint)
language sql stable set search_path='' as $$
 select x.id,x.vehicle_id,x.kind,x.next_due_on,x.next_due_mileage,v.mileage from (
  select distinct on(vehicle_id,kind) id,vehicle_id,kind,next_due_on,next_due_mileage from public.maintenance_records where status='COMPLETED' order by vehicle_id,kind,actual_end_at desc nulls last,created_at desc,id
 )x join public.vehicles v on v.id=x.vehicle_id where v.archived_at is null and v.operational_status<>'RETIRED'
 and(x.next_due_on<=app_private.company_today() or x.next_due_mileage<=v.mileage);
$$;
create function public.maintenance_alerts() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin perform app_private.require_permission('maintenance.read');
 return jsonb_build_object('due',(select coalesce(jsonb_agg(x),'[]') from(select * from app_private.due_maintenance() order by next_due_on nulls last,id limit 100)x),
 'unfinished',(select coalesce(jsonb_agg(x),'[]') from(select id,vehicle_id,kind,status,end_at from public.maintenance_records where status in ('SCHEDULED','IN_PROGRESS') and end_at<now() order by end_at,id limit 100)x));
end;
$$;
create function public.queue_maintenance_alerts(batch_size integer) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if batch_size is null or batch_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid batch'; end if;
 with inserted as(insert into public.outbox_events(event_type,payload,deduplication_key)
  select 'maintenance.due',jsonb_build_object('maintenance_id',d.id),'maintenance:'||d.id||':due' from app_private.due_maintenance() d
   where not exists(select 1 from public.outbox_events o where o.deduplication_key='maintenance:'||d.id||':due') order by d.id limit batch_size on conflict(deduplication_key) do nothing returning id)
  select count(*)::integer into n from inserted;
 return n;
end;
$$;

-- Relatórios retornam células como texto para preservar decimais/UUID sem coerção em JSON/CSV.
create function app_private.check_report_period(from_at timestamptz,to_at timestamptz) returns void language plpgsql set search_path='' as $$
-- A aplicação limita 366 dias civis; uma hora adicional acomoda a saída do horário de verão.
begin if from_at is null or to_at is null or not isfinite(from_at) or not isfinite(to_at) or to_at<=from_at or to_at-from_at>interval '366 days 1 hour' then raise exception using errcode='22023',message='Period must be positive and at most 366 civil days'; end if; end;
$$;
create function app_private.charge_contract_value(entity uuid,as_of timestamptz) returns numeric language sql stable set search_path='' as $$
 select case when exists(select 1 from public.rental_charge_cancellations x where x.charge_id=c.id and x.created_at<as_of) then 0::numeric
 else c.amount-coalesce((select sum(a.amount) from public.charge_adjustments a where a.charge_id=c.id and a.created_at<as_of),0) end from public.charges c where c.id=entity;
$$;
create function app_private.occupancy_rows(from_at timestamptz,to_at timestamptz) returns table(vehicle_id uuid,name text,fleet_hours numeric,rented_hours numeric,coverage_limited boolean)
language sql stable set search_path='' as $$
 with events as(select e.*,lead(recorded_at) over(partition by vehicle_id order by recorded_at,id) until_at from public.vehicle_status_events e),
 segments as(select e.vehicle_id,greatest(from_at,e.recorded_at) s,least(to_at,now(),coalesce(e.until_at,to_at)) t from events e where e.operational_status='ACTIVE' and not e.archived),
 eligible as(select * from segments where t>s)
 select v.id,v.make||' '||v.model,
  coalesce((select sum(extract(epoch from e.t-e.s))/3600 from eligible e where e.vehicle_id=v.id),0)::numeric,
  coalesce((select sum(greatest(0,extract(epoch from least(e.t,coalesce(r.actual_end_at,now()))-greatest(e.s,r.actual_start_at))))/3600 from eligible e join public.rentals r on r.vehicle_id=e.vehicle_id and r.actual_start_at is not null where e.vehicle_id=v.id),0)::numeric,
  exists(select 1 from public.vehicle_status_events e where e.vehicle_id=v.id and e.baseline and e.recorded_at>from_at)
 from public.vehicles v where v.created_at<to_at and(v.archived_at is null or v.archived_at>=from_at);
$$;
create function public.business_report(report_kind text,from_at timestamptz,to_at timestamptz,page integer default 1,page_size integer default 50) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; total bigint; financial boolean:=report_kind in ('REVENUE','RECEIPTS','EXPENSES','PROFITABILITY','BALANCES');
begin
 if financial then perform app_private.require_permission('reports.finance'); else perform app_private.require_permission('reports.operations'); end if;
 perform app_private.check_report_period(from_at,to_at);
 if page is null or page_size is null or page not between 1 and 10000 or page_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid pagination'; end if;
 if report_kind='REVENUE' then
  select count(*) into total from public.charges c where coalesce(c.competence_at,c.due_at)>=from_at and coalesce(c.competence_at,c.due_at)<to_at and c.created_at<to_at;
  select coalesce(jsonb_agg(x),'[]') into rows from(select c.id::text,c.customer_id::text,c.rental_id::text,c.kind,coalesce(c.competence_at,c.due_at)::text competence,c.due_at::text due_at,c.amount::text gross,app_private.charge_contract_value(c.id,to_at)::text contracted
   from public.charges c where coalesce(c.competence_at,c.due_at)>=from_at and coalesce(c.competence_at,c.due_at)<to_at and c.created_at<to_at order by coalesce(c.competence_at,c.due_at),c.id limit page_size offset(page-1)*page_size)x;
 elsif report_kind='RECEIPTS' then
  with cash as(select id,confirmed_at dt,amount,customer_id,'RECEIPT' kind from public.payments union all select f.id,f.created_at,-f.amount,p.customer_id,'REFUND' from public.refunds f join public.payments p on p.id=f.payment_id)
   select count(*) into total from cash where dt>=from_at and dt<to_at;
  with cash as(select id,confirmed_at dt,amount,customer_id,'RECEIPT' kind from public.payments union all select f.id,f.created_at,-f.amount,p.customer_id,'REFUND' from public.refunds f join public.payments p on p.id=f.payment_id)
   select coalesce(jsonb_agg(x),'[]') into rows from(select id::text,dt::text date,kind,customer_id::text,amount::text from cash where dt>=from_at and dt<to_at order by dt,id limit page_size offset(page-1)*page_size)x;
 elsif report_kind='EXPENSES' then
  with movements as(select e.id,e.vehicle_id,e.occurred_at dt,e.amount,e.description,'EXPENSE' kind from public.expenses e union all select r.id,e.vehicle_id,r.created_at,-r.amount,r.reason,'REVERSAL' from public.expense_reversals r join public.expenses e on e.id=r.expense_id)
   select count(*) into total from movements where dt>=from_at and dt<to_at;
  with movements as(select e.id,e.vehicle_id,e.occurred_at dt,e.amount,e.description,'EXPENSE' kind from public.expenses e union all select r.id,e.vehicle_id,r.created_at,-r.amount,r.reason,'REVERSAL' from public.expense_reversals r join public.expenses e on e.id=r.expense_id)
   select coalesce(jsonb_agg(x),'[]') into rows from(select id::text,vehicle_id::text,dt::text date,kind,description,amount::text from movements where dt>=from_at and dt<to_at order by dt,id limit page_size offset(page-1)*page_size)x;
 elsif report_kind='BALANCES' then
  select count(*) into total from public.charges c where c.due_at>=from_at and c.due_at<to_at and app_private.charge_balance(c.id)>0;
  select coalesce(jsonb_agg(x),'[]') into rows from(select c.id::text,c.customer_id::text,(select name from public.customers where id=c.customer_id) customer,c.rental_id::text,c.due_at::text,app_private.charge_balance(c.id)::text balance
   from public.charges c where c.due_at>=from_at and c.due_at<to_at and app_private.charge_balance(c.id)>0 order by c.due_at,c.id limit page_size offset(page-1)*page_size)x;
 elsif report_kind='PROFITABILITY' then
  select count(*) into total from public.vehicles;
  select coalesce(jsonb_agg(x),'[]') into rows from(select v.id::text,v.make||' '||v.model vehicle,
    coalesce((select sum(app_private.charge_contract_value(c.id,to_at)) from public.charges c join public.rentals r on r.id=c.rental_id where r.vehicle_id=v.id and coalesce(c.competence_at,c.due_at)>=from_at and coalesce(c.competence_at,c.due_at)<to_at and c.created_at<to_at),0)::text contracted,
    coalesce((select sum(e.amount) from public.expenses e where e.vehicle_id=v.id and e.occurred_at>=from_at and e.occurred_at<to_at),0)::text expenses,
    coalesce((select sum(a.amount) from public.expense_reversals a join public.expenses e on e.id=a.expense_id where e.vehicle_id=v.id and a.created_at>=from_at and a.created_at<to_at),0)::text expense_reversals
    from public.vehicles v order by v.id limit page_size offset(page-1)*page_size)x;
 elsif report_kind='RESERVATIONS' then
  select count(*) into total from(select status from public.reservations where start_at>=from_at and start_at<to_at group by status)x;
  select coalesce(jsonb_agg(x),'[]') into rows from(select status,count(*)::text count from public.reservations where start_at>=from_at and start_at<to_at group by status order by status limit page_size offset(page-1)*page_size)x;
 elsif report_kind='OCCUPANCY' then
  select count(*) into total from app_private.occupancy_rows(from_at,to_at);
  select coalesce(jsonb_agg(x),'[]') into rows from(select o.vehicle_id::text,o.name vehicle,round(o.fleet_hours,4)::text fleet_hours,round(o.rented_hours,4)::text rented_hours,
   case when o.fleet_hours>0 then round(100*o.rented_hours/o.fleet_hours,2)::text else null end occupancy_percent,o.coverage_limited::text coverage_limited from app_private.occupancy_rows(from_at,to_at)o order by o.vehicle_id limit page_size offset(page-1)*page_size)x;
 elsif report_kind='RECURRING' then
  select count(*) into total from(select customer_id from public.rentals where status<>'CANCELLED' and start_at>=from_at and start_at<to_at group by customer_id having count(*)>1)x;
  select coalesce(jsonb_agg(x),'[]') into rows from(select r.customer_id::text,(select name from public.customers where id=r.customer_id) customer,count(*)::text rentals from public.rentals r where status<>'CANCELLED' and start_at>=from_at and start_at<to_at group by r.customer_id having count(*)>1 order by count(*) desc,r.customer_id limit page_size offset(page-1)*page_size)x;
 elsif report_kind='OVERDUE' then
  select count(*) into total from public.rentals where status in ('ACTIVE','OVERDUE') and end_at<now() and end_at>=from_at and end_at<to_at;
  select coalesce(jsonb_agg(x),'[]') into rows from(select id::text,vehicle_id::text,end_at::text expected_return,status from public.rentals where status in ('ACTIVE','OVERDUE') and end_at<now() and end_at>=from_at and end_at<to_at order by end_at,id limit page_size offset(page-1)*page_size)x;
 elsif report_kind='MAINTENANCE' then
  select count(*) into total from public.maintenance_records where status='COMPLETED' and coalesce(actual_end_at,end_at)>=from_at and coalesce(actual_end_at,end_at)<to_at;
  select coalesce(jsonb_agg(x),'[]') into rows from(select id::text,vehicle_id::text,kind,mileage::text,coalesce(actual_end_at,end_at)::text completed_at,next_due_on::text,next_due_mileage::text from public.maintenance_records where status='COMPLETED' and coalesce(actual_end_at,end_at)>=from_at and coalesce(actual_end_at,end_at)<to_at order by coalesce(actual_end_at,end_at),id limit page_size offset(page-1)*page_size)x;
 else raise exception using errcode='22023',message='Invalid report kind'; end if;
 return jsonb_build_object('rows',rows,'total',total,'page',page,'page_size',page_size,'kind',report_kind);
end;
$$;

create function public.business_dashboard(from_at timestamptz,to_at timestamptz) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb:='{}'; ops jsonb; finance jsonb; hours numeric; rented numeric;
begin
 if not(app_private.has_permission('operations.read') or app_private.has_permission('finance.read')) then raise exception using errcode='42501',message='Forbidden'; end if;
 perform app_private.check_report_period(from_at,to_at);
 if app_private.has_permission('operations.read') then
  select coalesce(sum(fleet_hours),0),coalesce(sum(rented_hours),0) into hours,rented from app_private.occupancy_rows(from_at,to_at);
  ops:=jsonb_build_object('vehicles',(select count(*) from public.vehicles where archived_at is null),
   'active_vehicles',(select count(*) from public.vehicles where archived_at is null and operational_status='ACTIVE'),
   'maintenance',(select count(*) from public.vehicles v where v.archived_at is null and(v.operational_status='MAINTENANCE' or exists(select 1 from public.maintenance_records m where m.vehicle_id=v.id and m.blocks_availability and m.status in ('SCHEDULED','IN_PROGRESS') and(m.start_at<=now() and m.end_at>now() or m.status='IN_PROGRESS' or m.end_at<now())))),
   'occupied',(select count(distinct vehicle_id) from public.rentals where status in ('ACTIVE','OVERDUE')),
   'available',(select count(*) from public.vehicles v where v.archived_at is null and v.operational_status='ACTIVE' and not exists(select 1 from public.vehicle_allocations a where a.vehicle_id=v.id and a.released_at is null and a.period@>now()) and not exists(select 1 from public.rentals r where r.vehicle_id=v.id and status in ('ACTIVE','OVERDUE')) and not exists(select 1 from public.maintenance_records m where m.vehicle_id=v.id and m.blocks_availability and(m.status='IN_PROGRESS' or(m.status='SCHEDULED' and m.end_at<now())))),
   'pending_reservations',(select count(*) from public.reservations where status in ('REQUESTED','UNDER_REVIEW')),
   'confirmed_reservations',(select count(*) from public.reservations where status='CONFIRMED'),
   'active_rentals',(select count(*) from public.rentals where status in ('ACTIVE','OVERDUE')),
   'overdue_rentals',(select count(*) from public.rentals where status in ('ACTIVE','OVERDUE') and end_at<now()),
   'occupancy_percent',case when hours>0 then round(100*rented/hours,2)::text else null end,
   'coverage_limited',exists(select 1 from app_private.occupancy_rows(from_at,to_at) where coverage_limited),
   'next_returns',case when app_private.has_permission('rentals.read') then(select coalesce(jsonb_agg(x),'[]') from(select id,end_at from public.rentals where status in ('ACTIVE','OVERDUE') and end_at>=from_at and end_at<to_at order by end_at,id limit 10)x) else '[]'::jsonb end);
  result:=result||jsonb_build_object('operations',ops);
 end if;
 if app_private.has_permission('finance.read') then
  finance:=jsonb_build_object('contracted',(select coalesce(sum(app_private.charge_contract_value(id,to_at)),0)::text from public.charges where coalesce(competence_at,due_at)>=from_at and coalesce(competence_at,due_at)<to_at and created_at<to_at),
   'received',(select coalesce(sum(amount),0)::text from public.payments where confirmed_at>=from_at and confirmed_at<to_at),
   'refunded',(select coalesce(sum(amount),0)::text from public.refunds where payment_id is not null and created_at>=from_at and created_at<to_at),
   'receivable_now',(select coalesce(sum(app_private.charge_balance(id)),0)::text from public.charges),
   'deposit_received',(select coalesce(sum(amount),0)::text from public.deposits where kind='RECEIVED' and created_at>=from_at and created_at<to_at),
   'deposit_refunded',(select coalesce(sum(amount),0)::text from public.refunds where deposit_id is not null and created_at>=from_at and created_at<to_at),
   'deposit_held_now',(select coalesce(sum(app_private.deposit_balance(id)),0)::text from public.deposits where kind='RECEIVED'),
   'expenses',(select coalesce(sum(amount),0)::text from public.expenses where occurred_at>=from_at and occurred_at<to_at),
   'expense_reversals',(select coalesce(sum(amount),0)::text from public.expense_reversals where created_at>=from_at and created_at<to_at));
  result:=result||jsonb_build_object('finance',finance);
 end if; return result;
end;
$$;
create function public.audit_report_export(report_kind text,from_at timestamptz,to_at timestamptz,page integer,row_count integer) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform app_private.require_permission(case when report_kind in ('REVENUE','RECEIPTS','EXPENSES','PROFITABILITY','BALANCES') then 'reports.finance' else 'reports.operations' end);
 perform app_private.check_report_period(from_at,to_at);
 if report_kind not in ('REVENUE','RECEIPTS','EXPENSES','PROFITABILITY','BALANCES','RESERVATIONS','OCCUPANCY','RECURRING','OVERDUE','MAINTENANCE') or page not between 1 and 10000 or row_count not between 0 and 100 then raise exception using errcode='22023',message='Invalid export'; end if;
 insert into public.audit_logs(actor_id,action,domain,entity_type,entity_id,safe_changes) values(auth.uid(),'EXPORT',case when report_kind in ('REVENUE','RECEIPTS','EXPENSES','PROFITABILITY','BALANCES') then 'FINANCE' else 'OPERATIONS' end,'report',gen_random_uuid(),jsonb_build_object('kind',report_kind,'from',from_at,'to',to_at,'page',page,'rows',row_count));
end;
$$;
revoke all on function public.maintenance_command(jsonb,text),public.maintenance_alerts(),public.business_report(text,timestamptz,timestamptz,integer,integer),public.business_dashboard(timestamptz,timestamptz),public.audit_report_export(text,timestamptz,timestamptz,integer,integer),public.queue_maintenance_alerts(integer) from public,anon,authenticated,service_role;
grant execute on function public.maintenance_command(jsonb,text),public.maintenance_alerts(),public.business_report(text,timestamptz,timestamptz,integer,integer),public.business_dashboard(timestamptz,timestamptz),public.audit_report_export(text,timestamptz,timestamptz,integer,integer) to authenticated;
grant execute on function public.queue_maintenance_alerts(integer) to service_role;
revoke execute on all functions in schema app_private from public;
