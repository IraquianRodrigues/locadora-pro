-- Fase 2. Executar como postgres pelo mecanismo de migrations do Supabase.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;
alter default privileges in schema app_private revoke execute on functions from public, anon, authenticated, service_role;

create function app_private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := clock_timestamp(); return new; end;
$$;

create function app_private.valid_period(value tstzrange) returns boolean
language sql immutable strict set search_path = '' as $$
  select not isempty(value) and not lower_inf(value) and not upper_inf(value)
    and isfinite(lower(value)) and isfinite(upper(value))
    and lower_inc(value) and not upper_inc(value) and lower(value) < upper(value);
$$;

create function app_private.valid_cpf(value text) returns boolean
language plpgsql immutable strict set search_path = '' as $$
declare total integer; digit integer; n integer; i integer;
begin
  if value !~ '^[0-9]{11}$' or value = repeat(substr(value, 1, 1), 11) then return false; end if;
  for n in 9..10 loop
    total := 0;
    for i in 1..n loop total := total + substr(value, i, 1)::integer * (n + 2 - i); end loop;
    digit := (total * 10) % 11;
    if digit = 10 then digit := 0; end if;
    if digit <> substr(value, n + 1, 1)::integer then return false; end if;
  end loop;
  return true;
end;
$$;

-- Compatível com CNPJ numérico e alfanumérico, segundo algoritmo da Receita.
create function app_private.valid_cnpj(value text) returns boolean
language plpgsql immutable strict set search_path = '' as $$
declare total integer; digit integer; n integer; i integer; weight integer;
begin
  if value !~ '^[A-Z0-9]{12}[0-9]{2}$' or value = repeat(substr(value, 1, 1), 14) then return false; end if;
  for n in 12..13 loop
    total := 0;
    for i in 1..n loop
      weight := ((n - i) % 8) + 2;
      total := total + (ascii(substr(value, i, 1)) - 48) * weight;
    end loop;
    digit := total % 11;
    digit := case when digit < 2 then 0 else 11 - digit end;
    if digit <> substr(value, n + 1, 1)::integer then return false; end if;
  end loop;
  return true;
end;
$$;

-- DDL helper, não concedido a usuários. Toda tabela nasce com RLS e sem acesso anônimo.
create function app_private.secure_table(table_name text, read_permission text, write_permission text default null)
returns void language plpgsql set search_path = '' as $$
begin
  execute format('alter table public.%I enable row level security', table_name);
  execute format('revoke all on public.%I from public, anon, authenticated, service_role', table_name);
  execute format('grant all on public.%I to service_role', table_name);
  if read_permission is not null then
    execute format('grant select on public.%I to authenticated', table_name);
    execute format('create policy staff_read on public.%I for select to authenticated using ((select app_private.has_permission(%L)))', table_name, read_permission);
  end if;
  if write_permission is not null then
    execute format('grant insert, update on public.%I to authenticated', table_name);
    execute format('create policy staff_insert on public.%I for insert to authenticated with check ((select app_private.has_permission(%L)))', table_name, write_permission);
    execute format('create policy staff_update on public.%I for update to authenticated using ((select app_private.has_permission(%L))) with check ((select app_private.has_permission(%L)))', table_name, write_permission, write_permission);
  end if;
  execute format('create trigger touch_updated_at before update on public.%I for each row execute function app_private.touch_updated_at()', table_name);
end;
$$;
revoke execute on all functions in schema app_private from public;
