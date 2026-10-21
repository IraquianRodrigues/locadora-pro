-- Fase 8: ledger append-only, valores BRL e transações serializadas.
alter table public.charges add column competence_at timestamptz check(competence_at is null or isfinite(competence_at));
alter table public.expenses add column payment_method_id uuid references public.payment_methods(id);
alter table public.refunds add column payment_method_id uuid references public.payment_methods(id);
alter table public.deposits add column reason text check(reason is null or length(btrim(reason)) between 5 and 1000);
create index on public.expenses(payment_method_id);
create index on public.refunds(payment_method_id);
create index charge_competence on public.charges((coalesce(competence_at,due_at)),id);
create table public.charge_adjustments (
 id uuid primary key default gen_random_uuid(),charge_id uuid not null references public.charges(id),
 kind text not null check(kind in ('DISCOUNT','CANCEL','CORRECTION')),amount numeric(12,2) not null check(amount>0 and amount<'Infinity'::numeric),
 reason text not null check(length(btrim(reason)) between 5 and 1000),actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.deposit_application_reversals (
 id uuid primary key default gen_random_uuid(),application_id uuid not null references public.deposits(id),
 amount numeric(12,2) not null check(amount>0 and amount<'Infinity'::numeric),
 reason text not null check(length(btrim(reason)) between 5 and 1000),actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.expense_reversals (
 id uuid primary key default gen_random_uuid(),expense_id uuid not null references public.expenses(id),
 amount numeric(12,2) not null check(amount>0 and amount<'Infinity'::numeric),
 reason text not null check(length(btrim(reason)) between 5 and 1000),actor_id uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
do $$ declare t text; begin
 foreach t in array array['charge_adjustments','deposit_application_reversals','expense_reversals'] loop
  perform app_private.secure_table(t,'finance.read');
  execute format('create trigger immutable_ledger before update or delete on public.%I for each row execute function app_private.reject_mutation()',t);
  execute format('create trigger audit_change after insert on public.%I for each row execute function app_private.record_audit(''FINANCE'')',t);
  execute format('create index on public.%I(actor_id)',t);
 end loop;
end $$;
create index on public.charge_adjustments(charge_id);
create index on public.deposit_application_reversals(application_id);
create index on public.expense_reversals(expense_id);

create function app_private.charge_balance(entity uuid) returns numeric language sql stable set search_path='' as $$
 select case when exists(select 1 from public.rental_charge_cancellations x where x.charge_id=c.id) then 0::numeric else
 c.amount-coalesce((select sum(amount) from public.charge_adjustments where charge_id=c.id),0)
 -coalesce((select sum(amount) from public.payment_allocations where charge_id=c.id),0)
 +coalesce((select sum(f.amount) from public.refunds f join public.payment_allocations a on a.id=f.payment_allocation_id where a.charge_id=c.id),0)
 -coalesce((select sum(amount) from public.deposits where applied_charge_id=c.id),0)
 +coalesce((select sum(x.amount) from public.deposit_application_reversals x join public.deposits d on d.id=x.application_id where d.applied_charge_id=c.id),0) end
 from public.charges c where c.id=entity;
$$;
create function app_private.deposit_balance(entity uuid) returns numeric language sql stable set search_path='' as $$
 select d.amount-coalesce((select sum(amount) from public.deposits where original_deposit_id=d.id),0)
 +coalesce((select sum(x.amount) from public.deposit_application_reversals x join public.deposits a on a.id=x.application_id where a.original_deposit_id=d.id),0)
 -coalesce((select sum(amount) from public.refunds where deposit_id=d.id),0) from public.deposits d where d.id=entity and d.kind='RECEIVED';
$$;
create function app_private.payment_free(entity uuid) returns numeric language sql stable set search_path='' as $$
 select p.amount-coalesce((select sum(amount) from public.payment_allocations where payment_id=p.id),0)
 -coalesce((select sum(amount) from public.refunds where payment_id=p.id and payment_allocation_id is null),0) from public.payments p where p.id=entity;
$$;
create or replace function app_private.rental_due(entity uuid) returns numeric language sql stable set search_path='' as $$
 select coalesce(sum(app_private.charge_balance(id)),0) from public.charges where rental_id=entity;
$$;
create function app_private.visible_charge_balance(entity uuid) returns numeric language plpgsql stable security definer set search_path='' as $$
begin perform app_private.require_permission('finance.read');return app_private.charge_balance(entity);end;
$$;
revoke all on function app_private.visible_charge_balance(uuid) from public,anon,authenticated,service_role;
grant execute on function app_private.visible_charge_balance(uuid) to authenticated;
create or replace view public.finance_charge_balances with(security_barrier=true) as
 select c.id,c.customer_id,c.rental_id,c.due_at,c.amount,app_private.visible_charge_balance(c.id) balance from public.charges c where app_private.has_permission('finance.read');

-- Todas as entradas, inclusive RPCs antigas, respeitam os créditos/estornos novos.
create or replace function app_private.guard_financial_insert() returns trigger
language plpgsql security definer set search_path='' as $$
declare data jsonb:=to_jsonb(new); payment public.payments; deposit public.deposits; application public.deposits; charge public.charges; amount_used numeric;
begin
 perform pg_advisory_xact_lock(187640,2);
 if tg_table_name='payment_allocations' then
  if new.amount>app_private.payment_free(new.payment_id) then raise exception using errcode='23514',message='Payment balance exceeded'; end if;
  if new.amount>app_private.charge_balance(new.charge_id) then raise exception using errcode='23514',message='Charge balance exceeded'; end if;
 elsif tg_table_name='refunds' then
  if data->>'payment_id' is not null then
   select * into strict payment from public.payments where id=new.payment_id;
   select coalesce(sum(amount),0) into amount_used from public.refunds where payment_id=payment.id;
   if amount_used+new.amount>payment.amount then raise exception using errcode='23514',message='Refund exceeds payment'; end if;
   if new.payment_allocation_id is null then
    if new.amount>app_private.payment_free(payment.id) then raise exception using errcode='23514',message='Unallocated balance exceeded'; end if;
   else
    if new.amount>(select a.amount-coalesce((select sum(f.amount) from public.refunds f where f.payment_allocation_id=a.id),0) from public.payment_allocations a where a.id=new.payment_allocation_id and a.payment_id=payment.id) then raise exception using errcode='23514',message='Refund exceeds allocation'; end if;
   end if;
  else
   if coalesce(app_private.deposit_balance(new.deposit_id),-1)<new.amount then raise exception using errcode='23514',message='Deposit balance exceeded'; end if;
  end if;
 elsif tg_table_name='deposits' then
  if new.kind='APPLIED' then
   select * into strict deposit from public.deposits where id=new.original_deposit_id and kind='RECEIVED';
   select * into strict charge from public.charges where id=new.applied_charge_id;
   if new.rental_id<>deposit.rental_id or charge.rental_id is distinct from new.rental_id then raise exception using errcode='23514',message='Deposit rental mismatch'; end if;
   if new.amount>app_private.deposit_balance(deposit.id) then raise exception using errcode='23514',message='Deposit balance exceeded'; end if;
   if new.amount>app_private.charge_balance(charge.id) then raise exception using errcode='23514',message='Charge balance exceeded'; end if;
  end if;
 elsif tg_table_name='charge_adjustments' then
  if new.amount>app_private.charge_balance(new.charge_id) then raise exception using errcode='23514',message='Credit exceeds outstanding balance'; end if;
 elsif tg_table_name='deposit_application_reversals' then
  select * into strict application from public.deposits where id=new.application_id and kind='APPLIED';
  select coalesce(sum(amount),0) into amount_used from public.deposit_application_reversals where application_id=application.id;
  if new.amount+amount_used>application.amount then raise exception using errcode='23514',message='Reversal exceeds deposit application'; end if;
 elsif tg_table_name='expense_reversals' then
  if new.amount>(select e.amount-coalesce((select sum(amount) from public.expense_reversals where expense_id=e.id),0) from public.expenses e where e.id=new.expense_id) then raise exception using errcode='23514',message='Reversal exceeds expense'; end if;
 end if; return new;
end;
$$;
create trigger validate_balance before insert on public.charge_adjustments for each row execute function app_private.guard_financial_insert();
create trigger validate_balance before insert on public.deposit_application_reversals for each row execute function app_private.guard_financial_insert();
create trigger validate_balance before insert on public.expense_reversals for each row execute function app_private.guard_financial_insert();

create function public.finance_command(input jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare action text:=input->>'action'; result jsonb; entity uuid; v_amount numeric; line jsonb; charge public.charges; deposit public.deposits;
 config jsonb; bps integer; credited numeric; key_hash text; description text:=btrim(input->>'description'); reason text:=btrim(input->>'reason');
begin
 perform app_private.require_permission('finance.read');
 perform app_private.require_permission(case action when 'CHARGE' then 'charges.create' when 'PAYMENT' then 'payments.confirm' when 'ALLOCATE' then 'payments.confirm'
  when 'DEPOSIT_RECEIVE' then 'deposits.manage' when 'DEPOSIT_APPLY' then 'deposits.manage' when 'DEPOSIT_UNAPPLY' then 'deposits.manage'
  when 'REFUND' then 'refunds.create' when 'ADJUST' then 'charges.create' when 'EXPENSE' then 'expenses.write' when 'EXPENSE_REVERSE' then 'expenses.write' else 'invalid' end);
 result:=app_private.begin_operation('finance_command',idempotency_key,input); if result is not null then return result; end if;
 if coalesce(input->>'amount','') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' or (input->>'amount')::numeric<=0 or (input->>'amount')::numeric>9999999999.99 then raise exception using errcode='22023',message='Positive BRL amount required'; end if;
 v_amount:=(input->>'amount')::numeric;
 -- Ordem global: locações envolvidas em UUID crescente, depois serializador financeiro.
 perform 1 from public.rentals r where r.id=(input->>'rental_id')::uuid
  or r.id in(select c.rental_id from public.charges c where c.id=(input->>'charge_id')::uuid
   or c.id in(select (x->>'charge_id')::uuid from jsonb_array_elements(coalesce(input->'allocations','[]'::jsonb)) x))
  or r.id in(select d.rental_id from public.deposits d where d.id=(input->>'deposit_id')::uuid or d.id=(input->>'application_id')::uuid)
  order by r.id for update;
 perform pg_advisory_xact_lock(187640,2);
 if action in ('PAYMENT','DEPOSIT_RECEIVE','REFUND','EXPENSE') then
  perform 1 from public.payment_methods where id=(input->>'payment_method_id')::uuid and active for share;
  if not found then raise exception using errcode='23514',message='Active payment method required'; end if;
 end if;
 if action in ('REFUND','ADJUST','DEPOSIT_APPLY','DEPOSIT_UNAPPLY','EXPENSE_REVERSE') and coalesce(length(reason),0) not between 5 and 1000 then raise exception using errcode='22023',message='Reason required'; end if;
 if action='CHARGE' then
  if coalesce(length(description),0) not between 5 and 1000 or input->>'kind' not in ('MANUAL','FINE') then raise exception using errcode='22023',message='Charge description and kind required'; end if;
  if input->>'rental_id' is not null and not exists(select 1 from public.rentals where id=(input->>'rental_id')::uuid and customer_id=(input->>'customer_id')::uuid and status<>'CANCELLED') then raise exception using errcode='23514',message='Rental/customer mismatch or cancelled'; end if;
  insert into public.charges(customer_id,rental_id,kind,amount,due_at,competence_at,description)
   values((input->>'customer_id')::uuid,(input->>'rental_id')::uuid,input->>'kind',v_amount,(input->>'due_at')::timestamptz,(input->>'competence_at')::timestamptz,description) returning id into entity;
 elsif action='PAYMENT' then
  if input->>'received' is distinct from 'true' or jsonb_typeof(input->'allocations') is distinct from 'array' or jsonb_array_length(input->'allocations')>50 then raise exception using errcode='22023',message='Explicit receipt and allocations required'; end if;
  key_hash:=encode(sha256(convert_to(auth.uid()::text||':finance-payment:'||idempotency_key,'UTF8')),'hex');
  insert into public.payments(customer_id,payment_method_id,amount,status,confirmed_by,confirmed_at,idempotency_key)
   values((input->>'customer_id')::uuid,(input->>'payment_method_id')::uuid,v_amount,'CONFIRMED',auth.uid(),clock_timestamp(),key_hash) returning id into entity;
  for line in select * from jsonb_array_elements(input->'allocations') loop
   if coalesce(line->>'amount','') !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' then raise exception using errcode='22023',message='Invalid allocation amount'; end if;
   insert into public.payment_allocations(payment_id,charge_id,customer_id,amount) values(entity,(line->>'charge_id')::uuid,(input->>'customer_id')::uuid,(line->>'amount')::numeric);
  end loop;
 elsif action='ALLOCATE' then
  insert into public.payment_allocations(payment_id,charge_id,customer_id,amount)
   select p.id,(input->>'charge_id')::uuid,p.customer_id,v_amount from public.payments p where p.id=(input->>'payment_id')::uuid returning id into entity;
 elsif action='DEPOSIT_RECEIVE' then
  if input->>'received' is distinct from 'true' then raise exception using errcode='22023',message='Explicit deposit receipt required'; end if;
  perform 1 from public.rentals where id=(input->>'rental_id')::uuid and status in ('PREPARING','ACTIVE','OVERDUE');
  if not found then raise exception using errcode='23514',message='Rental not open'; end if;
  insert into public.deposits(rental_id,payment_method_id,amount,kind,confirmed_by)
   values((input->>'rental_id')::uuid,(input->>'payment_method_id')::uuid,v_amount,'RECEIVED',auth.uid()) returning id into entity;
 elsif action='DEPOSIT_APPLY' then
  select * into strict deposit from public.deposits where id=(input->>'deposit_id')::uuid and kind='RECEIVED';
  insert into public.deposits(rental_id,original_deposit_id,applied_charge_id,amount,kind,confirmed_by,reason)
   values(deposit.rental_id,deposit.id,(input->>'charge_id')::uuid,v_amount,'APPLIED',auth.uid(),reason) returning id into entity;
 elsif action='DEPOSIT_UNAPPLY' then
  insert into public.deposit_application_reversals(application_id,amount,reason,actor_id) values((input->>'application_id')::uuid,v_amount,reason,auth.uid()) returning id into entity;
 elsif action='REFUND' then
  if input->>'paid_out' is distinct from 'true' then raise exception using errcode='22023',message='Explicit refund disbursement required'; end if;
  insert into public.refunds(payment_id,deposit_id,payment_allocation_id,amount,reason,confirmed_by,payment_method_id)
   values((input->>'payment_id')::uuid,(input->>'deposit_id')::uuid,(input->>'allocation_id')::uuid,v_amount,reason,auth.uid(),(input->>'payment_method_id')::uuid) returning id into entity;
 elsif action='ADJUST' then
  if input->>'kind' not in ('DISCOUNT','CANCEL','CORRECTION') then raise exception using errcode='22023',message='Invalid adjustment'; end if;
  select * into strict charge from public.charges where id=(input->>'charge_id')::uuid;
  if input->>'kind'='DISCOUNT' then
   perform app_private.require_permission('discounts.authorize');
   select value into config from public.system_settings where key='finance_policy' for share;
   select coalesce(max(case r.code when 'ADMIN' then (config->>'admin_discount_bps')::integer when 'MANAGER' then (config->>'manager_discount_bps')::integer else 0 end),0)
    into bps from public.user_roles u join public.roles r on r.id=u.role_id where u.user_id=auth.uid();
   select coalesce(sum(a.amount),0) into credited from public.charge_adjustments a where a.charge_id=charge.id and a.kind='DISCOUNT';
   if config is null or bps is null or bps not between 0 and 10000 or (credited+v_amount)*10000>charge.amount*bps then raise exception using errcode='23514',message='Discount exceeds configured role limit'; end if;
  else perform app_private.require_permission('refunds.create'); end if;
  insert into public.charge_adjustments(charge_id,kind,amount,reason,actor_id) values(charge.id,input->>'kind',v_amount,reason,auth.uid()) returning id into entity;
 elsif action='EXPENSE' then
  if input->>'paid' is distinct from 'true' or coalesce(length(description),0) not between 5 and 1000
   or (input->>'occurred_at')::timestamptz>clock_timestamp() then raise exception using errcode='22023',message='Explicit paid expense, date and description required'; end if;
  insert into public.expenses(vehicle_id,maintenance_record_id,amount,occurred_at,description,payment_method_id)
   values((input->>'vehicle_id')::uuid,(input->>'maintenance_id')::uuid,v_amount,(input->>'occurred_at')::timestamptz,description,(input->>'payment_method_id')::uuid) returning id into entity;
 elsif action='EXPENSE_REVERSE' then
  if input->>'confirmed' is distinct from 'true' then raise exception using errcode='22023',message='Explicit reversal confirmation required'; end if;
  insert into public.expense_reversals(expense_id,amount,reason,actor_id) values((input->>'expense_id')::uuid,v_amount,reason,auth.uid()) returning id into entity;
 end if;
 if entity is null then raise exception using errcode='P0002',message='Financial record not found'; end if;
 insert into public.outbox_events(event_type,payload,deduplication_key) values('finance.'||lower(action),jsonb_build_object('entity_id',entity),'finance:'||action||':'||entity);
 return app_private.finish_operation('finance_command',idempotency_key,jsonb_build_object('id',entity));
end;
$$;

create function public.finance_configuration(input jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; entity uuid;
begin
 perform app_private.require_permission('settings.manage');
 result:=app_private.begin_operation('finance_configuration',idempotency_key,input); if result is not null then return result; end if;
 perform pg_advisory_xact_lock(187640,8);
 if input->>'kind'='POLICY' then
  if (input->>'admin_discount_bps')::integer not between 0 and 10000 or (input->>'manager_discount_bps')::integer not between 0 and 10000 then raise exception using errcode='22023',message='Invalid discount policy'; end if;
  if exists(select 1 from public.system_settings where key='finance_policy' and version is distinct from (input->>'expected_version')::integer) then raise exception using errcode='40001',message='Policy changed'; end if;
  insert into public.system_settings(key,value) values('finance_policy',jsonb_build_object('admin_discount_bps',(input->>'admin_discount_bps')::integer,'manager_discount_bps',(input->>'manager_discount_bps')::integer))
   on conflict(key) do update set value=excluded.value,version=public.system_settings.version+1 returning id into entity;
 elsif input->>'kind'='METHOD' then
  if coalesce(length(btrim(input->>'name')),0) not between 1 and 100 or jsonb_typeof(input->'active') is distinct from 'boolean' then raise exception using errcode='22023',message='Invalid payment method'; end if;
  if input->>'id' is null then insert into public.payment_methods(name,active) values(btrim(input->>'name'),(input->>'active')::boolean) returning id into entity;
  else
   update public.payment_methods set name=btrim(input->>'name'),active=(input->>'active')::boolean where id=(input->>'id')::uuid and updated_at=(input->>'expected_updated_at')::timestamptz returning id into entity;
   if not found then raise exception using errcode='40001',message='Method changed'; end if;
  end if;
 else raise exception using errcode='22023',message='Invalid configuration'; end if;
 return app_private.finish_operation('finance_configuration',idempotency_key,jsonb_build_object('id',entity));
end;
$$;
create unique index payment_method_normalized on public.payment_methods(lower(btrim(name)));

create function public.cancel_settled_rental(input jsonb,idempotency_key text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.rentals; result jsonb; net_paid numeric; held numeric;
begin
 perform app_private.require_permission('rentals.create');
 result:=app_private.begin_operation('cancel_settled_rental',idempotency_key,input); if result is not null then return result; end if;
 select * into strict r from public.rentals where id=(input->>'rental_id')::uuid for update;
 if r.status<>'PREPARING' or r.version is distinct from (input->>'expected_version')::integer then raise exception using errcode='40001',message='Rental changed'; end if;
 if coalesce(length(btrim(input->>'reason')),0) not between 5 and 1000 then raise exception using errcode='22023',message='Reason required'; end if;
 perform pg_advisory_xact_lock(187640,2);
 select coalesce(sum(a.amount-coalesce((select sum(f.amount) from public.refunds f where f.payment_allocation_id=a.id),0)),0)
  into net_paid from public.payment_allocations a join public.charges c on c.id=a.charge_id where c.rental_id=r.id;
 select coalesce(sum(case when d.kind='RECEIVED' then app_private.deposit_balance(d.id) else d.amount-coalesce((select sum(x.amount) from public.deposit_application_reversals x where x.application_id=d.id),0) end),0) into held from public.deposits d where d.rental_id=r.id;
 if net_paid<>0 or held<>0 then raise exception using errcode='23514',message='Refund or reverse financial balance before cancellation'; end if;
 insert into public.rental_charge_cancellations(charge_id,rental_id,reason,actor_id) select id,r.id,input->>'reason',auth.uid() from public.charges where rental_id=r.id;
 update public.rentals set status='CANCELLED' where id=r.id returning * into r;
 update public.vehicle_allocations set released_at=clock_timestamp() where rental_id=r.id and released_at is null;
 insert into public.rental_events(rental_id,actor_id,event_type,detail) values(r.id,auth.uid(),'CANCEL',jsonb_build_object('reason',input->>'reason'));
 insert into public.outbox_events(event_type,payload,deduplication_key) values('rental.cancel',jsonb_build_object('rental_id',r.id),'rental:'||r.id||':cancel');
 return app_private.finish_operation('cancel_settled_rental',idempotency_key,jsonb_build_object('id',r.id,'status',r.status,'version',r.version));
end;
$$;

-- Projeções financeiras mínimas: sem CPF, documentos, endereços ou observações operacionais.
create function public.finance_options(search text default '') returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 perform app_private.require_permission('finance.read');
 if search is null or length(search)>100 then raise exception using errcode='22023',message='Invalid option search';end if;
 return jsonb_build_object('customers',(select coalesce(jsonb_agg(x),'[]') from(select id,name from public.customers where position(lower(search) in lower(name||' '||id::text))>0 order by name,id limit 100)x),
 'vehicles',(select coalesce(jsonb_agg(x),'[]') from(select id,make||' '||model||' · '||left(id::text,8) name from public.vehicles where archived_at is null and position(lower(search) in lower(make||' '||model||' '||id::text))>0 order by make,model,id limit 100)x),
 'rentals',(select coalesce(jsonb_agg(x),'[]') from(select r.id,r.customer_id,r.vehicle_id,r.status from public.rentals r join public.customers c on c.id=r.customer_id where position(lower(search) in lower(r.id::text||' '||c.name||' '||r.customer_id::text))>0 order by r.created_at desc,r.id limit 100)x),
 'methods',(select coalesce(jsonb_agg(x),'[]') from(select id,name from public.payment_methods where active order by name,id limit 100)x));
end;
$$;
create function public.finance_register(kind text,page integer default 1,customer uuid default null,rental uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; total bigint;
begin
 perform app_private.require_permission('finance.read');
 if page is null or page not between 1 and 10000 then raise exception using errcode='22023',message='Invalid page'; end if;
 if kind='CHARGES' then
  select count(*) into total from public.charges c where (customer is null or c.customer_id=customer) and (rental is null or c.rental_id=rental);
  select coalesce(jsonb_agg(x),'[]') into rows from(select c.id,c.customer_id,c.rental_id,c.kind,c.description,c.due_at,coalesce(c.competence_at,c.due_at) competence_at,c.amount::text amount,app_private.charge_balance(c.id)::text balance,
   (select name from public.customers where id=c.customer_id) customer_name from public.charges c where(customer is null or c.customer_id=customer) and(rental is null or c.rental_id=rental) order by c.created_at desc,c.id limit 20 offset (page-1)*20)x;
 elsif kind='PAYMENTS' then
  select count(*) into total from public.payments p where(customer is null or p.customer_id=customer) and(rental is null or exists(select 1 from public.payment_allocations a join public.charges c on c.id=a.charge_id where a.payment_id=p.id and c.rental_id=rental));
  select coalesce(jsonb_agg(x),'[]') into rows from(select p.id,p.customer_id,p.amount::text amount,p.confirmed_at,app_private.payment_free(p.id)::text free_amount,
    (select name from public.customers where id=p.customer_id) customer_name,(select name from public.payment_methods where id=p.payment_method_id) method,
    (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'charge_id',a.charge_id,'amount',a.amount::text,'refundable',(a.amount-coalesce((select sum(amount) from public.refunds where payment_allocation_id=a.id),0))::text)),'[]') from public.payment_allocations a where a.payment_id=p.id) allocations
    from public.payments p where(customer is null or p.customer_id=customer) and(rental is null or exists(select 1 from public.payment_allocations a join public.charges c on c.id=a.charge_id where a.payment_id=p.id and c.rental_id=rental)) order by p.confirmed_at desc,p.id limit 20 offset(page-1)*20)x;
 elsif kind='DEPOSITS' then
  select count(*) into total from public.deposits d join public.rentals r on r.id=d.rental_id where d.kind='RECEIVED' and(customer is null or r.customer_id=customer) and(rental is null or d.rental_id=rental);
  select coalesce(jsonb_agg(x),'[]') into rows from(select d.id,d.rental_id,r.customer_id,d.amount::text amount,app_private.deposit_balance(d.id)::text balance,d.created_at,
    (select name from public.customers where id=r.customer_id) customer_name,
    (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'charge_id',a.applied_charge_id,'amount',a.amount::text,'reversible',(a.amount-coalesce((select sum(amount) from public.deposit_application_reversals where application_id=a.id),0))::text)),'[]') from public.deposits a where a.original_deposit_id=d.id) applications
    from public.deposits d join public.rentals r on r.id=d.rental_id where d.kind='RECEIVED' and(customer is null or r.customer_id=customer) and(rental is null or d.rental_id=rental) order by d.created_at desc,d.id limit 20 offset(page-1)*20)x;
 elsif kind='REFUNDS' then
  select count(*) into total from public.refunds f left join public.payments p on p.id=f.payment_id left join public.deposits d on d.id=f.deposit_id left join public.rentals r on r.id=d.rental_id
   where(customer is null or coalesce(p.customer_id,r.customer_id)=customer) and(rental is null or d.rental_id=rental or exists(select 1 from public.payment_allocations a join public.charges c on c.id=a.charge_id where a.payment_id=f.payment_id and c.rental_id=rental));
  select coalesce(jsonb_agg(x),'[]') into rows from(select f.id,f.payment_id,f.deposit_id,f.payment_allocation_id,f.amount::text amount,f.reason,f.created_at from public.refunds f left join public.payments p on p.id=f.payment_id left join public.deposits d on d.id=f.deposit_id left join public.rentals r on r.id=d.rental_id
   where(customer is null or coalesce(p.customer_id,r.customer_id)=customer) and(rental is null or d.rental_id=rental or exists(select 1 from public.payment_allocations a join public.charges c on c.id=a.charge_id where a.payment_id=f.payment_id and c.rental_id=rental)) order by f.created_at desc,f.id limit 20 offset(page-1)*20)x;
 elsif kind='EXPENSES' then
  if customer is not null or rental is not null then raise exception using errcode='22023',message='Expense does not use customer/rental filter'; end if;
  select count(*) into total from public.expenses;
  select coalesce(jsonb_agg(x),'[]') into rows from(select e.id,e.vehicle_id,e.maintenance_record_id,e.amount::text amount,e.occurred_at,e.description,
   (e.amount-coalesce((select sum(amount) from public.expense_reversals where expense_id=e.id),0))::text reversible from public.expenses e order by e.occurred_at desc,e.id limit 20 offset(page-1)*20)x;
 elsif kind='ADJUSTMENTS' then
  select count(*) into total from public.charge_adjustments a join public.charges c on c.id=a.charge_id where(customer is null or c.customer_id=customer) and(rental is null or c.rental_id=rental);
  select coalesce(jsonb_agg(x),'[]') into rows from(select a.id,a.charge_id,a.kind,a.amount::text amount,a.reason,a.created_at from public.charge_adjustments a join public.charges c on c.id=a.charge_id where(customer is null or c.customer_id=customer) and(rental is null or c.rental_id=rental) order by a.created_at desc,a.id limit 20 offset(page-1)*20)x;
 else raise exception using errcode='22023',message='Invalid register'; end if;
 return jsonb_build_object('rows',rows,'total',total,'page',page,'page_size',20);
end;
$$;
revoke all on function public.finance_command(jsonb,text),public.finance_configuration(jsonb,text),public.cancel_settled_rental(jsonb,text),public.finance_options(text),public.finance_register(text,integer,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.finance_command(jsonb,text),public.finance_configuration(jsonb,text),public.cancel_settled_rental(jsonb,text),public.finance_options(text),public.finance_register(text,integer,uuid,uuid) to authenticated;
revoke all on function app_private.charge_balance(uuid),app_private.deposit_balance(uuid),app_private.payment_free(uuid) from public,anon,authenticated,service_role;

-- Retirada considera também os estornos de aplicação de caução. Definição completa preserva o fluxo da Fase 7.
create or replace function public.rental_command(input jsonb,idempotency_key text) returns jsonb
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
  select coalesce(sum(app_private.deposit_balance(id)),0) into remaining from public.deposits where rental_id=r.id and kind='RECEIVED';
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


