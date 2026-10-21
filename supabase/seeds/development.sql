-- Não executado automaticamente. Somente fixture explícita de desenvolvimento.
do $$ begin
  if current_setting('app.environment',true) is distinct from 'development' then
    raise exception 'Seed requires explicit development environment';
  end if;
end $$;
insert into public.vehicle_categories(name,description,capacity,active)
values('Categoria de desenvolvimento','DADO FICTÍCIO — somente ambiente local',5,true)
on conflict(name) do nothing;
