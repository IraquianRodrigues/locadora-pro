alter table public.notification_templates add column subject text not null default 'Atualização da locadora';
revoke insert,update on public.notification_templates from authenticated;
create trigger immutable_notification_template before update or delete on public.notification_templates for each row execute function app_private.reject_mutation();
create table public.notification_routes (
 id uuid primary key default gen_random_uuid(),event_type text not null check(event_type ~ '^[a-z][a-z0-9_.]{2,99}$'),
 channel text not null check(channel in ('IN_APP','EMAIL')),target text not null check(target in ('OPERATIONS','FINANCE','CUSTOMER')),
 template_id uuid not null references public.notification_templates(id),enabled boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(event_type,channel,target),check((channel='EMAIL' and target='CUSTOMER') or(channel='IN_APP' and target in ('OPERATIONS','FINANCE')))
);
select app_private.secure_table('notification_routes','settings.manage');
create index on public.notification_routes(template_id);
create trigger audit_change after insert or update on public.notification_routes for each row execute function app_private.record_audit('ACCESS');
alter table public.notifications drop constraint notifications_status_check;
alter table public.notifications add constraint notifications_status_check check(status in ('PENDING','PROCESSING','SENT','FAILED','DEAD'));
alter table public.notifications add column subject_snapshot text;
alter table public.notifications add column body_snapshot text;
alter table public.notifications add column recipient_email text;
alter table public.notifications add column sender_snapshot text;
alter table public.notifications add column required_permission text;
alter table public.notifications add column read_at timestamptz;
alter table public.notifications add column lease_token uuid;
alter table public.notifications add column locked_until timestamptz;
alter table public.notifications add column available_at timestamptz not null default now();
alter table public.notifications add column first_attempt_at timestamptz;
alter table public.notifications add column last_error_code text;
alter table public.notifications add column provider_id text;
create unique index notification_delivery_once on public.notifications(outbox_event_id,channel,recipient_profile_id) nulls not distinct where outbox_event_id is not null;
create index email_jobs on public.notifications(available_at,id) where channel='EMAIL' and status in ('PENDING','FAILED','PROCESSING');
create index notification_inbox on public.notifications(recipient_profile_id,created_at desc,id) where channel='IN_APP';
drop policy own_notification on public.notifications;
create policy own_notification on public.notifications for select to authenticated using(
 channel='IN_APP' and recipient_profile_id=(select auth.uid()) and required_permission is not null and app_private.has_permission(required_permission)
);
create function app_private.protect_notification_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.template_id,new.outbox_event_id,new.recipient_profile_id,new.resource_id,new.channel,new.subject_snapshot,new.body_snapshot,new.recipient_email,new.required_permission)
  is distinct from row(old.template_id,old.outbox_event_id,old.recipient_profile_id,old.resource_id,old.channel,old.subject_snapshot,old.body_snapshot,old.recipient_email,old.required_permission)
  or(old.sender_snapshot is not null and new.sender_snapshot is distinct from old.sender_snapshot)
  or(old.status='SENT' and row(new.status,new.provider_id,new.attempts) is distinct from row(old.status,old.provider_id,old.attempts)) then raise exception using errcode='23514',message='Notification snapshot is immutable'; end if;
 return new;
end;
$$;
create trigger notification_snapshot before update on public.notifications for each row execute function app_private.protect_notification_snapshot();

