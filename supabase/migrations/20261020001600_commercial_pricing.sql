-- Fase 5. Nenhuma tarifa ou regra comercial real é presumida.
alter table public.rate_plans add column archived_at timestamptz;
alter table public.rate_plan_prices add column archived_at timestamptz,
  add column name text not null default '',
  add column valid_from timestamptz generated always as (lower(validity)) stored,
  add column valid_to timestamptz generated always as (upper(validity)) stored;
alter table public.additional_services add column archived_at timestamptz;
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid='public.rate_plan_prices'::regclass and contype='x' loop
    execute format('alter table public.rate_plan_prices drop constraint %I',c.conname);
  end loop;
end $$;
alter table public.rate_plan_prices add constraint category_price_no_overlap exclude using gist
  (rate_plan_id with =,category_id with =,validity with &&) where(category_id is not null and archived_at is null);
alter table public.rate_plan_prices add constraint vehicle_price_no_overlap exclude using gist
  (rate_plan_id with =,vehicle_id with =,validity with &&) where(vehicle_id is not null and archived_at is null);

-- O mesmo lock é usado pela persistência: protege inclusive contra tarifas novas (phantoms).
create function app_private.lock_pricing() returns trigger language plpgsql set search_path='' as $$
begin perform pg_advisory_xact_lock(187640,5); return null; end $$;
create trigger lock_pricing before insert or update or delete on public.rate_plans for each statement execute function app_private.lock_pricing();
create trigger lock_pricing before insert or update or delete on public.rate_plan_prices for each statement execute function app_private.lock_pricing();
create trigger lock_pricing before insert or update or delete on public.additional_services for each statement execute function app_private.lock_pricing();
create function app_private.version_pricing() returns trigger language plpgsql security definer set search_path='' as $$
declare p jsonb; k text; n integer;
begin
  if tg_op='UPDATE' then new.version:=old.version;
    if row(new.policy,new.period_unit,new.month_mode,new.commercial_month_days) is distinct from row(old.policy,old.period_unit,old.month_mode,old.commercial_month_days) then new.version:=old.version+1; end if;
  else new.version:=1; end if;
  p:=new.policy;
  -- Planos legados vazios continuam legíveis; não podem gerar novas cotações.
  if p<>'{}'::jsonb then
    if p->>'engine' is distinct from 'v1' or not exists(select 1 from pg_catalog.pg_timezone_names where name=p->>'timezone')
      or p->>'duration_basis' not in ('ELAPSED','LOCAL_DAYS') or p->>'strategy' not in ('CEIL_PERIOD','DAY_HOUR','WEEK_DAY_HOUR')
      or p->>'rounding' not in ('HALF_UP','CEIL','TRUNCATE') or p->>'discount_scope' not in ('RENTAL','RENTAL_AND_SERVICES')
      or not p ?& array['duration_basis','strategy','rounding','discount_scope','delivery_enabled','collection_enabled'] then
      raise exception using errcode='23514',message='Commercial policy incomplete';
    end if;
    foreach k in array array['minimum_periods','tolerance_minutes','hour_increment_minutes','admin_discount_bps','manager_discount_bps','turnaround_minutes','quote_validity_minutes','request_validity_minutes','lookup_validity_days'] loop
      if coalesce(p->>k,'') !~ '^[0-9]{1,5}$' then raise exception using errcode='23514',message='Invalid commercial integer'; end if;
      n:=(p->>k)::integer;
      if not(case k when 'minimum_periods' then n between 1 and 10000 when 'tolerance_minutes' then n between 0 and 1440
        when 'hour_increment_minutes' then n in (15,30,60) when 'turnaround_minutes' then n between 0 and 1440
        when 'quote_validity_minutes' then n between 5 and 10080 when 'request_validity_minutes' then n between 5 and 43200
        when 'lookup_validity_days' then n between 1 and 365 else n between 0 and 10000 end) then
        raise exception using errcode='23514',message='Commercial integer outside limits'; end if;
    end loop;
    foreach k in array array['deposit_amount','delivery_amount','collection_amount'] loop
      if coalesce(p->>k,'') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' then raise exception using errcode='23514',message='Invalid commercial money'; end if;
    end loop;
    foreach k in array array['delivery_enabled','collection_enabled'] loop
      if jsonb_typeof(p->k) is distinct from 'boolean' then raise exception using errcode='23514',message='Invalid commercial boolean'; end if;
    end loop;
    foreach k in array array['week_amount','day_amount','hour_amount'] loop
      if (p->k is not null and p->k<>'null'::jsonb and coalesce(p->>k,'') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$')
        or (p->>'strategy'<>'CEIL_PERIOD' and k in ('day_amount','hour_amount') and (p->>k is null))
        or (p->>'strategy'='WEEK_DAY_HOUR' and k='week_amount' and (p->>k is null)) then
        raise exception using errcode='23514',message='Missing or invalid remainder price'; end if;
    end loop;
  end if;
  return new;
end $$;
create trigger version_pricing before insert or update on public.rate_plans for each row execute function app_private.version_pricing();
create function app_private.snapshot_pricing_rule() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.version<>old.version then
    insert into public.pricing_rules(rate_plan_id,rule_type,version,parameters)
      values(new.id,'COMMERCIAL_POLICY',new.version,jsonb_build_object('policy',new.policy,'period_unit',new.period_unit,'month_mode',new.month_mode,'commercial_month_days',new.commercial_month_days));
  end if;
  return null;
end $$;
create trigger snapshot_pricing_rule after insert or update on public.rate_plans for each row execute function app_private.snapshot_pricing_rule();
revoke insert,update on public.pricing_rules from authenticated;
create function app_private.validate_price_parent() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.archived_at is not null then return new; end if;
  perform 1 from public.rate_plans where id=new.rate_plan_id and active and archived_at is null for share;
  if not found then raise exception using errcode='23514',message='Inactive plan'; end if;
  if new.category_id is not null then
    perform 1 from public.vehicle_categories where id=new.category_id and active and archived_at is null for share;
  else perform 1 from public.vehicles where id=new.vehicle_id and operational_status='ACTIVE' and archived_at is null for share; end if;
  if not found then raise exception using errcode='23514',message='Inactive pricing target'; end if;
  return new;
end $$;
create trigger validate_price_parent before insert or update on public.rate_plan_prices for each row execute function app_private.validate_price_parent();

-- Cotações contêm endereços de logística. pricing.read isolado não concede acesso a PII.
alter policy staff_read on public.quotes using ((select app_private.has_permission('pricing.read')) and (select app_private.has_permission('reservations.read')));
alter policy staff_read on public.quote_items using ((select app_private.has_permission('pricing.read')) and (select app_private.has_permission('reservations.read')));

create function app_private.pricing_context(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.rate_plans; tariff public.rate_plan_prices; v public.vehicles; cat uuid; s timestamptz; e timestamptz; addons jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock(187640,5);
  s:=(input->>'start_at')::timestamptz; e:=(input->>'end_at')::timestamptz;
  if s is null or e is null or not isfinite(s) or not isfinite(e) or s<=now() or e<=s or e-s>interval '3660 days'
    or num_nonnulls(input->>'category_id',input->>'vehicle_id')<>1 then raise exception using errcode='23514',message='Invalid quote period or target'; end if;
  perform 1 from public.branches where id=(input->>'branch_id')::uuid and active and archived_at is null for share;
  if not found then raise exception using errcode='23514',message='Inactive branch'; end if;
  if input->>'vehicle_id' is not null then
    select * into v from public.vehicles where id=(input->>'vehicle_id')::uuid and branch_id=(input->>'branch_id')::uuid and operational_status='ACTIVE' and archived_at is null for share;
    if not found then raise exception using errcode='23514',message='Inactive vehicle'; end if;
    cat:=v.category_id;
  else cat:=(input->>'category_id')::uuid; end if;
  perform 1 from public.vehicle_categories where id=cat and active and archived_at is null for share;
  if not found then raise exception using errcode='23514',message='Inactive category'; end if;
  select * into p from public.rate_plans where id=(input->>'rate_plan_id')::uuid and active and archived_at is null;
  if p.id is null or p.policy->>'engine' is distinct from 'v1' then raise exception using errcode='23514',message='Configure commercial policy before quoting'; end if;
  -- Uma exceção por veículo parcialmente vigente impede fallback silencioso para categoria.
  if v.id is not null and exists(select 1 from public.rate_plan_prices x where x.rate_plan_id=p.id and x.vehicle_id=v.id and x.archived_at is null and x.validity && tstzrange(s,e,'[)')) then
    select * into tariff from public.rate_plan_prices x where x.rate_plan_id=p.id and x.vehicle_id=v.id and x.archived_at is null and x.validity @> tstzrange(s,e,'[)');
  else
    select * into tariff from public.rate_plan_prices x where x.rate_plan_id=p.id and x.category_id=cat and x.archived_at is null and x.validity @> tstzrange(s,e,'[)');
  end if;
  if tariff.id is null then raise exception using errcode='23514',message='No single price covers the complete period'; end if;
  if jsonb_typeof(input->'additional_services') is distinct from 'array' or jsonb_array_length(input->'additional_services')>20 then raise exception using errcode='23514',message='Invalid services'; end if;
  if exists(select 1 from jsonb_array_elements(input->'additional_services') x left join public.additional_services a on a.id=(x->>'id')::uuid where a.id is null or not a.active or a.archived_at is not null) then raise exception using errcode='23514',message='Inactive service'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'unit',a.unit,'amount',a.amount::text) order by a.id),'[]'::jsonb) into addons
    from public.additional_services a where a.id in(select (x->>'id')::uuid from jsonb_array_elements(input->'additional_services') x);
  result:=jsonb_build_object('revision',p.version,'plan',jsonb_build_object('id',p.id,'name',p.name,'version',p.version,'period_unit',p.period_unit,'month_mode',p.month_mode,'commercial_month_days',p.commercial_month_days,'policy',p.policy),
    'price',jsonb_build_object('id',tariff.id,'amount',tariff.amount::text,'scope',case when tariff.vehicle_id is not null then 'VEHICLE' else 'CATEGORY' end),'addons',addons);
  return result||jsonb_build_object('fingerprint',encode(sha256(convert_to(result::text,'UTF8')),'hex'));
