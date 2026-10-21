-- Executar apenas via `supabase test db --local`. Tudo é revertido ao final.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

select ok(c.relrowsecurity,'RLS: '||c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
and exists(select 1 from pg_trigger t where t.tgrelid=c.oid and t.tgname='touch_updated_at');
select ok(not has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE'),'anon sem acesso bruto: '||c.relname)
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
and exists(select 1 from pg_trigger t where t.tgrelid=c.oid and t.tgname='touch_updated_at');
select ok(exists(select 1 from pg_constraint where conname='vehicle_allocations_no_overlap' and contype='x'),'Exclusão central GiST instalada');
select is((select count(*)::integer from storage.buckets where id in ('vehicle-images','documents','inspections','contracts') and not public),4,'Quatro buckets privados');
select ok(app_private.valid_cpf('52998224725'),'CPF válido');
select ok(not app_private.valid_cpf('11111111111'),'CPF repetido negado');
select ok(app_private.valid_cnpj('11222333000181'),'CNPJ numérico válido');
select ok(app_private.valid_cnpj('12ABC34501DE35'),'CNPJ alfanumérico válido');
select ok(not app_private.valid_cnpj('12ABC34501DE00'),'CNPJ com DV incorreto negado');

-- UUIDs de teste isolados; a transação sempre termina em rollback.
insert into auth.users(id,email) values
 ('f2000000-0000-4000-8000-000000000001','admin-f2@example.invalid'),
 ('f2000000-0000-4000-8000-000000000002','attendant-f2@example.invalid'),
 ('f2000000-0000-4000-8000-000000000003','finance-f2@example.invalid'),
 ('f2000000-0000-4000-8000-000000000004','revoked-f2@example.invalid');
update public.profiles set active=true where id in (
 'f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000003');
insert into auth.sessions(id,user_id) select id,id from auth.users where id in (
 'f2000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002',
 'f2000000-0000-4000-8000-000000000003','f2000000-0000-4000-8000-000000000004');
insert into public.user_roles(user_id,role_id) select 'f2000000-0000-4000-8000-000000000001',id from public.roles where code='ADMIN';
insert into public.user_roles(user_id,role_id) select 'f2000000-0000-4000-8000-000000000002',id from public.roles where code='ATTENDANT';
insert into public.user_roles(user_id,role_id) select 'f2000000-0000-4000-8000-000000000003',id from public.roles where code='FINANCE';
insert into public.user_roles(user_id,role_id) select 'f2000000-0000-4000-8000-000000000004',id from public.roles where code='ADMIN';

set local role anon;
select throws_ok('select * from public.customers','42501',null,'Anônimo não lê clientes');
select throws_ok('select public.approve_reservation(gen_random_uuid(),''test-key-0000000001'')','42501',null,'Anônimo não executa aprovação');
select lives_ok('select * from public.catalog_categories()','Catálogo sanitizado acessível ao anônimo');
reset role;

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000002","session_id":"f2000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select ok(public.has_permission('customers.write'),'Atendente cadastra cliente');
select ok(not public.has_permission('reservations.approve'),'Atendente não aprova');
select ok(not public.has_permission('payments.confirm'),'Atendente não confirma pagamento');
select throws_ok('update public.profiles set active=true','42501',null,'Sem autoelevação por profile');
select throws_ok('delete from public.audit_logs','42501',null,'Funcionário não apaga auditoria');
select throws_ok('insert into public.user_roles(user_id,role_id) values(gen_random_uuid(),gen_random_uuid())','42501',null,'Sem autoatribuição de cargo');
reset role;

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000003","session_id":"f2000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select ok(public.has_permission('payments.confirm'),'Financeiro confirma recebimento');
select ok(not public.has_permission('documents.read'),'Financeiro não lê documentos');
select is((select count(*)::integer from public.customer_documents),0,'Documentos ocultos por RLS');
select is((select count(*)::integer from public.customers),0,'Clientes brutos ocultos do financeiro');
select lives_ok('select * from public.finance_customers','Projeção mínima disponível ao financeiro');
reset role;

select set_config('request.jwt.claims','{"sub":"f2000000-0000-4000-8000-000000000004","session_id":"f2000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','f2000000-0000-4000-8000-000000000004',true);
set local role authenticated;
select ok(not public.has_permission('users.manage'),'Usuário ADMIN revogado não tem permissão');
select is((select count(*)::integer from public.profiles),0,'Perfil revogado invisível');
reset role;
select * from finish();
rollback;