create function public.notification_setup(input jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; entity uuid; text_content text; template public.notification_templates;
begin
 perform app_private.require_permission('settings.manage');
 result:=app_private.begin_operation('notification_setup',idempotency_key,input);if result is not null then return result;end if;
 perform pg_advisory_xact_lock(187640,9);
 if input->>'kind'='TEMPLATE' then
  text_content:=(input->>'subject')||' '||(input->>'body');
  if coalesce(length(btrim(input->>'subject')),0) not between 3 and 160 or coalesce(length(btrim(input->>'body')),0) not between 10 and 8000
   or coalesce(input->>'name','') !~ '^[a-zA-Z0-9_.-]{1,100}$' or(input->>'version')::integer<1 or input->>'channel' not in ('IN_APP','EMAIL') then raise exception using errcode='22023',message='Invalid notification template';end if;
  text_content:=replace(replace(replace(replace(text_content,'{reference}',''),'{status}',''),'{date}',''),'{event}','');
  if text_content ~ '[{}]' then raise exception using errcode='22023',message='Unsupported template variable';end if;
  insert into public.notification_templates(template_key,version,channel,subject,body) values(input->>'name',(input->>'version')::integer,input->>'channel',input->>'subject',input->>'body') returning id into entity;
 elsif input->>'kind'='ROUTE' then
  select * into strict template from public.notification_templates where id=(input->>'template_id')::uuid;
  if template.channel is distinct from input->>'channel' or jsonb_typeof(input->'enabled') is distinct from 'boolean' then raise exception using errcode='22023',message='Route/template channel mismatch';end if;
  if input->>'channel'='EMAIL' and (input->>'event_type' not like 'reservation.%' and input->>'event_type' not like 'rental.%') then raise exception using errcode='22023',message='Customer email requires reservation or rental event';end if;
  if exists(select 1 from public.notification_routes r where r.event_type=input->>'event_type' and r.channel=input->>'channel' and r.target=input->>'target' and r.updated_at is distinct from(input->>'expected_updated_at')::timestamptz) then raise exception using errcode='40001',message='Route changed';end if;
  insert into public.notification_routes(event_type,channel,target,template_id,enabled) values(input->>'event_type',input->>'channel',input->>'target',template.id,(input->>'enabled')::boolean)
   on conflict(event_type,channel,target) do update set template_id=excluded.template_id,enabled=excluded.enabled returning id into entity;
 else raise exception using errcode='22023',message='Unknown notification setup';end if;
 return app_private.finish_operation('notification_setup',idempotency_key,jsonb_build_object('id',entity));
end;
$$;
insert into public.notification_templates(template_key,version,channel,subject,body) values
 ('operational_update',1,'IN_APP','Atualização operacional','Registro {reference}: {status}. Consulte o painel para acompanhar.'),
 ('financial_update',1,'IN_APP','Atualização financeira','Registro {reference}: {status}. Consulte o financeiro para acompanhar.');
insert into public.notification_routes(event_type,channel,target,template_id,enabled)
 select event_type,'IN_APP','OPERATIONS',t.id,true from public.notification_templates t cross join unnest(array[
 'reservation.requested','reservation.confirmed','reservation.rejected','reservation.cancelled','reservation.expired','rental.created','rental.checkout','rental.checkin','rental.extended','rental.overdue','rental.cancel','maintenance.create','maintenance.complete','maintenance.due']) event_type where t.template_key='operational_update' and t.version=1;
insert into public.notification_routes(event_type,channel,target,template_id,enabled)
 select event_type,'IN_APP','FINANCE',t.id,true from public.notification_templates t cross join unnest(array[
 'payment.confirmed','finance.charge','finance.payment','finance.allocate','finance.deposit_receive','finance.deposit_apply','finance.deposit_unapply','finance.refund','finance.adjust','finance.expense','finance.expense_reverse']) event_type where t.template_key='financial_update' and t.version=1;

create function app_private.notification_text(body text,reference text,status text,event_label text) returns text language sql stable set search_path='' as $$
 select replace(replace(replace(replace(body,'{reference}',reference),'{status}',status),'{event}',event_label),'{date}',to_char(now() at time zone 'UTC','YYYY-MM-DD HH24:MI')||' UTC');
$$;
create function public.dispatch_notification_events(batch_size integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare event_row public.outbox_events; route public.notification_routes; template public.notification_templates; person record;
 ref uuid; cust uuid; dest text; state text; label text; subject_text text; body_text text; permission text;
 completed integer:=0;failed integer:=0; deliveries integer:=0; created integer; event_deliveries integer;
begin
 if batch_size is null or batch_size not between 1 and 100 then raise exception using errcode='22023',message='Invalid batch';end if;
 for event_row in select * from public.outbox_events where attempts<5 and available_at<=now() and(status='PENDING' or(status='PROCESSING' and locked_until<now())) order by available_at,id for update skip locked limit batch_size loop
  begin
   event_deliveries:=0;
   ref:=coalesce(event_row.payload->>'reservation_id',event_row.payload->>'rental_id',event_row.payload->>'maintenance_id',event_row.payload->>'payment_id',event_row.payload->>'entity_id',event_row.payload->>'quote_id')::uuid;
   cust:=null;state:=null;
   if event_row.event_type like 'reservation.%' then select r.customer_id,r.status into cust,state from public.reservations r where r.id=ref;
   elsif event_row.event_type like 'rental.%' then select r.customer_id,r.status into cust,state from public.rentals r where r.id=ref;
   elsif event_row.event_type like 'maintenance.%' then select m.status into state from public.maintenance_records m where m.id=ref;end if;
   label:=case event_row.event_type when 'reservation.requested' then 'solicitação de reserva recebida' when 'reservation.confirmed' then 'reserva confirmada' when 'reservation.rejected' then 'reserva não aprovada' when 'reservation.cancelled' then 'reserva cancelada' when 'reservation.expired' then 'prazo da reserva expirado'
    when 'rental.created' then 'locação criada' when 'rental.checkout' then 'retirada registrada' when 'rental.checkin' then 'devolução registrada' when 'rental.extended' then 'prorrogação registrada' when 'rental.overdue' then 'devolução em atraso'
    when 'rental.cancel' then 'locação cancelada' when 'maintenance.due' then 'manutenção atingiu a data ou quilometragem' when 'maintenance.create' then 'manutenção agendada' when 'maintenance.complete' then 'manutenção concluída'
    when 'finance.payment' then 'recebimento confirmado' when 'payment.confirmed' then 'recebimento confirmado' when 'finance.refund' then 'reembolso confirmado' when 'finance.deposit_receive' then 'caução recebida' when 'finance.deposit_apply' then 'caução aplicada' when 'finance.deposit_unapply' then 'aplicação de caução estornada' when 'finance.charge' then 'cobrança criada' when 'finance.adjust' then 'ajuste de cobrança registrado' when 'finance.expense' then 'despesa registrada' else 'atualização registrada' end;
   for route in select * from public.notification_routes where event_type=event_row.event_type and enabled order by id loop
    select * into strict template from public.notification_templates where id=route.template_id and channel=route.channel;
    subject_text:=app_private.notification_text(template.subject,coalesce(left(ref::text,8),'sistema'),label,label);
    body_text:=app_private.notification_text(template.body,coalesce(left(ref::text,8),'sistema'),label,label);
    if route.channel='IN_APP' then
     permission:=case route.target when 'FINANCE' then 'finance.read' else 'operations.read' end;
     for person in select distinct p.id from public.profiles p join public.user_roles ur on ur.user_id=p.id join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions perm on perm.id=rp.permission_id where p.active and perm.code=permission loop
      insert into public.notifications(template_id,outbox_event_id,recipient_profile_id,resource_id,channel,status,subject_snapshot,body_snapshot,required_permission)
       values(template.id,event_row.id,person.id,ref,'IN_APP','SENT',subject_text,body_text,permission) on conflict do nothing;
      get diagnostics created=row_count;event_deliveries:=event_deliveries+created;
     end loop;
    else
     select email into dest from public.customers where id=cust;
     if dest is null then raise exception using errcode='23514',message='Customer destination missing';end if;
     insert into public.notifications(template_id,outbox_event_id,resource_id,channel,status,subject_snapshot,body_snapshot,recipient_email)
      values(template.id,event_row.id,ref,'EMAIL','PENDING',subject_text,body_text,dest) on conflict do nothing;
     get diagnostics created=row_count;event_deliveries:=event_deliveries+created;
    end if;
   end loop;
   update public.outbox_events set status='COMPLETED',attempts=attempts+1,locked_until=null,last_error_code=null where id=event_row.id;completed:=completed+1;deliveries:=deliveries+event_deliveries;
  exception when others then
   update public.outbox_events set status=case when attempts+1>=5 then 'DEAD' else 'PENDING' end,attempts=attempts+1,available_at=now()+make_interval(secs=>least(3600,60*(attempts+1))),locked_until=null,last_error_code='DISPATCH_FAILED' where id=event_row.id;failed:=failed+1;
  end;
 end loop;
 return jsonb_build_object('completed',completed,'failed',failed,'deliveries',deliveries);
end;
$$;
create function public.claim_email_notifications(batch_size integer,sender text) returns setof public.notifications language plpgsql security definer set search_path='' as $$
begin
 if batch_size is null or batch_size not between 1 and 10 or sender is null or sender ~ E'[\r\n]' or length(sender)>254 then raise exception using errcode='22023',message='Invalid batch or sender';end if;
 -- O provedor mantém a chave por 24h. Depois de 23h, exigir reconciliação humana.
 update public.notifications set status='DEAD',lease_token=null,locked_until=null,last_error_code='IDEMPOTENCY_WINDOW_EXPIRED'
  where channel='EMAIL' and status in ('PENDING','FAILED','PROCESSING') and first_attempt_at<now()-interval '23 hours' and(locked_until is null or locked_until<now());
 update public.notifications set status='DEAD',lease_token=null,locked_until=null,last_error_code='RETRY_EXHAUSTED'
  where channel='EMAIL' and status='PROCESSING' and attempts>=5 and locked_until<now();
 return query update public.notifications n set status='PROCESSING',attempts=n.attempts+1,lease_token=gen_random_uuid(),locked_until=now()+interval '2 minutes',first_attempt_at=coalesce(n.first_attempt_at,now()),sender_snapshot=coalesce(n.sender_snapshot,sender)
  where n.id in(select id from public.notifications where channel='EMAIL' and attempts<5 and available_at<=now() and(status in ('PENDING','FAILED') or(status='PROCESSING' and locked_until<now())) order by available_at,id for update skip locked limit batch_size) returning n.*;
end;
$$;
create function public.finish_email_notification(notification_id uuid,lease uuid,provider_message_id text,error_code text,permanent boolean) returns boolean language plpgsql security definer set search_path='' as $$
declare n public.notifications;
begin
 select * into strict n from public.notifications where id=notification_id for update;
 if n.status<>'PROCESSING' or lease is null or n.lease_token is distinct from lease or n.locked_until<clock_timestamp() then return false;end if;
 if provider_message_id is null and error_code not in ('DELIVERY_FAILED','PROVIDER_REJECTED','RATE_LIMIT','TIMEOUT','AMBIGUOUS') then raise exception using errcode='22023',message='Invalid delivery result';end if;
 update public.notifications set status=case when provider_message_id is not null then 'SENT' when permanent or attempts>=5 then 'DEAD' else 'FAILED' end,
  provider_id=provider_message_id,last_error_code=case when provider_message_id is null then error_code end,lease_token=null,locked_until=null,available_at=now()+make_interval(secs=>least(3600,60*attempts)) where id=n.id;
 return true;
end;
$$;
create function public.read_notification(notification_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare n public.notifications;
begin
 select * into strict n from public.notifications where id=notification_id and recipient_profile_id=auth.uid() and channel='IN_APP';
 perform app_private.require_permission(n.required_permission);
 update public.notifications set read_at=coalesce(read_at,clock_timestamp()) where id=n.id;
end;
$$;
create function public.retry_notification(input jsonb,idempotency_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; n public.notifications; entity uuid;
begin
 perform app_private.require_permission('settings.manage');
 result:=app_private.begin_operation('retry_notification',idempotency_key,input);if result is not null then return result;end if;
 if coalesce(length(btrim(input->>'reason')),0) not between 5 and 1000 then raise exception using errcode='22023',message='Reason required';end if;
 if input->>'kind'='EMAIL' then
  select * into strict n from public.notifications where id=(input->>'id')::uuid and channel='EMAIL' for update;
  if n.status not in ('FAILED','DEAD') or(n.locked_until is not null and n.locked_until>now()) or n.first_attempt_at<now()-interval '23 hours' then raise exception using errcode='23514',message='Delivery requires reconciliation or is not retryable';end if;
  update public.notifications set status='PENDING',attempts=0,available_at=now(),last_error_code=null,lease_token=null,locked_until=null where id=n.id returning id into entity;
 elsif input->>'kind'='OUTBOX' then
  update public.outbox_events set status='PENDING',attempts=0,available_at=now(),last_error_code=null,locked_until=null where id=(input->>'id')::uuid and status='DEAD' returning id into entity;
 else raise exception using errcode='22023',message='Invalid job kind';end if;
 if entity is null then raise exception using errcode='23514',message='Job is not retryable';end if;
 insert into public.audit_logs(actor_id,action,domain,entity_type,entity_id,safe_changes) values(auth.uid(),'RETRY','ACCESS','notification_job',entity,jsonb_build_object('operation','retry'));
 return app_private.finish_operation('retry_notification',idempotency_key,jsonb_build_object('id',entity));
end;
$$;
create function public.notification_job_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.require_permission('settings.manage');
 return jsonb_build_object('outbox',(select coalesce(jsonb_agg(x),'[]') from(select id,event_type,status,attempts,last_error_code,created_at from public.outbox_events where status<>'COMPLETED' order by created_at,id limit 100)x),
  'email',(select coalesce(jsonb_agg(x),'[]') from(select id,status,attempts,last_error_code,provider_id,first_attempt_at,created_at from public.notifications where channel='EMAIL' order by created_at desc,id limit 100)x));
end;
$$;
revoke all on function public.notification_setup(jsonb,text),public.dispatch_notification_events(integer),public.claim_email_notifications(integer,text),public.finish_email_notification(uuid,uuid,text,text,boolean),public.read_notification(uuid),public.retry_notification(jsonb,text),public.notification_job_status() from public,anon,authenticated,service_role;
grant execute on function public.notification_setup(jsonb,text),public.read_notification(uuid),public.retry_notification(jsonb,text),public.notification_job_status() to authenticated;
grant execute on function public.dispatch_notification_events(integer),public.claim_email_notifications(integer,text),public.finish_email_notification(uuid,uuid,text,text,boolean) to service_role;
revoke execute on all functions in schema app_private from public;