end $$;
create function public.staff_pricing_context(input jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform app_private.require_permission('pricing.read'); perform app_private.require_permission('reservations.read');
  return app_private.pricing_context(input);
end $$;
revoke all on function public.staff_pricing_context(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.staff_pricing_context(jsonb) to authenticated;

-- Valores calculados somente pelo backend autenticado; não há RPC de escrita de totais para o navegador.
create function public.persist_staff_quote(actor_id uuid, session_id uuid, input jsonb, expected_fingerprint text, calculation jsonb, idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare context jsonb; result jsonb; qid uuid; line jsonb; cust uuid; discount numeric; discount_base numeric; discount_limit integer;
begin
  if not exists(select 1 from auth.sessions s where s.id=session_id and s.user_id=actor_id and (s.not_after is null or s.not_after>now())) then raise exception using errcode='42501',message='Inactive session'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated','session_id',session_id)::text,true);
  perform set_config('request.jwt.claim.sub',actor_id::text,true);
  perform app_private.require_permission('pricing.read'); perform app_private.require_permission('reservations.request');
  result:=app_private.begin_operation('staff_quote',idempotency_key,input);
  if result is not null then return result; end if;
  context:=app_private.pricing_context(input);
  if context->>'fingerprint' is distinct from expected_fingerprint then raise exception using errcode='40001',message='Pricing changed; requote'; end if;
  cust:=(input->>'customer_id')::uuid;
  if cust is not null then
    perform 1 from public.customers where id=cust and archived_at is null for share;
    if not found then raise exception using errcode='23514',message='Inactive customer'; end if;
  end if;
  if calculation->>'engine' is distinct from 'v1' or jsonb_typeof(calculation->'lines') is distinct from 'array' or jsonb_array_length(calculation->'lines') not between 1 and 40
    or calculation->>'deposit' is distinct from context->'plan'->'policy'->>'deposit_amount' then raise exception using errcode='23514',message='Invalid trusted calculation'; end if;
  discount:=(input->>'discount_amount')::numeric;
  if discount>0 then
    perform app_private.require_permission('discounts.authorize');
    select coalesce(max(case r.code when 'ADMIN' then (context->'plan'->'policy'->>'admin_discount_bps')::integer when 'MANAGER' then (context->'plan'->'policy'->>'manager_discount_bps')::integer else 0 end),0)
      into discount_limit from public.user_roles u join public.roles r on r.id=u.role_id where u.user_id=actor_id;
    select coalesce(sum((x->>'total')::numeric),0) into discount_base from jsonb_array_elements(calculation->'lines') x
      where x->>'kind'='RENTAL' or (context->'plan'->'policy'->>'discount_scope'='RENTAL_AND_SERVICES' and x->>'kind'='SERVICE');
    if discount*10000>discount_base*discount_limit or coalesce(length(btrim(input->>'discount_reason')),0) not between 5 and 500 then raise exception using errcode='23514',message='Discount above role limit'; end if;
  end if;
  if discount is distinct from (select coalesce(sum((x->>'total')::numeric),0) from jsonb_array_elements(calculation->'lines') x where x->>'kind'='DISCOUNT') then raise exception using errcode='23514',message='Discount mismatch'; end if;
  insert into public.quotes(customer_id,rate_plan_id,start_at,end_at,expires_at,total,deposit,rules_snapshot)
    values(cust,(input->>'rate_plan_id')::uuid,(input->>'start_at')::timestamptz,(input->>'end_at')::timestamptz,
      now()+make_interval(mins=>(context->'plan'->'policy'->>'quote_validity_minutes')::integer),(calculation->>'total')::numeric,(calculation->>'deposit')::numeric,
      jsonb_build_object('engine','v1','input',input,'catalog',context,'policy',context->'plan'->'policy','calculation',calculation,'actor_id',actor_id)) returning id into qid;
  for line in select * from jsonb_array_elements(calculation->'lines') loop
    if line->>'kind' not in ('RENTAL','SERVICE','DELIVERY','COLLECTION','DISCOUNT') then raise exception using errcode='23514',message='Invalid line kind'; end if;
    insert into public.quote_items(quote_id,additional_service_id,kind,description,quantity,unit_amount,total,snapshot)
      values(qid,(line->>'additional_service_id')::uuid,line->>'kind',line->>'description',(line->>'quantity')::numeric,(line->>'unit_amount')::numeric,(line->>'total')::numeric,coalesce(line->'snapshot','{}'::jsonb));
  end loop;
  update public.quotes set locked_at=clock_timestamp() where id=qid;
  return app_private.finish_operation('staff_quote',idempotency_key,jsonb_build_object('id',qid));
end $$;
revoke all on function public.persist_staff_quote(uuid,uuid,jsonb,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.persist_staff_quote(uuid,uuid,jsonb,text,jsonb,text) to service_role;
revoke all on function app_private.lock_pricing(),app_private.version_pricing(),app_private.snapshot_pricing_rule(),app_private.validate_price_parent(),app_private.pricing_context(jsonb) from public,anon,authenticated,service_role;
