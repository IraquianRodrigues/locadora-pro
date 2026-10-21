-- Índices alinhados às consultas reais de período/paginação; sem reescrever histórico.
create index maintenance_status_agenda on public.maintenance_records(status,start_at desc,id);
create index maintenance_completed_period on public.maintenance_records((coalesce(actual_end_at,end_at)),id) where status='COMPLETED';
create index refunds_period on public.refunds(created_at,id);
create index expenses_period on public.expenses(occurred_at desc,id);
create index expense_reversals_period on public.expense_reversals(created_at,id);
create index deposits_received_period on public.deposits(created_at,id) where kind='RECEIVED';
create index rentals_actual_vehicle on public.rentals(vehicle_id,actual_start_at) where actual_start_at is not null;
create index rentals_open_returns on public.rentals(end_at,id) where status in ('ACTIVE','OVERDUE');
create index charges_created_register on public.charges(created_at desc,id);

create function public.operational_readiness() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('schema',to_regclass('public.notification_routes') is not null and to_regclass('public.expense_reversals') is not null,
 'rls',not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
 'storage',(select count(*)=4 and bool_and(not public) from storage.buckets where id in ('vehicle-images','documents','inspections','contracts')));
$$;
revoke all on function public.operational_readiness() from public,anon,authenticated,service_role;
grant execute on function public.operational_readiness() to service_role;
