begin;
do $$
declare player uuid:=gen_random_uuid(); other_player uuid:=gen_random_uuid(); request uuid:=gen_random_uuid();
 p public.garden_plots%rowtype; before_qty integer; before_coins integer; species text; seed text; slot_no integer:=2;
begin
 insert into auth.users(id,aud,role,email) values
 (player,'authenticated','authenticated',player||'@example.invalid'),
 (other_player,'authenticated','authenticated',other_player||'@example.invalid');
 perform set_config('garden_test.player',player::text,true);
 perform set_config('garden_test.other',other_player::text,true);
 perform set_config('request.jwt.claim.sub',player::text,true);
 perform public.garden_initialize();
 update public.garden_profiles set coins=1000 where user_id=player;
 begin
  perform public.garden_buy('gacha_rare',1,gen_random_uuid());
  raise exception 'TEST: gacha level lock ignored';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform public.garden_buy('gacha_common',2,request);
 perform public.garden_buy('gacha_common',2,request);
 if (select coins from public.garden_profiles where user_id=player) is distinct from 980
 or (select quantity from public.garden_inventory where user_id=player and item_id='gacha_common') is distinct from 2 then
  raise exception 'TEST: purchase retry changed balance/inventory';
 end if;
 perform public.garden_plant(0,'gacha_common');
 select * into p from public.garden_plots where user_id=player and slot=0 and not harvested;
 if p.source_seed_id is distinct from 'gacha_common' or not exists(select 1 from public.garden_seed_drops where seed_id='gacha_common' and plant_id=p.seed_id)
 or p.growth_seconds is distinct from (select grow_seconds from public.garden_catalog where id=p.seed_id)
 or p.xp_reward is distinct from (select xp from public.garden_catalog where id=p.seed_id)
 or p.ready_at is distinct from p.planted_at+make_interval(secs=>p.growth_seconds) then
  raise exception 'TEST: gacha did not snapshot an eligible species';
 end if;
 begin
  perform public.garden_plant(0,'gacha_common');
  raise exception 'TEST: occupied plot accepted another seed';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 if (select quantity from public.garden_inventory where user_id=player and item_id='gacha_common') is distinct from 1
 or (select seed_id from public.garden_plots where id=p.id) is distinct from p.seed_id then
  raise exception 'TEST: retry consumed inventory or rerolled plant';
 end if;
 update public.garden_catalog set grow_seconds=grow_seconds+100,xp=xp+1 where id=p.seed_id;
 if (select growth_seconds from public.garden_plots where id=p.id) is distinct from p.growth_seconds
 or (select xp_reward from public.garden_plots where id=p.id) is distinct from p.xp_reward then
  raise exception 'TEST: catalog change altered existing plant';
 end if;
 update public.garden_catalog set grow_seconds=grow_seconds-100,xp=xp-1 where id=p.seed_id;
 insert into public.garden_inventory values(player,'fertilizer',2);
 request:=gen_random_uuid();
 before_coins:=(select coins from public.garden_profiles where user_id=player);
 perform public.garden_buy('carrot',1,request);
 perform public.garden_buy('carrot',1,request);
 if (select quantity from public.garden_inventory where user_id=player and item_id='carrot') is distinct from 1
 or (select coins from public.garden_profiles where user_id=player) is distinct from before_coins-(select price from public.garden_catalog where id='carrot') then
  raise exception 'TEST: direct seed purchase or retry incorrect';
 end if;
 begin
  perform public.garden_buy('tomato',1,gen_random_uuid());
  raise exception 'TEST: direct seed level lock ignored';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 update public.garden_plots set ready_at=now()+interval '5 seconds' where id=p.id;
 perform public.garden_fertilize(p.id);
 if (select ready_at from public.garden_plots where id=p.id) is distinct from now()
 or (select growth_seconds from public.garden_plots where id=p.id) is distinct from p.growth_seconds then
  raise exception 'TEST: fertilizer overshot ripe time or changed duration snapshot';
 end if;
 begin
  perform public.garden_fertilize(p.id);
  raise exception 'TEST: ripe plant consumed fertilizer';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 before_coins:=(select coins from public.garden_profiles where user_id=player);
 perform public.garden_harvest(p.id);
 if (select xp from public.garden_profiles where user_id=player) is distinct from p.xp_reward
 or (select coins from public.garden_profiles where user_id=player) is distinct from before_coins
 or (select quantity from public.garden_collection where user_id=player and seed_id=p.seed_id) is distinct from 1 then
  raise exception 'TEST: harvest rewards incorrect';
 end if;
 begin
  perform public.garden_harvest(p.id);
  raise exception 'TEST: duplicate harvest accepted';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 update public.garden_catalog set active=false where kind='seed';
 begin
  perform public.garden_buy('gacha_common',1,gen_random_uuid());
  raise exception 'TEST: empty pool allowed purchase';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 begin
  perform public.garden_plant(1,'gacha_common');
  raise exception 'TEST: empty pool allowed planting';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 if (select quantity from public.garden_inventory where user_id=player and item_id='gacha_common') is distinct from 1 then
  raise exception 'TEST: failed roll consumed seed';
 end if;
 perform public.garden_plant(1,'carrot');
 if not exists(select 1 from public.garden_plots where user_id=player and slot=1 and seed_id='carrot' and source_seed_id='carrot') then
  raise exception 'TEST: legacy seed no longer works';
 end if;
 update public.garden_profiles set xp=300 where user_id=player;
 update public.garden_catalog set active=true where kind='seed' and not retired;
 perform public.garden_buy('gacha_common',21,gen_random_uuid());
 for species in select id from public.garden_catalog where kind='seed' and not retired order by id loop
  update public.garden_catalog set active=(id=species) where kind='seed' and not retired;
  perform public.garden_plant(slot_no,'gacha_common');
  if not exists(select 1 from public.garden_plots where user_id=player and slot=slot_no and seed_id=species) then
   raise exception 'TEST: weighted roll included disabled species or skipped eligible species';
  end if;
  select * into p from public.garden_plots where user_id=player and slot=slot_no and not harvested;
  update public.garden_plots set ready_at=now() where id=p.id;
  perform public.garden_harvest(p.id);
 end loop;
 update public.garden_catalog set active=true where kind='seed' and not retired;
 foreach seed in array array['gacha_rare','gacha_special'] loop
  perform public.garden_buy(seed,1,gen_random_uuid());
  perform public.garden_plant(slot_no,seed);
  if not exists(select 1 from public.garden_plots gp join public.garden_seed_drops d on d.seed_id=seed and d.plant_id=gp.seed_id where gp.user_id=player and gp.slot=slot_no and gp.source_seed_id=seed and not gp.harvested) then
   raise exception 'TEST: higher tier failed to produce plant';
  end if;
  slot_no:=slot_no+1;
 end loop;
 begin
  perform public.garden_plant(8,'gacha_special');
  raise exception 'TEST: planting without inventory allowed';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',other_player::text,true);
 perform public.garden_initialize();
 insert into public.garden_inventory values(other_player,'carrot',1);
 perform public.garden_plant(0,'carrot');
 begin
  perform public.garden_fertilize((select id from public.garden_plots where user_id=player and not harvested limit 1));
  raise exception 'TEST: player modified another garden';
 exception when raise_exception then if sqlerrm like 'TEST:%' then raise; end if; end;
 perform set_config('request.jwt.claim.sub',player::text,true);
end $$;

set local role authenticated;
do $$
begin
 if (select count(*) from public.garden_seed_drops)<>63 then raise exception 'TEST: authenticated cannot read odds'; end if;
 if exists(select 1 from public.garden_catalog where retired or id in ('sunflower','lotus')) then raise exception 'TEST: replaced crops visible in catalog'; end if;
 if exists(select 1 from public.garden_plots where user_id=current_setting('garden_test.other')::uuid)
 or exists(select 1 from public.garden_inventory where user_id=current_setting('garden_test.other')::uuid) then
  raise exception 'TEST: another player data visible';
 end if;
 if has_table_privilege('authenticated','public.garden_seed_drops','UPDATE')
 or has_table_privilege('authenticated','public.garden_plots','INSERT')
 or has_table_privilege('anon','public.garden_seed_drops','SELECT')
 or has_function_privilege('anon','public.garden_plant(integer,text)','EXECUTE') then
  raise exception 'TEST: client can override roll or call planting anonymously';
 end if;
end $$;
reset role;
rollback;
