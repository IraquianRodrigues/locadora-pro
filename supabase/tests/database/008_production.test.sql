begin;
select plan(5);
select ok(not has_function_privilege('anon','public.operational_readiness()','EXECUTE'),'Prontidão não é pública');
select ok(not has_function_privilege('authenticated','public.operational_readiness()','EXECUTE'),'Prontidão não é endpoint livre de funcionário');
select ok(has_function_privilege('service_role','public.operational_readiness()','EXECUTE'),'Monitor tem verificação delimitada');
select ok((select indexdef like '%occurred_at DESC, id%' from pg_indexes where schemaname='public' and indexname='expenses_period'),'Índice do filtro/ordenação por período');
select ok((select relrowsecurity from pg_class where oid='public.notifications'::regclass),'Caixa continua sob RLS');
select * from finish();
rollback;
