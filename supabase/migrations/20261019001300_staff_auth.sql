-- Não altera as migrations anteriores. Sessões revogadas perdem acesso também por RLS.
create function app_private.session_is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions s where s.user_id=(select auth.uid())
    and s.id::text=(select auth.jwt()->>'session_id')
    and (s.not_after is null or s.not_after > now()));
$$;
revoke all on function app_private.session_is_active() from public,anon,authenticated,service_role;

create or replace function app_private.has_permission(permission_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app_private.session_is_active() and exists (
    select 1 from public.profiles p join public.user_roles ur on ur.user_id=p.id
    join public.role_permissions rp on rp.role_id=ur.role_id
    join public.permissions perm on perm.id=rp.permission_id
    where p.id=(select auth.uid()) and p.active and perm.code=permission_code
  );
$$;

-- As duas policies próprias também precisam exigir sessão válida.
alter policy profile_read on public.profiles using (
  (id=(select auth.uid()) and active and (select app_private.session_is_active()))
  or (select app_private.has_permission('users.manage'))
);
alter policy own_notification on public.notifications using (
  recipient_profile_id=(select auth.uid()) and (select app_private.session_is_active())
  and exists(select 1 from public.profiles where id=(select auth.uid()) and active)
);
grant execute on function app_private.session_is_active() to authenticated;

-- Só retorna o próprio contexto, nunca aceita identidade/cargo vindos do cliente.
create function public.staff_context() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id',p.id,'displayName',p.display_name,
    'sessionId',auth.jwt()->>'session_id',
    'roles',(select jsonb_agg(distinct r.code) from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=p.id),
    'permissions',(select jsonb_agg(distinct perm.code) from public.user_roles ur
      join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions perm on perm.id=rp.permission_id where ur.user_id=p.id))
  from public.profiles p where p.id=(select auth.uid()) and p.active
    and app_private.session_is_active() and exists(select 1 from public.user_roles where user_id=p.id);
$$;
revoke all on function public.staff_context() from public,anon,authenticated,service_role;
grant execute on function public.staff_context() to authenticated;

-- Atualização atômica de contador; sem e-mail/IP/token em claro. Somente o servidor.
create function public.consume_auth_limit(key_hash text, max_attempts integer, window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare attempts integer; ts timestamptz := clock_timestamp();
begin
  if key_hash !~ '^[a-f0-9]{64}$' or max_attempts not between 1 and 1000
    or window_seconds not between 1 and 86400 then
    raise exception using errcode='22023',message='Invalid limit';
  end if;
  insert into public.rate_limit_buckets(scope_key_hash,window_start,count,expires_at)
    values(key_hash,ts,1,ts+make_interval(secs=>window_seconds))
  on conflict(scope_key_hash) do update set
    count=case when rate_limit_buckets.expires_at<=ts then 1 else least(rate_limit_buckets.count+1,1000000) end,
    window_start=case when rate_limit_buckets.expires_at<=ts then ts else rate_limit_buckets.window_start end,
    expires_at=case when rate_limit_buckets.expires_at<=ts then ts+make_interval(secs=>window_seconds) else rate_limit_buckets.expires_at end
  returning count into attempts;
  return attempts<=max_attempts;
end;
$$;
revoke all on function public.consume_auth_limit(text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.consume_auth_limit(text,integer,integer) to service_role;

create function public.record_auth_event(event_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if event_code not in ('LOGIN','LOGOUT','PASSWORD_RECOVERY','PASSWORD_UPDATED')
    or not app_private.session_is_active()
    or not exists(select 1 from public.profiles where id=auth.uid() and active) then
    raise exception using errcode='42501',message='Access denied';
  end if;
  insert into public.audit_logs(actor_id,action,domain,entity_type,entity_id,safe_changes)
    values(auth.uid(),event_code,'ACCESS','profiles',auth.uid(),'{}');
end;
$$;
revoke all on function public.record_auth_event(text) from public,anon,authenticated,service_role;
grant execute on function public.record_auth_event(text) to authenticated;
