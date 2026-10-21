create table public.notification_templates (
  id uuid primary key default gen_random_uuid(), template_key text not null, version integer not null check(version > 0),
  channel text not null check(channel in ('EMAIL','IN_APP')), body text not null, unique(template_key,version,channel),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('notification_templates','settings.manage','settings.manage');
create table public.outbox_events (
  id uuid primary key default gen_random_uuid(), event_type text not null, payload jsonb not null check(jsonb_typeof(payload)='object'),
  status text not null default 'PENDING' check(status in ('PENDING','PROCESSING','COMPLETED','DEAD')),
  attempts integer not null default 0 check(attempts >= 0), available_at timestamptz not null default now(), locked_until timestamptz,
  deduplication_key text not null unique, last_error_code text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.outbox_events(status,available_at) where status in ('PENDING','PROCESSING');
select app_private.secure_table('outbox_events',null);
create table public.notifications (
  id uuid primary key default gen_random_uuid(), template_id uuid references public.notification_templates(id), outbox_event_id uuid references public.outbox_events(id),
  recipient_profile_id uuid references public.profiles(id), resource_id uuid, channel text not null check(channel in ('EMAIL','IN_APP')),
  status text not null default 'PENDING' check(status in ('PENDING','SENT','FAILED')), attempts integer not null default 0 check(attempts >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.notifications(recipient_profile_id,created_at);
select app_private.secure_table('notifications',null);
grant select on public.notifications to authenticated;
create policy own_notification on public.notifications for select to authenticated using (
  recipient_profile_id=(select auth.uid()) and exists(select 1 from public.profiles where id=(select auth.uid()) and active)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id),
  action text not null, domain text not null check(domain in ('OPERATIONS','FINANCE','ACCESS')),
  entity_type text not null, entity_id uuid not null, correlation_id uuid not null default gen_random_uuid(),
  safe_changes jsonb not null check(jsonb_typeof(safe_changes)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.audit_logs(domain,created_at);
create index on public.audit_logs(entity_type,entity_id,created_at);
select app_private.secure_table('audit_logs',null);
grant select on public.audit_logs to authenticated;
create policy audit_domain on public.audit_logs for select to authenticated using (
  (domain='OPERATIONS' and (select app_private.has_permission('audit.operations')))
  or (domain='FINANCE' and (select app_private.has_permission('audit.finance')))
  or (domain='ACCESS' and (select app_private.has_permission('users.manage')))
);
create trigger immutable_audit before update or delete on public.audit_logs for each row execute function app_private.reject_mutation();
create table public.idempotency_keys (
  id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), operation text not null,
  key text not null check(length(key) between 16 and 200), request_hash text not null check(request_hash ~ '^[a-f0-9]{32,64}$'),
  safe_response jsonb, expires_at timestamptz not null check(isfinite(expires_at)),
  unique nulls not distinct(actor_id,operation,key),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('idempotency_keys',null);
create index on public.idempotency_keys(expires_at);
create table public.rate_limit_buckets (
  id uuid primary key default gen_random_uuid(), scope_key_hash text not null unique check(scope_key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null, count integer not null check(count >= 0), expires_at timestamptz not null check(expires_at > window_start),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
select app_private.secure_table('rate_limit_buckets',null);

create function app_private.record_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare data jsonb := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_logs(actor_id,action,domain,entity_type,entity_id,safe_changes)
  values(auth.uid(),tg_op,tg_argv[0],tg_table_name,(data->>'id')::uuid,jsonb_build_object('operation',tg_op));
  return null;
end;
$$;
do $$ declare t text; d text; begin
  for t in select c.relname from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r'
  and exists(select 1 from pg_catalog.pg_trigger g where g.tgrelid=c.oid and g.tgname='touch_updated_at') and c.relname not in (
    'audit_logs','outbox_events','notifications','idempotency_keys','rate_limit_buckets'
  ) loop
    d := case when t in ('charges','payments','payment_allocations','deposits','refunds','expenses','payment_methods') then 'FINANCE'
      when t in ('profiles','roles','permissions','user_roles','role_permissions','company_settings','system_settings') then 'ACCESS' else 'OPERATIONS' end;
    execute format('create trigger record_audit after insert or update or delete on public.%I for each row execute function app_private.record_audit(%L)',t,d);
  end loop;
end $$;

create function app_private.reservation_history() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.reservation_status_history(reservation_id,from_status,to_status,actor_id,reason)
    values(new.id,case when tg_op='UPDATE' then old.status end,new.status,auth.uid(),nullif(current_setting('app.reservation_reason',true),''));
  end if;
  return null;
end;
$$;
create trigger status_history after insert or update on public.reservations for each row execute function app_private.reservation_history();
revoke execute on all functions in schema app_private from public;
