begin;
do $$
declare manager uuid:=gen_random_uuid(); player uuid:=gen_random_uuid(); species text; plot uuid;
begin
 if (select count(*) from public.garden_catalog where kind='seed' and not retired)<>21
 or (select count(*) from public.garden_seed_drops)<>63 then raise exception 'TEST: incomplete species catalog'; end if;
 if exists(select 1 from public.garden_plots where seed_id in ('sunflower','lotus') or source_seed_id in ('sunflower','lotus'))
 or exists(select 1 from public.garden_inventory where item_id in ('sunflower','lotus'))
 or exists(select 1 from public.garden_collection where seed_id in ('sunflower','lotus')) then
  raise exception 'TEST: legacy crops were not migrated';
 end if;
 if exists(select 1 from public.garden_seed_drops d join public.garden_catalog c on c.id=d.plant_id where c.retired)
 or exists(select 1 from public.garden_catalog where id in ('sunflower','lotus') and (not retired or active)) then
  raise exception 'TEST: replaced crops are still obtainable';
 end if;
 insert into auth.users(id,aud,role,email) values
 (manager,'authenticated','authenticated',manager||'@example.invalid'),
 (player,'authenticated','authenticated',player||'@example.invalid');
 insert into garden_private.managers(user_id) values(manager);
 perform set_config('request.jwt.claim.sub',manager::text,true);
 perform public.garden_initialize();
 begin
  perform public.garden_cheat('inventory',1,'sunflower',gen_random_uuid());
  raise exception 'TEST: admin recreated retired seed';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_save_catalog('lotus',60,21600,150,3,60,true);
  raise exception 'TEST: admin reactivated retired species';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 for species in select id from public.garden_catalog where kind='seed' and not retired order by id loop
  perform public.garden_cheat('inventory',1,species,gen_random_uuid());
  perform public.garden_plant(0,species);
  select id into plot from public.garden_plots where user_id=manager and slot=0 and not harvested;
  perform public.garden_cheat('ready_all',0,null,gen_random_uuid());
  perform public.garden_harvest(plot);
  if (select quantity from public.garden_collection where user_id=manager and seed_id=species) is distinct from 1 then
   raise exception 'TEST: new species missing from collection: %',species;
  end if;
 end loop;
 if (select count(*) from public.garden_collection where user_id=manager)<>21 then raise exception 'TEST: collection omitted species'; end if;
 if (select coins from public.garden_profiles where user_id=manager)<>0 then raise exception 'TEST: harvest created currency'; end if;
 perform set_config('request.jwt.claim.sub',player::text,true);
 perform public.garden_initialize();
 insert into public.garden_inventory values(player,'sunflower',1);
 begin
  perform public.garden_plant(0,'sunflower');
  raise exception 'TEST: old client planted retired species';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 if exists(select 1 from public.garden_plots where user_id=player) then raise exception 'TEST: retired planting changed garden'; end if;
end $$;
rollback;
