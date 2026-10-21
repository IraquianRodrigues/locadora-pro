-- Verificação remota sem fixtures nem alterações de dados/configuração.
begin read only;
select name, passed from (values
 ('application_tables', (select count(*)=64 from pg_tables where schemaname='public')),
 ('all_tables_rls', not exists(select from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity)),
 ('finance_views_invoker', (select count(*)=5 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('finance_customers','finance_vehicles','finance_reservations','finance_contracts','finance_charge_balances') and c.reloptions @> array['security_invoker=true'])),
 ('private_buckets', (select count(*)=4 and bool_and(not public) from storage.buckets where id in ('vehicle-images','documents','inspections','contracts'))),
 ('readiness_service_only', has_function_privilege('service_role','public.operational_readiness()','EXECUTE') and not has_function_privilege('anon','public.operational_readiness()','EXECUTE') and not has_function_privilege('authenticated','public.operational_readiness()','EXECUTE')),
 ('private_schema_hidden_from_anon', not has_schema_privilege('anon','app_private','USAGE')),
 ('definer_search_path_fixed', not exists(select from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'],false))),
 ('no_implicit_public_definer_execution', not exists(select from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname in ('public','app_private') and p.prosecdef and a.grantee=0 and a.privilege_type='EXECUTE')),
 ('staff_roles', (select count(*)=4 from public.roles where code in ('ADMIN','MANAGER','ATTENDANT','FINANCE'))),
 ('allocation_exclusion', exists(select from pg_constraint c where c.conrelid='public.vehicle_allocations'::regclass and c.contype='x'))
) checks(name,passed);
rollback;
